import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma, StockMovement, StockMovementType } from '@prisma/client';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { CatalogGuardsService } from '../../common/services/catalog-guards.service';
import { paginate } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { QueryStockMovementDto } from './dto/query-stock-movement.dto';

/**
 * The one and only public API for changing stock.
 *
 * Every module that touches inventory — Purchases (Phase 3), Sales,
 * Returns (Phase 4), manual Adjustments (this module) — MUST go through
 * `adjustStock`. It writes BOTH the ledger (StockMovement) and the
 * cached column (WarehouseStock.Qty) atomically.
 *
 * `adjustStock` accepts an optional caller-provided transaction so that
 * a multi-line operation (e.g. a purchase with 20 items) can compose
 * several stock writes with its own header write into one atomic unit.
 * When omitted, it wraps the write in its own transaction.
 */

/** Signs allowed per movement type. ADJUSTMENT allows either. */
const ALLOWED_SIGNS: Record<StockMovementType, 'pos' | 'neg' | 'both'> = {
    OPENING: 'pos',
    PURCHASE: 'pos',
    SALE_RETURN: 'pos',
    TRANSFER_IN: 'pos',
    SALE: 'neg',
    PURCHASE_RETURN: 'neg',
    TRANSFER_OUT: 'neg',
    ADJUSTMENT: 'both',
};

const MANUAL_TYPES: StockMovementType[] = [
    StockMovementType.OPENING,
    StockMovementType.ADJUSTMENT,
];

export interface AdjustStockInput {
    ProductId: string;
    WarehouseId: string;
    /** Signed: positive = in, negative = out. Must be non-zero. */
    Quantity: number;
    Type: StockMovementType;
    UnitCost?: number | null;
    Notes?: string | null;
    /** Reference IDs — set by the owning module (Purchase, Sale, …) */
    SaleId?: string | null;
    SaleReturnId?: string | null;
    PurchaseId?: string | null;
    ActorId: string;
}

export interface ProductStockSummary {
    ProductId: string;
    Total: number;
    Warehouses: {
        WarehouseId: string;
        Warehouse: { Id: string; Name: string; Code: string };
        Qty: number;
    }[];
}

const MOVEMENT_INCLUDE = {
    Product: { select: { Id: true, Name: true, SKU: true } },
    Warehouse: { select: { Id: true, Name: true, Code: true } },
} as const;

type MovementRow = Prisma.StockMovementGetPayload<{
    include: typeof MOVEMENT_INCLUDE;
}>;

