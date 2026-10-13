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
import { CustomerChequesService } from '../customer-cheques/customer-cheques.service';
import { CreateCreditPaymentDto } from './dto/create-credit-payment.dto';
import { QueryCreditPaymentDto } from './dto/query-credit-payment.dto';
import { ReverseCreditPaymentDto } from './dto/reverse-credit-payment.dto';

const PAYMENT_CODE_PREFIX = 'CPAY';

const PAYMENT_INCLUDE = {
    Customer: { select: { Id: true, Name: true, Code: true } },
    Cheque: {
        select: {
            Id: true,
            Code: true,
            ChequeNumber: true,
            Status: true,
            DueDate: true,
        },
    },
} as const;

type PaymentRow = Prisma.CreditPaymentGetPayload<{
    include: typeof PAYMENT_INCLUDE;
}>;

@Injectable()
export class CreditPaymentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly cheques: CustomerChequesService,
    ) {}

    // ---------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------

    async list(
        query: QueryCreditPaymentDto,
    ): Promise<PaginatedResponse<PaymentRow>> {
        const where: Prisma.CreditPaymentWhereInput = {};

        if (query.CustomerId) where.CustomerId = query.CustomerId;
        if (query.Method) where.Method = query.Method;
        if (query.excludeReversed) where.ReversedAt = null;

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

        const orderBy: Prisma.CreditPaymentOrderByWithRelationInput = {
            [query.sortBy ?? 'PaidAt']: query.sortOrder,
        };

        return paginate<PaymentRow>(
            this.prisma.creditPayment,
            { where, orderBy, include: PAYMENT_INCLUDE },
            query.page,
            query.limit,
        );
    }

    async findOne(id: string): Promise<PaymentRow> {
        const payment = await this.prisma.creditPayment.findUnique({
            where: { Id: id },
            include: PAYMENT_INCLUDE,
        });
        if (!payment) throw new NotFoundException('Credit payment not found');
        return payment;
    }

    // ---------------------------------------------------------------
    // Create
    // ---------------------------------------------------------------

    async create(
        dto: CreateCreditPaymentDto,
        actorId: string,
    ): Promise<PaymentRow> {
        return this.prisma.$transaction(async (tx) => {
            const customer = await tx.customer.findFirst({
                where: { Id: dto.CustomerId, DeletedAt: null },
                select: { Id: true, IsActive: true, Name: true, Balance: true },
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

            const amount = new Prisma.Decimal(dto.Amount);
            const paidAt = dto.PaidAt ? new Date(dto.PaidAt) : new Date();
            const code = await nextCode(tx, PAYMENT_CODE_PREFIX);

            if (dto.Method === 'CASH') {
                // Balance drops, drawer gains, ledger records the payment.
                const newBalance = new Prisma.Decimal(customer.Balance).sub(
                    amount,
                );

                await tx.customerLedger.create({
                    data: {
                        CustomerId: customer.Id,
                        Type: 'PAYMENT',
                        Amount: amount.neg(),
                        BalanceAfter: newBalance,
                        Notes: dto.Notes ?? `Cash credit payment ${code}`,
                        CreatedByUserId: actorId,
                    },
                });

                await tx.customer.update({
                    where: { Id: customer.Id },
                    data: { Balance: newBalance },
                });

                await tx.cashLedger.create({
                    data: {
                        Type: 'CREDIT_PAYMENT',
                        Amount: amount,
                        Notes: `Credit payment ${code}`,
                        CreatedByUserId: actorId,
                    },
                });

                const payment = await tx.creditPayment.create({
                    data: {
                        Code: code,
                        CustomerId: customer.Id,
                        Method: 'CASH',
                        Amount: amount,
                        PaidAt: paidAt,
                        Notes: dto.Notes ?? null,
                        CreatedByUserId: actorId,
                    },
                });

                await this.audit.log(
                    {
                        UserId: actorId,
                        Action: 'CREDIT_PAYMENT_CREATED',
                        Entity: 'CreditPayment',
                        EntityId: payment.Id,
                        After: payment,
                        Metadata: {
                            CustomerCode: customer.Name,
                            Method: 'CASH',
                        },
                    },
                    tx,
                );

                return tx.creditPayment.findUniqueOrThrow({
                    where: { Id: payment.Id },
                    include: PAYMENT_INCLUDE,
                });
            }

            // -----------------------------------------------------------
            // Method = CHEQUE
            // Create the cheque via the shared helper. It handles the
            // CHEQUE ledger entry and the balance drop. We just record
            // the CreditPayment that links to it.
            // -----------------------------------------------------------

            const cheque = await this.cheques.createOneInTx(
                tx,
                {
                    CustomerId: customer.Id,
                    ChequeNumber: dto.ChequeNumber!,
                    BankName: dto.BankName,
                    BankBranch: dto.BankBranch,
                    Amount: dto.Amount,
                    IssueDate: dto.ChequeIssueDate!,
                    DueDate: dto.ChequeDueDate!,
                    Notes: dto.Notes,
                },
                actorId,
            );

            const payment = await tx.creditPayment.create({
                data: {
                    Code: code,
                    CustomerId: customer.Id,
                    Method: 'CHEQUE',
                    Amount: amount,
                    PaidAt: paidAt,
                    ChequeId: cheque.Id,
                    Notes: dto.Notes ?? null,
                    CreatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'CREDIT_PAYMENT_CREATED',
                    Entity: 'CreditPayment',
                    EntityId: payment.Id,
                    After: payment,
                    Metadata: {
                        CustomerCode: customer.Name,
                        Method: 'CHEQUE',
                        ChequeCode: cheque.Code,
                    },
                },
                tx,
            );

            return tx.creditPayment.findUniqueOrThrow({
                where: { Id: payment.Id },
                include: PAYMENT_INCLUDE,
            });
        });
    }

    // ---------------------------------------------------------------
    // Reverse — only for CASH
    // ---------------------------------------------------------------

    async reverse(
        id: string,
        dto: ReverseCreditPaymentDto,
        actorId: string,
    ): Promise<{ ok: true }> {
        return this.prisma.$transaction(async (tx) => {
            const payment = await tx.creditPayment.findUnique({
                where: { Id: id },
                include: {
                    Customer: { select: { Balance: true } },
                },
            });
            if (!payment) throw new NotFoundException('Credit payment not found');

            if (payment.ReversedAt) {
                throw new ConflictException(
                    'This payment has already been reversed.',
                );
            }

            if (payment.Method !== 'CASH') {
                throw new ConflictException(
                    'Only CASH credit payments can be reversed here. For a cheque payment, bounce or void the cheque instead.',
                );
            }

            const now = new Date();
            const amount = new Prisma.Decimal(payment.Amount);

            // Customer balance goes back up
            const newBalance = new Prisma.Decimal(
                payment.Customer.Balance,
            ).add(amount);

            await tx.customerLedger.create({
                data: {
                    CustomerId: payment.CustomerId,
                    Type: 'PAYMENT_REVERSED',
                    Amount: amount,
                    BalanceAfter: newBalance,
                    Notes: `Credit payment ${payment.Code} reversed: ${dto.Reason}`,
                    CreatedByUserId: actorId,
                },
            });

            await tx.customer.update({
                where: { Id: payment.CustomerId },
                data: { Balance: newBalance },
            });

            // Drawer goes back down
            await tx.cashLedger.create({
                data: {
                    Type: 'CREDIT_PAYMENT_REVERSED',
                    Amount: amount.neg(),
                    Notes: `Credit payment ${payment.Code} reversed: ${dto.Reason}`,
                    CreatedByUserId: actorId,
                },
            });

            await tx.creditPayment.update({
                where: { Id: id },
                data: {
                    ReversedAt: now,
                    ReversedByUserId: actorId,
                    ReversalReason: dto.Reason,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'CREDIT_PAYMENT_REVERSED',
                    Entity: 'CreditPayment',
                    EntityId: id,
                    Before: {
                        Amount: payment.Amount.toString(),
                        Method: payment.Method,
                    },
                    Metadata: { Reason: dto.Reason },
                },
                tx,
            );

            return { ok: true };
        });
    }
}