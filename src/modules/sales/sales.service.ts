import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma, SalePaymentMethod } from '@prisma/client';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { nextCode } from '../../common/utils/code.util';
import { paginate } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StockService } from '../stock/stock.service';
import { CancelSaleDto } from './dto/cancel-sale.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { QuerySaleDto } from './dto/query-sale.dto';

const SALE_LIST_INCLUDE = {
    Terminal: { select: { Id: true, Name: true, Code: true } },
    Cashier: { select: { Id: true, Username: true, FullName: true } },
    Customer: { select: { Id: true, Name: true, Code: true } },
} as const;

const SALE_DETAIL_INCLUDE = {
    ...SALE_LIST_INCLUDE,
    Warehouse: { select: { Id: true, Name: true, Code: true } },
    Items: {
        include: {
            Product: { select: { Id: true, Name: true, SKU: true, Barcode: true } },
        },
    },
    Payments: {
        include: {
            Cheque: { select: { Id: true, Code: true, ChequeNumber: true, Status: true } },
        },
        orderBy: { CreatedAt: 'asc' },
    },
    Returns: { orderBy: { CreatedAt: 'asc' } },
    Cheques: { orderBy: { IssueDate: 'asc' } },
} as const;

type SaleListRow = Prisma.SaleGetPayload<{ include: typeof SALE_LIST_INCLUDE }>;
type SaleDetailRow = Prisma.SaleGetPayload<{ include: typeof SALE_DETAIL_INCLUDE }>;

const ZERO = new Prisma.Decimal(0);
const EPSILON = new Prisma.Decimal('0.0001');

export interface CreateSaleOptions {
    hasDiscountPermission: boolean;
}

