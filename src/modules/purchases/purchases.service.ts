import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { nextCode } from '../../common/utils/code.util';
import { paginate } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StockService } from '../stock/stock.service';
import { CancelPurchaseDto } from './dto/cancel-purchase.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { QueryPurchaseDto } from './dto/query-purchase.dto';

const PURCHASE_CODE_PREFIX = 'PUR';

const PURCHASE_LIST_INCLUDE = {
    Supplier: { select: { Id: true, Name: true, Code: true } },
    Warehouse: { select: { Id: true, Name: true, Code: true } },
} as const;

const PURCHASE_DETAIL_INCLUDE = {
    ...PURCHASE_LIST_INCLUDE,
    Items: {
        include: {
            Product: { select: { Id: true, Name: true, SKU: true } },
        },
    },
    Payments: { orderBy: { PaidAt: 'asc' } },
    Cheques: { orderBy: { IssueDate: 'asc' } },
} as const;

type PurchaseListRow = Prisma.PurchaseGetPayload<{
    include: typeof PURCHASE_LIST_INCLUDE;
}>;
type PurchaseDetailRow = Prisma.PurchaseGetPayload<{
    include: typeof PURCHASE_DETAIL_INCLUDE;
}>;

@Injectable()
export class PurchasesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly stock: StockService,
    ) { }

    // ---------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------

    async list(
        query: QueryPurchaseDto,
    ): Promise<PaginatedResponse<PurchaseListRow>> {
        const where: Prisma.PurchaseWhereInput = { DeletedAt: null };

        if (query.SupplierId) where.SupplierId = query.SupplierId;
        if (query.WarehouseId) where.WarehouseId = query.WarehouseId;
        if (query.Status) where.Status = query.Status;

        if (query.From || query.To) {
            where.InvoiceDate = {};
            if (query.From) where.InvoiceDate.gte = new Date(query.From);
            if (query.To) where.InvoiceDate.lte = new Date(query.To);
        }

        if (query.search) {
            where.OR = [
                { Code: { contains: query.search, mode: 'insensitive' } },
                { SupplierInvoiceNo: { contains: query.search, mode: 'insensitive' } },
            ];
        }
        // Payment status filter — uses Prisma field references so the
        // comparison happens in SQL (TotalAmount vs PaidAmount), not by
        // fetching everything and filtering in memory.
        if (query.paymentStatus === 'paid') {
            where.PaidAmount = { gte: this.prisma.purchase.fields.TotalAmount };
        } else if (query.paymentStatus === 'unpaid') {
            where.AND = [
                { PaidAmount: { lte: 0 } },
                { TotalAmount: { gt: 0 } },
            ];
        } else if (query.paymentStatus === 'partial') {
            where.AND = [
                { PaidAmount: { gt: 0 } },
                { PaidAmount: { lt: this.prisma.purchase.fields.TotalAmount } },
            ];
        }

        const orderBy: Prisma.PurchaseOrderByWithRelationInput = {
            [query.sortBy ?? 'InvoiceDate']: query.sortOrder,
        };

        return paginate<PurchaseListRow>(
            this.prisma.purchase,
            { where, orderBy, include: PURCHASE_LIST_INCLUDE },
            query.page,
            query.limit,
        );
    }

    async findOne(id: string): Promise<PurchaseDetailRow> {
        const purchase = await this.prisma.purchase.findFirst({
            where: { Id: id, DeletedAt: null },
            include: PURCHASE_DETAIL_INCLUDE,
        });
        if (!purchase) throw new NotFoundException('Purchase not found');
        return purchase;
    }

    // ---------------------------------------------------------------
    // Create
    // ---------------------------------------------------------------

    async create(
        dto: CreatePurchaseDto,
        actorId: string,
    ): Promise<PurchaseDetailRow> {
        // --- Eager validation, outside the tx, for clean fail-fast errors ---

        const supplier = await this.prisma.supplier.findFirst({
            where: { Id: dto.SupplierId, DeletedAt: null },
            select: { Id: true, IsActive: true, Name: true },
        });
        if (!supplier) {
            throw new BadRequestException(
                'Supplier not found or has been deleted',
            );
        }
        if (!supplier.IsActive) {
            throw new BadRequestException(
                `Supplier "${supplier.Name}" is inactive`,
            );
        }

        const warehouse = await this.prisma.warehouse.findFirst({
            where: { Id: dto.WarehouseId, DeletedAt: null },
            select: { Id: true, IsActive: true, Name: true },
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

        const productIds = Array.from(new Set(dto.Items.map((i) => i.ProductId)));
        const products = await this.prisma.product.findMany({
            where: { Id: { in: productIds }, DeletedAt: null },
            select: { Id: true, IsActive: true, Name: true, TaxRate: true },
        });
        const productMap = new Map(products.map((p) => [p.Id, p]));

        for (const item of dto.Items) {
            const p = productMap.get(item.ProductId);
            if (!p) {
                throw new BadRequestException(
                    `Product ${item.ProductId} not found or has been deleted`,
                );
            }
            if (!p.IsActive) {
                throw new BadRequestException(
                    `Product "${p.Name}" is inactive`,
                );
            }
        }

        // --- Compute line + header totals with Decimal (no floats) ---

        const lines = dto.Items.map((item) => {
            const product = productMap.get(item.ProductId)!;
            const qty = new Prisma.Decimal(item.Qty);
            const unitCost = new Prisma.Decimal(item.UnitCost);
            const lineSubtotal = qty.mul(unitCost).toDecimalPlaces(4);

            // Resolve TaxRate: explicit item value wins (including 0);
            // otherwise fall back to product default; otherwise null.
            let taxRate: Prisma.Decimal | null = null;
            if (item.TaxRate !== undefined) {
                taxRate = new Prisma.Decimal(item.TaxRate);
            } else if (product.TaxRate !== null) {
                taxRate = new Prisma.Decimal(product.TaxRate);
            }

            const lineTax = taxRate
                ? lineSubtotal.mul(taxRate).div(100).toDecimalPlaces(4)
                : new Prisma.Decimal(0);

            const lineTotal = lineSubtotal.add(lineTax);

            return {
                ProductId: item.ProductId,
                Qty: item.Qty,
                UnitCost: unitCost,
                TaxRate: taxRate,
                LineSubtotal: lineSubtotal,
                LineTax: lineTax,
                LineTotal: lineTotal,
                Notes: item.Notes ?? null,
            };
        });

        const subtotal = lines.reduce(
            (s, l) => s.add(l.LineSubtotal),
            new Prisma.Decimal(0),
        );
        const taxAmount = lines.reduce(
            (s, l) => s.add(l.LineTax),
            new Prisma.Decimal(0),
        );
        const totalAmount = subtotal.add(taxAmount);

        // --- Write everything atomically ---

        return this.prisma.$transaction(async (tx) => {
            const code = await nextCode(tx, PURCHASE_CODE_PREFIX);

            const purchase = await tx.purchase.create({
                data: {
                    Code: code,
                    SupplierId: dto.SupplierId,
                    SupplierInvoiceNo: dto.SupplierInvoiceNo ?? null,
                    InvoiceDate: new Date(dto.InvoiceDate),
                    DueDate: dto.DueDate ? new Date(dto.DueDate) : null,
                    WarehouseId: dto.WarehouseId,
                    Status: 'POSTED',
                    Subtotal: subtotal,
                    TaxAmount: taxAmount,
                    TotalAmount: totalAmount,
                    PaidAmount: new Prisma.Decimal(0),
                    Notes: dto.Notes ?? null,
                    CreatedByUserId: actorId,
                    UpdatedByUserId: actorId,
                },
            });

            await tx.purchaseItem.createMany({
                data: lines.map((l) => ({
                    PurchaseId: purchase.Id,
                    ProductId: l.ProductId,
                    Qty: l.Qty,
                    UnitCost: l.UnitCost,
                    TaxRate: l.TaxRate,
                    LineSubtotal: l.LineSubtotal,
                    LineTax: l.LineTax,
                    LineTotal: l.LineTotal,
                    Notes: l.Notes,
                })),
            });

            // Stock movements — via StockService, same tx. Positive qty = inbound.
            for (const l of lines) {
                await this.stock.adjustStock(
                    {
                        ProductId: l.ProductId,
                        WarehouseId: dto.WarehouseId,
                        Quantity: l.Qty,
                        Type: 'PURCHASE',
                        UnitCost: Number(l.UnitCost),
                        PurchaseId: purchase.Id,
                        Notes: `Purchase ${code}`,
                        ActorId: actorId,
                    },
                    tx,
                );
            }

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'PURCHASE_CREATED',
                    Entity: 'Purchase',
                    EntityId: purchase.Id,
                    After: purchase,
                    Metadata: {
                        SupplierId: dto.SupplierId,
                        WarehouseId: dto.WarehouseId,
                        ItemCount: lines.length,
                    },
                },
                tx,
            );

            return tx.purchase.findUniqueOrThrow({
                where: { Id: purchase.Id },
                include: PURCHASE_DETAIL_INCLUDE,
            });
        });
    }

    // ---------------------------------------------------------------
    // Cancel — reverses stock, blocks on payments/cheques
    // ---------------------------------------------------------------

    async cancel(
        id: string,
        dto: CancelPurchaseDto,
        actorId: string,
    ): Promise<PurchaseDetailRow> {
        return this.prisma.$transaction(async (tx) => {
            const purchase = await tx.purchase.findFirst({
                where: { Id: id, DeletedAt: null },
                include: { Items: true },
            });
            if (!purchase) throw new NotFoundException('Purchase not found');

            if (purchase.Status !== 'POSTED') {
                throw new ConflictException(
                    `Cannot cancel a purchase in ${purchase.Status} status`,
                );
            }

            if (!new Prisma.Decimal(purchase.PaidAmount).isZero()) {
                throw new ConflictException(
                    `Cannot cancel — payments totalling ${purchase.PaidAmount.toString()} have been recorded. Reverse them first.`,
                );
            }

            const activeCheques = await tx.supplierCheque.count({
                where: {
                    PurchaseId: id,
                    Status: { in: ['PENDING', 'CLEARED'] },
                },
            });
            if (activeCheques > 0) {
                throw new ConflictException(
                    `Cannot cancel — ${activeCheques} active cheque(s) reference this purchase. Void them first.`,
                );
            }

            // Reverse stock for every line. Will fail if stock was already
            // consumed elsewhere (e.g. sold) — that's the correct behavior:
            // you can't un-buy goods you've already resold.
            for (const item of purchase.Items) {
                await this.stock.adjustStock(
                    {
                        ProductId: item.ProductId,
                        WarehouseId: purchase.WarehouseId,
                        Quantity: -item.Qty,
                        Type: 'PURCHASE_RETURN',
                        UnitCost: Number(item.UnitCost),
                        PurchaseId: id,
                        Notes: `Purchase ${purchase.Code} cancelled`,
                        ActorId: actorId,
                    },
                    tx,
                );
            }

            const noteAppend = dto.Reason
                ? purchase.Notes
                    ? `${purchase.Notes}\n\nCancelled: ${dto.Reason}`
                    : `Cancelled: ${dto.Reason}`
                : purchase.Notes;

            const updated = await tx.purchase.update({
                where: { Id: id },
                data: {
                    Status: 'CANCELLED',
                    CancelledAt: new Date(),
                    CancelledByUserId: actorId,
                    UpdatedByUserId: actorId,
                    Notes: noteAppend,
                },
                include: PURCHASE_DETAIL_INCLUDE,
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'PURCHASE_CANCELLED',
                    Entity: 'Purchase',
                    EntityId: id,
                    Before: {
                        Status: purchase.Status,
                        PaidAmount: purchase.PaidAmount.toString(),
                    },
                    After: { Status: updated.Status },
                    Metadata: { Reason: dto.Reason ?? null },
                },
                tx,
            );

            return updated;
        });
    }
}