import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma, QuotationStatus } from '@prisma/client';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { nextCode } from '../../common/utils/code.util';
import { paginate } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SalesService } from '../sales/sales.service';
import { ChangeQuotationStatusDto } from './dto/change-quotation-status.dto';
import { ConvertQuotationDto } from './dto/convert-quotation.dto';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { QuotationItemDto } from './dto/quotation-item.dto';
import { QueryQuotationDto } from './dto/query-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';

const QUOTATION_CODE_PREFIX = 'QUO';

const QUOTATION_LIST_INCLUDE = {
    Customer: { select: { Id: true, Name: true, Code: true } },
} as const;

const QUOTATION_DETAIL_INCLUDE = {
    ...QUOTATION_LIST_INCLUDE,
    Items: {
        include: {
            Product: { select: { Id: true, Name: true, SKU: true } },
        },
    },
    Sale: { select: { Id: true, InvoiceNumber: true, Status: true } },
} as const;

type QuotationListRow = Prisma.QuotationGetPayload<{
    include: typeof QUOTATION_LIST_INCLUDE;
}> & { EffectiveStatus: string };

type QuotationDetailRow = Prisma.QuotationGetPayload<{
    include: typeof QUOTATION_DETAIL_INCLUDE;
}> & { EffectiveStatus: string };

export interface ConvertOptions {
    hasDiscountPermission: boolean;
}

const ZERO = new Prisma.Decimal(0);

/** Editable fields per status. */
const EDITABLE_DRAFT = new Set([
    'CustomerId',
    'ValidUntil',
    'Notes',
    'Items',
]);
const EDITABLE_SENT = new Set(['ValidUntil', 'Notes']);

