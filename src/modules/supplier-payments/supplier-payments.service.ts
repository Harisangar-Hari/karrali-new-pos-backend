import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma, SupplierPayment } from '@prisma/client';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { nextCode } from '../../common/utils/code.util';
import { paginate } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto';
import { QuerySupplierPaymentDto } from './dto/query-supplier-payment.dto';
import { ReverseSupplierPaymentDto } from './dto/reverse-supplier-payment.dto';

const PAYMENT_CODE_PREFIX = 'PAY';

const PAYMENT_INCLUDE = {
    Supplier: { select: { Id: true, Name: true, Code: true } },
    Purchase: {
        select: {
            Id: true,
            Code: true,
            TotalAmount: true,
            PaidAmount: true,
            Status: true,
        },
    },
} as const;

type PaymentRow = Prisma.SupplierPaymentGetPayload<{
    include: typeof PAYMENT_INCLUDE;
}>;

/**
 * Internal input for the cheque-clearing flow (SupplierCheques module).
 * Not exposed via HTTP — the cheque service calls this inside its own
 * transaction so the payment + purchase.PaidAmount update are atomic
 * with the cheque status change.
 */
export interface CreatePaymentFromChequeInput {
    ChequeId: string;
    ChequeCode: string;
    SupplierId: string;
    PurchaseId: string;
    Amount: Prisma.Decimal;
    PaidAt: Date;
    ActorId: string;
}