@Injectable()
export class StockService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly guards: CatalogGuardsService,
        private readonly audit: AuditService,
    ) { }

    /**
     * The primitive. Do not bypass.
     *
     * Behaviour:
     *  - Verifies product + warehouse exist and are active.
     *  - Verifies the sign of Quantity matches the movement Type.
     *  - Ensures the resulting WarehouseStock.Qty would not go negative.
     *  - Upserts WarehouseStock.Qty (cache).
     *  - Inserts StockMovement (ledger).
     *
     * No audit row is written here. Callers write one audit row for
     * the *business operation* (Sale created, Purchase created, etc.),
     * not per line item. The StockMovement ledger is the durable trail.
     */
    async adjustStock(
        input: AdjustStockInput,
        tx?: Prisma.TransactionClient,
    ): Promise<StockMovement> {
        this.assertSignMatchesType(input.Quantity, input.Type);

        if (input.Quantity === 0) {
            throw new BadRequestException('Quantity must be non-zero');
        }

        const run = async (
            client: Prisma.TransactionClient,
        ): Promise<StockMovement> => {
            const product = await client.product.findFirst({
                where: { Id: input.ProductId, DeletedAt: null },
                select: { IsActive: true, Name: true },
            });
            if (!product) {
                throw new BadRequestException(
                    'Product not found or has been deleted',
                );
            }
            if (!product.IsActive) {
                throw new BadRequestException(
                    `Product "${product.Name}" is inactive`,
                );
            }

            const warehouse = await client.warehouse.findFirst({
                where: { Id: input.WarehouseId, DeletedAt: null },
                select: { IsActive: true, Name: true },
            });
            if (!warehouse) {
                throw new BadRequestException(
                    'Warehouse not found or has been deleted',
                );
            }
            if (!warehouse.IsActive) {
                throw new BadRequestException(
                    `Warehouse "${warehouse.Name}" is inactive`,
                );
            }

            const existing = await client.warehouseStock.findUnique({
                where: {
                    ProductId_WarehouseId: {
                        ProductId: input.ProductId,
                        WarehouseId: input.WarehouseId,
                    },
                },
                select: { Qty: true },
            });

            const currentQty = existing?.Qty ?? 0;
            const nextQty = currentQty + input.Quantity;

            if (nextQty < 0) {
                throw new BadRequestException(
                    `Insufficient stock — current ${currentQty}, attempted change ${input.Quantity}.`,
                );
            }

            await client.warehouseStock.upsert({
                where: {
                    ProductId_WarehouseId: {
                        ProductId: input.ProductId,
                        WarehouseId: input.WarehouseId,
                    },
                },
                create: {
                    ProductId: input.ProductId,
                    WarehouseId: input.WarehouseId,
                    Qty: nextQty,
                },
                update: { Qty: nextQty },
            });

            return client.stockMovement.create({
                data: {
                    ProductId: input.ProductId,
                    WarehouseId: input.WarehouseId,
                    Type: input.Type,
                    Quantity: input.Quantity,
                    UnitCost: input.UnitCost ?? null,
                    Notes: input.Notes ?? null,
                    SaleId: input.SaleId ?? null,
                    SaleReturnId: input.SaleReturnId ?? null,
                    PurchaseId: input.PurchaseId ?? null,
                    CreatedByUserId: input.ActorId,
                },
            });
        };

        return tx
            ? run(tx)
            : this.prisma.$transaction((client) => run(client));
    }

    /**
     * Manual adjustment endpoint. Restricts type to OPENING/ADJUSTMENT
     * so callers can't spoof a SALE or PURCHASE and bypass the future
     * invoice flow.
     *
     * Writes one audit row (STOCK_MOVEMENT_CREATED) inside the same
     * transaction as the ledger write.
     */
    async manualAdjust(
        dto: AdjustStockDto,
        actorId: string,
    ): Promise<StockMovement> {
        if (!MANUAL_TYPES.includes(dto.Type)) {
            throw new BadRequestException(
                `Manual adjustments may only use ${MANUAL_TYPES.join(' or ')}`,
            );
        }

        return this.prisma.$transaction(async (tx) => {
            const movement = await this.adjustStock(
                {
                    ProductId: dto.ProductId,
                    WarehouseId: dto.WarehouseId,
                    Quantity: dto.Quantity,
                    Type: dto.Type,
                    UnitCost: dto.UnitCost ?? null,
                    Notes: dto.Notes ?? null,
                    ActorId: actorId,
                },
                tx,
            );

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'STOCK_MOVEMENT_CREATED',
                    Entity: 'StockMovement',
                    EntityId: movement.Id,
                    After: movement,
                    Metadata: {
                        ProductId: dto.ProductId,
                        WarehouseId: dto.WarehouseId,
                        MovementType: dto.Type,
                    },
                },
                tx,
            );

            return movement;
        });
    }

    /**
     * Per-warehouse stock for one product, plus a grand total. Empty
     * warehouse list is valid (product exists but has never been
     * stocked anywhere).
     */
    async getProductStock(productId: string): Promise<ProductStockSummary> {
        const product = await this.prisma.product.findFirst({
            where: { Id: productId, DeletedAt: null },
            select: { Id: true },
        });
        if (!product) throw new NotFoundException('Product not found');

        const rows = await this.prisma.warehouseStock.findMany({
            where: { ProductId: productId, Qty: { not: 0 } },
            include: {
                Warehouse: { select: { Id: true, Name: true, Code: true } },
            },
            orderBy: { Warehouse: { Name: 'asc' } },
        });

        const total = rows.reduce((s, r) => s + r.Qty, 0);

        return {
            ProductId: productId,
            Total: total,
            Warehouses: rows.map((r) => ({
                WarehouseId: r.WarehouseId,
                Warehouse: r.Warehouse,
                Qty: r.Qty,
            })),
        };
    }

    async getLedger(
        query: QueryStockMovementDto,
    ): Promise<PaginatedResponse<MovementRow>> {
        const where: Prisma.StockMovementWhereInput = {};
        if (query.ProductId) where.ProductId = query.ProductId;
        if (query.WarehouseId) where.WarehouseId = query.WarehouseId;
        if (query.Type) where.Type = query.Type;

        const orderBy: Prisma.StockMovementOrderByWithRelationInput = {
            CreatedAt: 'desc',
        };

        return paginate<MovementRow>(
            this.prisma.stockMovement,
            { where, orderBy, include: MOVEMENT_INCLUDE },
            query.page,
            query.limit,
        );
    }

    // ---------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------

    private assertSignMatchesType(
        qty: number,
        type: StockMovementType,
    ): void {
        const rule = ALLOWED_SIGNS[type];
        if (rule === 'both') return;
        if (rule === 'pos' && qty < 0) {
            throw new BadRequestException(
                `Movement type ${type} requires a positive quantity`,
            );
        }
        if (rule === 'neg' && qty > 0) {
            throw new BadRequestException(
                `Movement type ${type} requires a negative quantity`,
            );
        }
    }
}