@Injectable()
export class QuotationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly sales: SalesService,
    ) {}

    // ---------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------

    async list(
        query: QueryQuotationDto,
    ): Promise<PaginatedResponse<QuotationListRow>> {
        const where: Prisma.QuotationWhereInput = { DeletedAt: null };

        if (query.CustomerId) where.CustomerId = query.CustomerId;
        if (query.Status) where.Status = query.Status;

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

        const orderBy: Prisma.QuotationOrderByWithRelationInput = {
            [query.sortBy ?? 'CreatedAt']: query.sortOrder,
        };

        const result = await paginate<
            Prisma.QuotationGetPayload<{ include: typeof QUOTATION_LIST_INCLUDE }>
        >(
            this.prisma.quotation,
            { where, orderBy, include: QUOTATION_LIST_INCLUDE },
            query.page,
            query.limit,
        );

        return {
            data: result.data.map((q) => ({
                ...q,
                EffectiveStatus: this.effectiveStatus(q.Status, q.ValidUntil),
            })),
            meta: result.meta,
        };
    }

    async findOne(id: string): Promise<QuotationDetailRow> {
        const quote = await this.prisma.quotation.findFirst({
            where: { Id: id, DeletedAt: null },
            include: QUOTATION_DETAIL_INCLUDE,
        });
        if (!quote) throw new NotFoundException('Quotation not found');
        return {
            ...quote,
            EffectiveStatus: this.effectiveStatus(quote.Status, quote.ValidUntil),
        };
    }

    // ---------------------------------------------------------------
    // Create
    // ---------------------------------------------------------------

    async create(
        dto: CreateQuotationDto,
        actorId: string,
        opts: ConvertOptions,
    ): Promise<QuotationDetailRow> {
        const customer = await this.resolveCustomer(dto.CustomerId);
        const lines = await this.buildLines(dto.Items, opts);

        const subtotal = lines.reduce((s, l) => s.add(l.LineSubtotal), ZERO);
        const discountAmount = lines.reduce((s, l) => s.add(l.LineDiscount), ZERO);
        const taxAmount = lines.reduce((s, l) => s.add(l.LineTax), ZERO);
        const totalAmount = subtotal.sub(discountAmount).add(taxAmount);

        return this.prisma.$transaction(async (tx) => {
            const code = await nextCode(tx, QUOTATION_CODE_PREFIX);

            const quote = await tx.quotation.create({
                data: {
                    Code: code,
                    CustomerId: customer?.Id ?? null,
                    Status: 'DRAFT',
                    Subtotal: subtotal,
                    DiscountAmount: discountAmount,
                    TaxAmount: taxAmount,
                    TotalAmount: totalAmount,
                    ValidUntil: dto.ValidUntil ? new Date(dto.ValidUntil) : null,
                    Notes: dto.Notes ?? null,
                    CreatedByUserId: actorId,
                    UpdatedByUserId: actorId,
                },
            });

            await tx.quotationItem.createMany({
                data: lines.map((l) => ({
                    QuotationId: quote.Id,
                    ProductId: l.ProductId,
                    Qty: l.Qty,
                    UnitPrice: l.UnitPrice,
                    Discount: l.Discount,
                    TaxRate: l.TaxRate,
                    LineSubtotal: l.LineSubtotal,
                    LineDiscount: l.LineDiscount,
                    LineTax: l.LineTax,
                    LineTotal: l.LineTotal,
                    Notes: l.Notes,
                })),
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'QUOTATION_CREATED',
                    Entity: 'Quotation',
                    EntityId: quote.Id,
                    After: quote,
                    Metadata: {
                        ItemCount: lines.length,
                        CustomerId: customer?.Id ?? null,
                    },
                },
                tx,
            );

            return this.findOneInTx(tx, quote.Id);
        });
    }

    // ---------------------------------------------------------------
    // Update
    // ---------------------------------------------------------------

    async update(
        id: string,
        dto: UpdateQuotationDto,
        actorId: string,
        opts: ConvertOptions,
    ): Promise<QuotationDetailRow> {
        return this.prisma.$transaction(async (tx) => {
            const current = await tx.quotation.findFirst({
                where: { Id: id, DeletedAt: null },
            });
            if (!current) throw new NotFoundException('Quotation not found');

            if (current.Status !== 'DRAFT' && current.Status !== 'SENT') {
                throw new ConflictException(
                    `Cannot update a quotation in ${current.Status} status.`,
                );
            }

            const editable =
                current.Status === 'DRAFT' ? EDITABLE_DRAFT : EDITABLE_SENT;

            for (const key of Object.keys(dto)) {
                if ((dto as Record<string, unknown>)[key] === undefined) continue;
                if (!editable.has(key)) {
                    throw new BadRequestException(
                        `Field "${key}" cannot be changed once the quotation is ${current.Status}.`,
                    );
                }
            }

            // If items provided on DRAFT — replace them entirely.
            let newSubtotal = current.Subtotal;
            let newDiscount = current.DiscountAmount;
            let newTax = current.TaxAmount;
            let newTotal = current.TotalAmount;

            if (dto.Items && current.Status === 'DRAFT') {
                const lines = await this.buildLines(dto.Items, opts);

                newSubtotal = lines.reduce((s, l) => s.add(l.LineSubtotal), ZERO);
                newDiscount = lines.reduce((s, l) => s.add(l.LineDiscount), ZERO);
                newTax = lines.reduce((s, l) => s.add(l.LineTax), ZERO);
                newTotal = newSubtotal.sub(newDiscount).add(newTax);

                await tx.quotationItem.deleteMany({
                    where: { QuotationId: id },
                });
                await tx.quotationItem.createMany({
                    data: lines.map((l) => ({
                        QuotationId: id,
                        ProductId: l.ProductId,
                        Qty: l.Qty,
                        UnitPrice: l.UnitPrice,
                        Discount: l.Discount,
                        TaxRate: l.TaxRate,
                        LineSubtotal: l.LineSubtotal,
                        LineDiscount: l.LineDiscount,
                        LineTax: l.LineTax,
                        LineTotal: l.LineTotal,
                        Notes: l.Notes,
                    })),
                });
            }

            // Customer change only allowed on DRAFT
            let newCustomerId = current.CustomerId;
            if (dto.CustomerId !== undefined && current.Status === 'DRAFT') {
                const customer = await this.resolveCustomer(dto.CustomerId);
                newCustomerId = customer?.Id ?? null;
            }

            await tx.quotation.update({
                where: { Id: id },
                data: {
                    CustomerId: newCustomerId,
                    ValidUntil:
                        dto.ValidUntil !== undefined
                            ? dto.ValidUntil
                                ? new Date(dto.ValidUntil)
                                : null
                            : undefined,
                    Notes: dto.Notes,
                    Subtotal: newSubtotal,
                    DiscountAmount: newDiscount,
                    TaxAmount: newTax,
                    TotalAmount: newTotal,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'QUOTATION_UPDATED',
                    Entity: 'Quotation',
                    EntityId: id,
                    Before: current,
                },
                tx,
            );

            return this.findOneInTx(tx, id);
        });
    }

    // ---------------------------------------------------------------
    // Status transitions
    // ---------------------------------------------------------------

    async send(id: string, actorId: string): Promise<QuotationDetailRow> {
        return this.transition(
            id,
            'DRAFT',
            'SENT',
            actorId,
            'QUOTATION_SENT',
        );
    }

    async accept(id: string, actorId: string): Promise<QuotationDetailRow> {
        return this.transition(
            id,
            'SENT',
            'ACCEPTED',
            actorId,
            'QUOTATION_ACCEPTED',
        );
    }

    async reject(
        id: string,
        dto: ChangeQuotationStatusDto,
        actorId: string,
    ): Promise<QuotationDetailRow> {
        return this.transition(
            id,
            'SENT',
            'REJECTED',
            actorId,
            'QUOTATION_REJECTED',
            dto.Reason,
        );
    }

    async cancel(
        id: string,
        dto: ChangeQuotationStatusDto,
        actorId: string,
    ): Promise<QuotationDetailRow> {
        return this.prisma.$transaction(async (tx) => {
            const current = await tx.quotation.findFirst({
                where: { Id: id, DeletedAt: null },
            });
            if (!current) throw new NotFoundException('Quotation not found');

            if (current.Status !== 'DRAFT' && current.Status !== 'SENT') {
                throw new ConflictException(
                    `Cannot cancel a quotation in ${current.Status} status.`,
                );
            }

            await tx.quotation.update({
                where: { Id: id },
                data: {
                    Status: 'CANCELLED',
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'QUOTATION_CANCELLED',
                    Entity: 'Quotation',
                    EntityId: id,
                    Before: { Status: current.Status },
                    After: { Status: 'CANCELLED' },
                    Metadata: { Reason: dto.Reason ?? null },
                },
                tx,
            );

            return this.findOneInTx(tx, id);
        });
    }

    // ---------------------------------------------------------------
    // Convert
    // ---------------------------------------------------------------

    async convert(
        id: string,
        dto: ConvertQuotationDto,
        actorId: string,
        opts: ConvertOptions,
    ): Promise<QuotationDetailRow> {
        return this.prisma.$transaction(async (tx) => {
            const quote = await tx.quotation.findFirst({
                where: { Id: id, DeletedAt: null },
                include: { Items: true },
            });
            if (!quote) throw new NotFoundException('Quotation not found');

            if (quote.Status !== 'ACCEPTED') {
                throw new ConflictException(
                    `Only ACCEPTED quotations can be converted. Current status: ${quote.Status}.`,
                );
            }

            if (quote.Items.length === 0) {
                throw new BadRequestException(
                    'Quotation has no items — cannot convert.',
                );
            }

            // Build the sale payload from the quote snapshot.
            const saleNotes = dto.Notes
                ? `Converted from ${quote.Code} — ${dto.Notes}`
                : `Converted from ${quote.Code}`;

            const sale = await this.sales.createInTx(
                tx,
                {
                    TerminalId: dto.TerminalId,
                    CustomerId: quote.CustomerId ?? undefined,
                    Notes: saleNotes,
                    Items: quote.Items.map((item) => ({
                        ProductId: item.ProductId,
                        Qty: item.Qty,
                        UnitPrice: Number(item.UnitPrice),
                        Discount:
                            item.Discount && !item.Discount.isZero()
                                ? Number(item.Discount)
                                : undefined,
                        TaxRate:
                            item.TaxRate !== null
                                ? Number(item.TaxRate)
                                : undefined,
                        Notes: item.Notes ?? undefined,
                    })),
                    Payments: dto.Payments,
                },
                actorId,
                { hasDiscountPermission: opts.hasDiscountPermission },
            );

            await tx.quotation.update({
                where: { Id: id },
                data: {
                    Status: 'CONVERTED',
                    SaleId: sale.Id,
                    ConvertedAt: new Date(),
                    ConvertedByUserId: actorId,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'QUOTATION_CONVERTED',
                    Entity: 'Quotation',
                    EntityId: id,
                    Before: { Status: 'ACCEPTED' },
                    After: { Status: 'CONVERTED', SaleId: sale.Id },
                    Metadata: {
                        SaleInvoiceNumber: sale.InvoiceNumber,
                    },
                },
                tx,
            );

            return this.findOneInTx(tx, id);
        });
    }

    // ---------------------------------------------------------------
    // Delete (DRAFT only)
    // ---------------------------------------------------------------

    async remove(id: string, actorId: string): Promise<{ ok: true }> {
        return this.prisma.$transaction(async (tx) => {
            const current = await tx.quotation.findFirst({
                where: { Id: id, DeletedAt: null },
            });
            if (!current) throw new NotFoundException('Quotation not found');

            if (current.Status !== 'DRAFT') {
                throw new ConflictException(
                    `Only DRAFT quotations can be deleted. This one is ${current.Status} — cancel it instead.`,
                );
            }

            await tx.quotation.update({
                where: { Id: id },
                data: {
                    DeletedAt: new Date(),
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'QUOTATION_DELETED',
                    Entity: 'Quotation',
                    EntityId: id,
                    Before: current,
                },
                tx,
            );

            return { ok: true };
        });
    }

    // ---------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------

    private effectiveStatus(
        status: QuotationStatus,
        validUntil: Date | null,
    ): string {
        if (
            (status === 'DRAFT' || status === 'SENT') &&
            validUntil !== null &&
            validUntil.getTime() < Date.now()
        ) {
            return 'EXPIRED';
        }
        return status;
    }

    private async resolveCustomer(customerId?: string | null): Promise<{
        Id: string;
    } | null> {
        if (!customerId) return null;
        const customer = await this.prisma.customer.findFirst({
            where: { Id: customerId, DeletedAt: null },
            select: { Id: true, IsActive: true, Name: true },
        });
        if (!customer) {
            throw new BadRequestException(
                'Customer not found or has been deleted',
            );
        }
        if (!customer.IsActive) {
            throw new BadRequestException(
                `Customer "${customer.Name}" is inactive`,
            );
        }
        return { Id: customer.Id };
    }

    private async buildLines(
        items: QuotationItemDto[],
        opts: ConvertOptions,
    ): Promise<
        {
            ProductId: string;
            Qty: number;
            UnitPrice: Prisma.Decimal;
            Discount: Prisma.Decimal;
            TaxRate: Prisma.Decimal | null;
            LineSubtotal: Prisma.Decimal;
            LineDiscount: Prisma.Decimal;
            LineTax: Prisma.Decimal;
            LineTotal: Prisma.Decimal;
            Notes: string | null;
        }[]
    > {
        const productIds = Array.from(
            new Set(items.map((i) => i.ProductId)),
        );
        const products = await this.prisma.product.findMany({
            where: { Id: { in: productIds }, DeletedAt: null },
            select: { Id: true, IsActive: true, Name: true, TaxRate: true },
        });
        const productMap = new Map(products.map((p) => [p.Id, p]));

        for (const item of items) {
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

        const anyDiscount = items.some(
            (i) => i.Discount !== undefined && i.Discount > 0,
        );
        if (anyDiscount && !opts.hasDiscountPermission) {
            throw new BadRequestException(
                'Applying line discounts requires the sales.discount permission',
            );
        }

        return items.map((item) => {
            const product = productMap.get(item.ProductId)!;
            const qty = new Prisma.Decimal(item.Qty);
            const unitPrice = new Prisma.Decimal(item.UnitPrice);
            const lineSubtotal = qty.mul(unitPrice).toDecimalPlaces(4);

            const discountPct =
                item.Discount !== undefined
                    ? new Prisma.Decimal(item.Discount)
                    : ZERO;
            const lineDiscount = lineSubtotal
                .mul(discountPct)
                .div(100)
                .toDecimalPlaces(4);
            const afterDiscount = lineSubtotal.sub(lineDiscount);

            let taxRate: Prisma.Decimal | null = null;
            if (item.TaxRate !== undefined) {
                taxRate = new Prisma.Decimal(item.TaxRate);
            } else if (product.TaxRate !== null) {
                taxRate = new Prisma.Decimal(product.TaxRate);
            }

            const lineTax = taxRate
                ? afterDiscount.mul(taxRate).div(100).toDecimalPlaces(4)
                : ZERO;

            const lineTotal = afterDiscount.add(lineTax);

            return {
                ProductId: item.ProductId,
                Qty: item.Qty,
                UnitPrice: unitPrice,
                Discount: discountPct,
                TaxRate: taxRate,
                LineSubtotal: lineSubtotal,
                LineDiscount: lineDiscount,
                LineTax: lineTax,
                LineTotal: lineTotal,
                Notes: item.Notes ?? null,
            };
        });
    }

    private async transition(
        id: string,
        from: QuotationStatus,
        to: QuotationStatus,
        actorId: string,
        action: string,
        reason?: string,
    ): Promise<QuotationDetailRow> {
        return this.prisma.$transaction(async (tx) => {
            const current = await tx.quotation.findFirst({
                where: { Id: id, DeletedAt: null },
            });
            if (!current) throw new NotFoundException('Quotation not found');

            if (current.Status !== from) {
                throw new ConflictException(
                    `Cannot transition to ${to} from ${current.Status}. Expected current status: ${from}.`,
                );
            }

            await tx.quotation.update({
                where: { Id: id },
                data: {
                    Status: to,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: action,
                    Entity: 'Quotation',
                    EntityId: id,
                    Before: { Status: from },
                    After: { Status: to },
                    Metadata: reason ? { Reason: reason } : undefined,
                },
                tx,
            );

            return this.findOneInTx(tx, id);
        });
    }

    private async findOneInTx(
        tx: Prisma.TransactionClient,
        id: string,
    ): Promise<QuotationDetailRow> {
        const quote = await tx.quotation.findFirstOrThrow({
            where: { Id: id },
            include: QUOTATION_DETAIL_INCLUDE,
        });
        return {
            ...quote,
            EffectiveStatus: this.effectiveStatus(quote.Status, quote.ValidUntil),
        };
    }
}