@Injectable()
export class SupplierPaymentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    // ---------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------

    async list(
        query: QuerySupplierPaymentDto,
    ): Promise<PaginatedResponse<PaymentRow>> {
        const where: Prisma.SupplierPaymentWhereInput = {};

        if (query.SupplierId) where.SupplierId = query.SupplierId;
        if (query.PurchaseId) where.PurchaseId = query.PurchaseId;
        if (query.Method) where.Method = query.Method;

        if (query.From || query.To) {
            where.PaidAt = {};
            if (query.From) where.PaidAt.gte = new Date(query.From);
            if (query.To) where.PaidAt.lte = new Date(query.To);
        }

        if (query.search) {
            where.OR = [
                { Code: { contains: query.search, mode: 'insensitive' } },
                { Notes: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        const orderBy: Prisma.SupplierPaymentOrderByWithRelationInput = {
            [query.sortBy ?? 'PaidAt']: query.sortOrder,
        };

        return paginate<PaymentRow>(
            this.prisma.supplierPayment,
            { where, orderBy, include: PAYMENT_INCLUDE },
            query.page,
            query.limit,
        );
    }

    async findOne(id: string): Promise<PaymentRow> {
        const payment = await this.prisma.supplierPayment.findUnique({
            where: { Id: id },
            include: PAYMENT_INCLUDE,
        });
        if (!payment) throw new NotFoundException('Payment not found');
        return payment;
    }

    // ---------------------------------------------------------------
    // Create — CASH / BANK_TRANSFER only
    // ---------------------------------------------------------------

    async create(
        dto: CreateSupplierPaymentDto,
        actorId: string,
    ): Promise<PaymentRow> {
        if (dto.Method === 'CHEQUE') {
            throw new BadRequestException(
                'CHEQUE payments are created by clearing a SupplierCheque, not here.',
            );
        }

        const amount = new Prisma.Decimal(dto.Amount);

        // --- Eager validation outside the tx ---

        const purchase = await this.prisma.purchase.findFirst({
            where: { Id: dto.PurchaseId, DeletedAt: null },
            include: {
                Supplier: {
                    select: { Id: true, IsActive: true, DeletedAt: true },
                },
            },
        });
        if (!purchase) throw new NotFoundException('Purchase not found');

        if (purchase.Status !== 'POSTED') {
            throw new ConflictException(
                `Cannot record a payment against a ${purchase.Status} purchase.`,
            );
        }
        if (
            !purchase.Supplier ||
            purchase.Supplier.DeletedAt ||
            !purchase.Supplier.IsActive
        ) {
            throw new BadRequestException(
                'Purchase supplier is inactive or deleted.',
            );
        }

        const remaining = new Prisma.Decimal(purchase.TotalAmount).sub(
            purchase.PaidAmount,
        );
        if (amount.greaterThan(remaining)) {
            throw new BadRequestException(
                `Amount exceeds the remaining balance of ${remaining.toString()}.`,
            );
        }

        // --- Atomic write ---

        return this.prisma.$transaction(async (tx) => {
            const code = await nextCode(tx, PAYMENT_CODE_PREFIX);
            const paidAt = dto.PaidAt ? new Date(dto.PaidAt) : new Date();

            const payment = await tx.supplierPayment.create({
                data: {
                    Code: code,
                    SupplierId: purchase.SupplierId,
                    PurchaseId: purchase.Id,
                    Method: dto.Method,
                    Amount: amount,
                    PaidAt: paidAt,
                    Notes: dto.Notes ?? null,
                    CreatedByUserId: actorId,
                    UpdatedByUserId: actorId,
                },
            });

            await tx.purchase.update({
                where: { Id: purchase.Id },
                data: { PaidAmount: { increment: amount } },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'SUPPLIER_PAYMENT_CREATED',
                    Entity: 'SupplierPayment',
                    EntityId: payment.Id,
                    After: payment,
                    Metadata: {
                        PurchaseCode: purchase.Code,
                        Method: dto.Method,
                    },
                },
                tx,
            );

            return tx.supplierPayment.findUniqueOrThrow({
                where: { Id: payment.Id },
                include: PAYMENT_INCLUDE,
            });
        });
    }

    // ---------------------------------------------------------------
    // Internal — called by SupplierChequesService on cheque clear.
    // Runs inside the caller's transaction. Does NOT write its own
    // audit row — the cheque-clearing audit row covers this.
    // ---------------------------------------------------------------

    async createFromCheque(
        input: CreatePaymentFromChequeInput,
        tx: Prisma.TransactionClient,
    ): Promise<SupplierPayment> {
        const code = await nextCode(tx, PAYMENT_CODE_PREFIX);

        const payment = await tx.supplierPayment.create({
            data: {
                Code: code,
                SupplierId: input.SupplierId,
                PurchaseId: input.PurchaseId,
                Method: 'CHEQUE',
                Amount: input.Amount,
                PaidAt: input.PaidAt,
                ChequeId: input.ChequeId,
                Notes: `Auto-created when cheque ${input.ChequeCode} cleared`,
                CreatedByUserId: input.ActorId,
                UpdatedByUserId: input.ActorId,
            },
        });

        await tx.purchase.update({
            where: { Id: input.PurchaseId },
            data: { PaidAmount: { increment: input.Amount } },
        });

        return payment;
    }

    // ---------------------------------------------------------------
    // Reverse — delete a payment and roll back purchase.PaidAmount.
    // Blocked for CHEQUE-method payments (managed by the cheque module).
    // ---------------------------------------------------------------

    async reverse(
        id: string,
        dto: ReverseSupplierPaymentDto,
        actorId: string,
    ): Promise<{ ok: true }> {
        const payment = await this.prisma.supplierPayment.findUnique({
            where: { Id: id },
            include: { Purchase: { select: { Id: true, Code: true } } },
        });
        if (!payment) throw new NotFoundException('Payment not found');

        if (payment.Method === 'CHEQUE') {
            throw new ConflictException(
                'Cheque payments cannot be reversed here — handle via the cheque module (bounce or void the cheque).',
            );
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.purchase.update({
                where: { Id: payment.PurchaseId },
                data: { PaidAmount: { decrement: payment.Amount } },
            });

            await tx.supplierPayment.delete({ where: { Id: id } });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'SUPPLIER_PAYMENT_REVERSED',
                    Entity: 'SupplierPayment',
                    EntityId: id,
                    Before: payment,
                    Metadata: {
                        Reason: dto.Reason,
                        PurchaseCode: payment.Purchase.Code,
                    },
                },
                tx,
            );
        });

        return { ok: true };
    }
}