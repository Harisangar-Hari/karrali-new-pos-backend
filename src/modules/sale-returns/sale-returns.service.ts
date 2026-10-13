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
import { CreateSaleReturnDto } from './dto/create-sale-return.dto';
import { QuerySaleReturnDto } from './dto/query-sale-return.dto';

const RETURN_CODE_PREFIX = 'RET';

const RETURN_LIST_INCLUDE = {
    Sale: {
        select: { Id: true, InvoiceNumber: true, Status: true, TotalAmount: true },
    },
    Customer: { select: { Id: true, Name: true, Code: true } },
} as const;

const RETURN_DETAIL_INCLUDE = {
    ...RETURN_LIST_INCLUDE,
    Items: {
        include: {
            Product: { select: { Id: true, Name: true, SKU: true } },
            SaleItem: { select: { Id: true, Qty: true, ReturnedQty: true } },
        },
    },
} as const;

type ReturnListRow = Prisma.SaleReturnGetPayload<{
    include: typeof RETURN_LIST_INCLUDE;
}>;
type ReturnDetailRow = Prisma.SaleReturnGetPayload<{
    include: typeof RETURN_DETAIL_INCLUDE;
}>;

const ZERO = new Prisma.Decimal(0);
const EPSILON = new Prisma.Decimal('0.0001');