@Injectable()
export class SalesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly stock: StockService,
    ) {}

    // ---------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------

    async list(query: QuerySaleDto): Promise<PaginatedResponse<SaleListRow>> {
        const where: Prisma.SaleWhereInput = { DeletedAt: null };

        if (query.TerminalId) where.TerminalId = query.TerminalId;
        if (query.CashierId) where.CashierId = query.CashierId;
        if (query.CustomerId) where.CustomerId = query.CustomerId;
        if (query.Status) where.Status = query.Status;
        if (query.hasCredit) where.CreditAmount = { gt: 0 };

        if (query.From || query.To) {
            where.CreatedAt = {};
            if (query.From) where.CreatedAt.gte = new Date(query.From);
            if (query.To) where.CreatedAt.lte = new Date(query.To);
        }

        if (query.search) {
            where.OR = [
                { InvoiceNumber: { contains: query.search, mode: 'insensitive' } },
                { Notes: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        const orderBy: Prisma.SaleOrderByWithRelationInput = {
            [query.sortBy ?? 'CreatedAt']: query.sortOrder,
        };

        return paginate<SaleListRow>(
            this.prisma.sale,
            { where, orderBy, include: SALE_LIST_INCLUDE },
            query.page,
            query.limit,
        );
    }

    async findOne(id: string): Promise<SaleDetailRow> {
        const sale = await this.prisma.sale.findFirst({
            where: { Id: id, DeletedAt: null },
            include: SALE_DETAIL_INCLUDE,
        });
        if (!sale) throw new NotFoundException('Sale not found');
        return sale;
    }

    // ---------------------------------------------------------------
    // Checkout
    // ---------------------------------------------------------------

    async create(
        dto: CreateSaleDto,
        actorId: string,
        opts: CreateSaleOptions,
    ): Promise<SaleDetailRow> {
        // --- 1. Validate terminal, warehouse, customer ---

        const terminal = await this.prisma.terminal.findFirst({
            where: { Id: dto.TerminalId, DeletedAt: null },
            select: { Id: true, Code: true, IsActive: true, WarehouseId: true },
        });
        if (!terminal) {
            throw new BadRequestException('Terminal not found or has been deleted');
        }
        if (!terminal.IsActive) {
            throw new BadRequestException(`Terminal ${terminal.Code} is inactive`);
        }

        const warehouse = await this.prisma.warehouse.findFirst({
            where: { Id: terminal.WarehouseId, DeletedAt: null },
            select: { Id: true, IsActive: true, Name: true },
        });
        if (!warehouse || !warehouse.IsActive) {
            throw new BadRequestException(
                `Terminal's warehouse is inactive or missing`,
            );
        }

        // Determine if any payment is credit — customer then required.
        const hasCredit = dto.Payments.some(
            (p) => p.Method === SalePaymentMethod.CREDIT,
        );
        const hasCheque = dto.Payments.some(
            (p) => p.Method === SalePaymentMethod.CHEQUE,
        );

        if ((hasCredit || hasCheque) && !dto.CustomerId) {
            throw new BadRequestException(
                'CustomerId is required when the sale includes a CREDIT or CHEQUE payment',
            );
        }

        let customer: {
            Id: string;
            CreditLimit: Prisma.Decimal;
            Balance: Prisma.Decimal;
            Name: string;
        } | null = null;

        if (dto.CustomerId) {
            const found = await this.prisma.customer.findFirst({
                where: { Id: dto.CustomerId, DeletedAt: null },
                select: { Id: true, CreditLimit: true, Balance: true, IsActive: true, Name: true },
            });
            if (!found) {
                throw new BadRequestException('Customer not found or has been deleted');
            }
            if (!found.IsActive) {
                throw new BadRequestException(`Customer "${found.Name}" is inactive`);
            }
            customer = found;
        }

        // --- 2. Validate products, compute line totals ---

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
                throw new BadRequestException(`Product "${p.Name}" is inactive`);
            }
        }

        // Discount permission check
        const anyDiscount = dto.Items.some(
            (i) => i.Discount !== undefined && i.Discount > 0,
        );
        if (anyDiscount && !opts.hasDiscountPermission) {
            throw new ForbiddenException(
                'Applying line discounts requires the sales.discount permission',
            );
        }

        const lines = dto.Items.map((item) => {
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

        const subtotal = lines.reduce((s, l) => s.add(l.LineSubtotal), ZERO);
        const discountAmount = lines.reduce((s, l) => s.add(l.LineDiscount), ZERO);
        const taxAmount = lines.reduce((s, l) => s.add(l.LineTax), ZERO);
        const totalAmount = subtotal.sub(discountAmount).add(taxAmount);

        // --- 3. Validate payment totals + credit limit ---

        const payments = dto.Payments.map((p) => ({
            Method: p.Method,
            Amount: new Prisma.Decimal(p.Amount),
            Cheque: p,
        }));

        const paidSum = payments.reduce((s, p) => s.add(p.Amount), ZERO);
        const diff = paidSum.sub(totalAmount).abs();
        if (diff.gt(EPSILON)) {
            throw new BadRequestException(
                `Payment total ${paidSum.toString()} does not match sale total ${totalAmount.toString()}`,
            );
        }

        // Group amounts by method.
        let cashAmount = ZERO;
        let cardAmount = ZERO;
        let creditAmount = ZERO;
        let chequeAmount = ZERO;
        for (const p of payments) {
            switch (p.Method) {
                case SalePaymentMethod.CASH:
                    cashAmount = cashAmount.add(p.Amount);
                    break;
                case SalePaymentMethod.CARD:
                    cardAmount = cardAmount.add(p.Amount);
                    break;
                case SalePaymentMethod.CREDIT:
                    creditAmount = creditAmount.add(p.Amount);
                    break;
                case SalePaymentMethod.CHEQUE:
                    chequeAmount = chequeAmount.add(p.Amount);
                    break;
            }
        }

        // Enforce credit limit if credit taken
        if (creditAmount.gt(0) && customer) {
            const newBalance = new Prisma.Decimal(customer.Balance).add(creditAmount);
            if (newBalance.gt(customer.CreditLimit)) {
                const available = new Prisma.Decimal(customer.CreditLimit).sub(
                    customer.Balance,
                );
                throw new BadRequestException(
                    `Credit limit exceeded for ${customer.Name}. Available: ${available.toString()}, requested: ${creditAmount.toString()}.`,
                );
            }
        }

        // --- 4. Atomic checkout ---

        return this.prisma.$transaction(async (tx) => {
            const invoiceNumber = await nextCode(tx, terminal.Code, 6);
            const now = new Date();

            const sale = await tx.sale.create({
                data: {
                    InvoiceNumber: invoiceNumber,
                    TerminalId: terminal.Id,
                    WarehouseId: warehouse.Id,
                    CashierId: actorId,
                    CustomerId: dto.CustomerId ?? null,
                    Subtotal: subtotal,
                    DiscountAmount: discountAmount,
                    TaxAmount: taxAmount,
                    TotalAmount: totalAmount,
                    CashAmount: cashAmount,
                    CardAmount: cardAmount,
                    CreditAmount: creditAmount,
                    ChequeAmount: chequeAmount,
                    PaidAmount: cashAmount.add(cardAmount).add(chequeAmount),
                    RefundedAmount: ZERO,
                    Status: 'COMPLETED',
                    Notes: dto.Notes ?? null,
                    CreatedByUserId: actorId,
                    UpdatedByUserId: actorId,
                },
            });

            await tx.saleItem.createMany({
                data: lines.map((l) => ({
                    SaleId: sale.Id,
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

            // Cheques first (SalePayment references them)
            const chequeIdByPaymentIndex = new Map<number, string>();
            for (let i = 0; i < payments.length; i++) {
                const p = payments[i];
                if (p.Method !== SalePaymentMethod.CHEQUE) continue;

                const chequeCode = await nextCode(tx, 'RCHQ');
                const cheque = await tx.customerCheque.create({
                    data: {
                        Code: chequeCode,
                        CustomerId: dto.CustomerId!,
                        SaleId: sale.Id,
                        ChequeNumber: p.Cheque.ChequeNumber!,
                        BankName: p.Cheque.BankName ?? null,
                        BankBranch: p.Cheque.BankBranch ?? null,
                        Amount: p.Amount,
                        IssueDate: new Date(p.Cheque.ChequeIssueDate!),
                        DueDate: new Date(p.Cheque.ChequeDueDate!),
                        Status: 'PENDING',
                        Notes: p.Cheque.Notes ?? null,
                        CreatedByUserId: actorId,
                        UpdatedByUserId: actorId,
                    },
                });
                chequeIdByPaymentIndex.set(i, cheque.Id);
            }

            // SalePayments
            for (let i = 0; i < payments.length; i++) {
                const p = payments[i];
                await tx.salePayment.create({
                    data: {
                        SaleId: sale.Id,
                        Method: p.Method,
                        Amount: p.Amount,
                        ChequeId: chequeIdByPaymentIndex.get(i) ?? null,
                        Notes: p.Cheque.Notes ?? null,
                        CreatedByUserId: actorId,
                    },
                });
            }

            // Stock movements
            for (const l of lines) {
                await this.stock.adjustStock(
                    {
                        ProductId: l.ProductId,
                        WarehouseId: warehouse.Id,
                        Quantity: -l.Qty,
                        Type: 'SALE',
                        UnitCost: Number(l.UnitPrice),
                        SaleId: sale.Id,
                        Notes: `Sale ${invoiceNumber}`,
                        ActorId: actorId,
                    },
                    tx,
                );
            }

            // Cash ledger — only for physical cash
            if (cashAmount.gt(0)) {
                await tx.cashLedger.create({
                    data: {
                        Type: 'SALE',
                        Amount: cashAmount,
                        SaleId: sale.Id,
                        Notes: `Sale ${invoiceNumber}`,
                        CreatedByUserId: actorId,
                    },
                });
            }

            // Customer ledger — only for the credit portion
            if (creditAmount.gt(0) && customer) {
                const newBalance = new Prisma.Decimal(customer.Balance).add(
                    creditAmount,
                );
                await tx.customerLedger.create({
                    data: {
                        CustomerId: customer.Id,
                        Type: 'SALE',
                        Amount: creditAmount,
                        BalanceAfter: newBalance,
                        SaleId: sale.Id,
                        Notes: `Credit portion of sale ${invoiceNumber}`,
                        CreatedByUserId: actorId,
                    },
                });
                await tx.customer.update({
                    where: { Id: customer.Id },
                    data: { Balance: newBalance },
                });
            }

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'SALE_CREATED',
                    Entity: 'Sale',
                    EntityId: sale.Id,
                    After: sale,
                    Metadata: {
                        InvoiceNumber: invoiceNumber,
                        ItemCount: lines.length,
                        CashAmount: cashAmount.toString(),
                        CardAmount: cardAmount.toString(),
                        CreditAmount: creditAmount.toString(),
                        ChequeAmount: chequeAmount.toString(),
                    },
                },
                tx,
            );

            return tx.sale.findUniqueOrThrow({
                where: { Id: sale.Id },
                include: SALE_DETAIL_INCLUDE,
            });
        });
    }

    // ---------------------------------------------------------------
    // Cancel
    // ---------------------------------------------------------------

    async cancel(
        id: string,
        dto: CancelSaleDto,
        actorId: string,
    ): Promise<SaleDetailRow> {
        return this.prisma.$transaction(async (tx) => {
            const sale = await tx.sale.findFirst({
                where: { Id: id, DeletedAt: null },
                include: {
                    Items: true,
                    Customer: { select: { Id: true, Balance: true } },
                },
            });
            if (!sale) throw new NotFoundException('Sale not found');

            if (sale.Status !== 'COMPLETED') {
                throw new ConflictException(
                    `Cannot cancel a sale in ${sale.Status} status. Use returns instead.`,
                );
            }

            // Block if any cheque (PENDING or CLEARED) is attached.
            const cheques = await tx.customerCheque.findMany({
                where: { SaleId: id },
                select: { Id: true, Code: true, Status: true },
            });
            const pending = cheques.filter((c) => c.Status === 'PENDING');
            const cleared = cheques.filter((c) => c.Status === 'CLEARED');

            if (cleared.length > 0) {
                throw new ConflictException(
                    `Cannot cancel — ${cleared.length} cheque(s) have already cleared. Process a sale return instead.`,
                );
            }
            if (pending.length > 0) {
                throw new ConflictException(
                    `Cannot cancel — ${pending.length} pending cheque(s) reference this sale. Void them first.`,
                );
            }

            // Reverse stock
            for (const item of sale.Items) {
                await this.stock.adjustStock(
                    {
                        ProductId: item.ProductId,
                        WarehouseId: sale.WarehouseId,
                        Quantity: item.Qty,
                        Type: 'SALE_RETURN',
                        UnitCost: Number(item.UnitPrice),
                        SaleId: sale.Id,
                        Notes: `Sale ${sale.InvoiceNumber} cancelled`,
                        ActorId: actorId,
                    },
                    tx,
                );
            }

            // Refund cash portion (if any)
            const cashAmount = new Prisma.Decimal(sale.CashAmount);
            if (cashAmount.gt(0)) {
                await tx.cashLedger.create({
                    data: {
                        Type: 'SALE_REFUND',
                        Amount: cashAmount.neg(),
                        SaleId: sale.Id,
                        Notes: `Refund for cancelled sale ${sale.InvoiceNumber}`,
                        CreatedByUserId: actorId,
                    },
                });
            }

            // Reverse credit portion (if any)
            const creditAmount = new Prisma.Decimal(sale.CreditAmount);
            if (creditAmount.gt(0) && sale.Customer) {
                const newBalance = new Prisma.Decimal(sale.Customer.Balance).sub(
                    creditAmount,
                );
                await tx.customerLedger.create({
                    data: {
                        CustomerId: sale.Customer.Id,
                        Type: 'SALE_RETURN',
                        Amount: creditAmount.neg(),
                        BalanceAfter: newBalance,
                        SaleId: sale.Id,
                        Notes: `Credit reversed on cancellation of ${sale.InvoiceNumber}`,
                        CreatedByUserId: actorId,
                    },
                });
                await tx.customer.update({
                    where: { Id: sale.Customer.Id },
                    data: { Balance: newBalance },
                });
            }

            // Note: card payments cannot be reversed through the system.
            // The accountant handles that via the bank. We simply don't
            // write a cash or customer ledger entry for the card portion.

            const updated = await tx.sale.update({
                where: { Id: id },
                data: {
                    Status: 'CANCELLED',
                    CancelledAt: new Date(),
                    CancelledByUserId: actorId,
                    CancelReason: dto.Reason,
                    UpdatedByUserId: actorId,
                },
                include: SALE_DETAIL_INCLUDE,
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'SALE_CANCELLED',
                    Entity: 'Sale',
                    EntityId: id,
                    Before: { Status: 'COMPLETED', InvoiceNumber: sale.InvoiceNumber },
                    After: { Status: 'CANCELLED' },
                    Metadata: {
                        Reason: dto.Reason,
                        CashRefunded: sale.CashAmount.toString(),
                        CreditReversed: sale.CreditAmount.toString(),
                        CardPortion: sale.CardAmount.toString(),
                    },
                },
                tx,
            );

            return updated;
        });
    }
}