@Injectable()
export class SaleReturnsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly stock: StockService,
    ) {}

    // ---------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------

    async list(
        query: QuerySaleReturnDto,
    ): Promise<PaginatedResponse<ReturnListRow>> {
        const where: Prisma.SaleReturnWhereInput = {};
        if (query.SaleId) where.SaleId = query.SaleId;
        if (query.CustomerId) where.CustomerId = query.CustomerId;

        if (query.From || query.To) {
            where.CreatedAt = {};
            if (query.From) where.CreatedAt.gte = new Date(query.From);
            if (query.To) where.CreatedAt.lte = new Date(query.To);
        }

        if (query.search) {
            where.OR = [
                { Code: { contains: query.search, mode: 'insensitive' } },
                { Notes: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        const orderBy: Prisma.SaleReturnOrderByWithRelationInput = {
            [query.sortBy ?? 'CreatedAt']: query.sortOrder,
        };

        return paginate<ReturnListRow>(
            this.prisma.saleReturn,
            { where, orderBy, include: RETURN_LIST_INCLUDE },
            query.page,
            query.limit,
        );
    }

    async findOne(id: string): Promise<ReturnDetailRow> {
        const ret = await this.prisma.saleReturn.findUnique({
            where: { Id: id },
            include: RETURN_DETAIL_INCLUDE,
        });
        if (!ret) throw new NotFoundException('Sale return not found');
        return ret;
    }

    // ---------------------------------------------------------------
    // Create
    // ---------------------------------------------------------------

    async create(
        dto: CreateSaleReturnDto,
        actorId: string,
    ): Promise<ReturnDetailRow> {
        // --- Eager validation, outside the tx ---

        const sale = await this.prisma.sale.findFirst({
            where: { Id: dto.SaleId, DeletedAt: null },
            include: {
                Items: true,
                Customer: { select: { Id: true, Balance: true, IsActive: true } },
            },
        });
        if (!sale) throw new NotFoundException('Sale not found');

        if (sale.Status === 'CANCELLED') {
            throw new ConflictException(
                'Cannot return items from a cancelled sale.',
            );
        }
        if (sale.Status === 'FULLY_RETURNED') {
            throw new ConflictException(
                'This sale has already been fully returned.',
            );
        }

        // Refund method coherence
        if (dto.RefundMethod === 'CREDIT') {
            const customerId = dto.CustomerId ?? sale.CustomerId;
            if (!customerId) {
                throw new BadRequestException(
                    'RefundMethod=CREDIT requires CustomerId (either in the request or on the original sale).',
                );
            }
            if (dto.CustomerId && dto.CustomerId !== sale.CustomerId) {
                throw new BadRequestException(
                    'CustomerId does not match the original sale customer.',
                );
            }
        } else {
            // CASH — a customer must not be silently credited
            if (dto.CustomerId && dto.CustomerId !== sale.CustomerId) {
                throw new BadRequestException(
                    'CustomerId does not match the original sale customer.',
                );
            }
        }

        // Build a map of saleItems for O(1) lookups
        const saleItemMap = new Map(sale.Items.map((i) => [i.Id, i]));

        // Validate each requested line
        const lines = dto.Items.map((item) => {
            const saleItem = saleItemMap.get(item.SaleItemId);
            if (!saleItem) {
                throw new BadRequestException(
                    `SaleItem ${item.SaleItemId} does not belong to sale ${sale.InvoiceNumber}.`,
                );
            }
            const remaining = saleItem.Qty - saleItem.ReturnedQty;
            if (item.Qty > remaining) {
                throw new BadRequestException(
                    `Cannot return ${item.Qty} of "${saleItem.Id}" — only ${remaining} remaining (sold ${saleItem.Qty}, already returned ${saleItem.ReturnedQty}).`,
                );
            }

            // Proportional refund from the original line snapshot
            const originalQty = new Prisma.Decimal(saleItem.Qty);
            const returnQty = new Prisma.Decimal(item.Qty);
            const ratio = returnQty.div(originalQty);

            const lineSubtotal = new Prisma.Decimal(saleItem.LineSubtotal)
                .mul(ratio)
                .toDecimalPlaces(4);
            const lineTax = new Prisma.Decimal(saleItem.LineTax)
                .mul(ratio)
                .toDecimalPlaces(4);
            const refundAmount = lineSubtotal.add(lineTax);

            return {
                SaleItemId: saleItem.Id,
                ProductId: saleItem.ProductId,
                Qty: item.Qty,
                UnitPrice: saleItem.UnitPrice,
                TaxRate: saleItem.TaxRate,
                LineSubtotal: lineSubtotal,
                LineTax: lineTax,
                RefundAmount: refundAmount,
                Notes: item.Notes ?? null,
            };
        });

        const subtotal = lines.reduce((s, l) => s.add(l.LineSubtotal), ZERO);
        const taxAmount = lines.reduce((s, l) => s.add(l.LineTax), ZERO);
        const refundAmount = subtotal.add(taxAmount);

        // Guard: refund cannot exceed what's left refundable on the sale.
        const remainingRefundable = new Prisma.Decimal(sale.TotalAmount).sub(
            sale.RefundedAmount,
        );
        if (refundAmount.gt(remainingRefundable.add(EPSILON))) {
            throw new BadRequestException(
                `Refund amount ${refundAmount.toString()} exceeds remaining refundable ${remainingRefundable.toString()}.`,
            );
        }

        // --- Atomic write ---

        return this.prisma.$transaction(async (tx) => {
            const code = await nextCode(tx, RETURN_CODE_PREFIX);

            const saleReturn = await tx.saleReturn.create({
                data: {
                    Code: code,
                    SaleId: sale.Id,
                    CustomerId:
                        dto.RefundMethod === 'CREDIT'
                            ? dto.CustomerId ?? sale.CustomerId
                            : sale.CustomerId,
                    RefundMethod: dto.RefundMethod,
                    Subtotal: subtotal,
                    TaxAmount: taxAmount,
                    RefundAmount: refundAmount,
                    Notes: dto.Notes ?? null,
                    CreatedByUserId: actorId,
                },
            });

            await tx.saleReturnItem.createMany({
                data: lines.map((l) => ({
                    SaleReturnId: saleReturn.Id,
                    SaleItemId: l.SaleItemId,
                    ProductId: l.ProductId,
                    Qty: l.Qty,
                    UnitPrice: l.UnitPrice,
                    TaxRate: l.TaxRate,
                    LineSubtotal: l.LineSubtotal,
                    LineTax: l.LineTax,
                    RefundAmount: l.RefundAmount,
                })),
            });

            // Update SaleItem.ReturnedQty caches
            for (const l of lines) {
                await tx.saleItem.update({
                    where: { Id: l.SaleItemId },
                    data: { ReturnedQty: { increment: l.Qty } },
                });
            }

            // Stock back in
            for (const l of lines) {
                await this.stock.adjustStock(
                    {
                        ProductId: l.ProductId,
                        WarehouseId: sale.WarehouseId,
                        Quantity: l.Qty,
                        Type: 'SALE_RETURN',
                        UnitCost: Number(l.UnitPrice),
                        SaleId: sale.Id,
                        SaleReturnId: saleReturn.Id,
                        Notes: `Return ${code} for sale ${sale.InvoiceNumber}`,
                        ActorId: actorId,
                    },
                    tx,
                );
            }

            // Refund method handling
            if (dto.RefundMethod === 'CASH') {
                await tx.cashLedger.create({
                    data: {
                        Type: 'SALE_REFUND',
                        Amount: refundAmount.neg(),
                        SaleId: sale.Id,
                        SaleReturnId: saleReturn.Id,
                        Notes: `Cash refund ${code}`,
                        CreatedByUserId: actorId,
                    },
                });
            } else {
                // CREDIT
                const customerId = dto.CustomerId ?? sale.CustomerId!;
                const customer = await tx.customer.findUniqueOrThrow({
                    where: { Id: customerId },
                    select: { Balance: true },
                });
                const newBalance = new Prisma.Decimal(customer.Balance).sub(
                    refundAmount,
                );
                await tx.customerLedger.create({
                    data: {
                        CustomerId: customerId,
                        Type: 'SALE_RETURN',
                        Amount: refundAmount.neg(),
                        BalanceAfter: newBalance,
                        SaleId: sale.Id,
                        SaleReturnId: saleReturn.Id,
                        Notes: `Store credit ${code}`,
                        CreatedByUserId: actorId,
                    },
                });
                await tx.customer.update({
                    where: { Id: customerId },
                    data: { Balance: newBalance },
                });
            }

            // Update Sale: bump RefundedAmount, then set status
            const newRefunded = new Prisma.Decimal(sale.RefundedAmount).add(
                refundAmount,
            );
            const remainingAfter = new Prisma.Decimal(sale.TotalAmount).sub(
                newRefunded,
            );
            const newStatus = remainingAfter.lte(EPSILON)
                ? 'FULLY_RETURNED'
                : 'PARTIALLY_RETURNED';

            await tx.sale.update({
                where: { Id: sale.Id },
                data: {
                    RefundedAmount: newRefunded,
                    Status: newStatus,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'SALE_RETURN_CREATED',
                    Entity: 'SaleReturn',
                    EntityId: saleReturn.Id,
                    After: saleReturn,
                    Metadata: {
                        SaleInvoiceNumber: sale.InvoiceNumber,
                        RefundMethod: dto.RefundMethod,
                        ItemCount: lines.length,
                        SaleNewStatus: newStatus,
                    },
                },
                tx,
            );

            return tx.saleReturn.findUniqueOrThrow({
                where: { Id: saleReturn.Id },
                include: RETURN_DETAIL_INCLUDE,
            });
        });
    }
}