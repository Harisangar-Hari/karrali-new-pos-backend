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
import { BounceCustomerChequeDto } from './dto/bounce-customer-cheque.dto';
import { BulkCreateCustomerChequeDto } from './dto/bulk-create-customer-cheque.dto';
import { ClearCustomerChequeDto } from './dto/clear-customer-cheque.dto';
import { CreateCustomerChequeDto } from './dto/create-customer-cheque.dto';
import { QueryCustomerChequeDto } from './dto/query-customer-cheque.dto';
import { VoidCustomerChequeDto } from './dto/void-customer-cheque.dto';

const CHEQUE_CODE_PREFIX = 'RCHQ';

const CHEQUE_INCLUDE = {
    Customer: { select: { Id: true, Name: true, Code: true } },
    Sale: { select: { Id: true, InvoiceNumber: true, TotalAmount: true } },
    SalePayment: {
        select: { Id: true, Amount: true, ReversedAt: true },
    },
    CreditPayment: {
        select: { Id: true, Code: true, Amount: true, ReversedAt: true },
    },
} as const;

type ChequeRow = Prisma.CustomerChequeGetPayload<{
    include: typeof CHEQUE_INCLUDE;
}>;

@Injectable()
export class CustomerChequesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) {}

    // ---------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------

    async list(
        query: QueryCustomerChequeDto,
    ): Promise<PaginatedResponse<ChequeRow>> {
        const where: Prisma.CustomerChequeWhereInput = { DeletedAt: null };

        if (query.CustomerId) where.CustomerId = query.CustomerId;
        if (query.SaleId) where.SaleId = query.SaleId;
        if (query.Status) where.Status = query.Status;

        if (query.dueAfter || query.dueBefore) {
            where.DueDate = {};
            if (query.dueAfter) where.DueDate.gte = new Date(query.dueAfter);
            if (query.dueBefore) where.DueDate.lte = new Date(query.dueBefore);
        }

        if (query.search) {
            where.OR = [
                { Code: { contains: query.search, mode: 'insensitive' } },
                { ChequeNumber: { contains: query.search, mode: 'insensitive' } },
                { BankName: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        const orderBy: Prisma.CustomerChequeOrderByWithRelationInput = {
            [query.sortBy ?? 'DueDate']: query.sortOrder,
        };

        return paginate<ChequeRow>(
            this.prisma.customerCheque,
            { where, orderBy, include: CHEQUE_INCLUDE },
            query.page,
            query.limit,
        );
    }

    async findOne(id: string): Promise<ChequeRow> {
        const cheque = await this.prisma.customerCheque.findFirst({
            where: { Id: id, DeletedAt: null },
            include: CHEQUE_INCLUDE,
        });
        if (!cheque) throw new NotFoundException('Cheque not found');
        return cheque;
    }

    // ---------------------------------------------------------------
    // Create (single) — standalone or sale-linked
    // ---------------------------------------------------------------

    async create(
        dto: CreateCustomerChequeDto,
        actorId: string,
    ): Promise<ChequeRow> {
        return this.prisma.$transaction(async (tx) => {
            const created = await this.createOne(tx, dto, actorId);

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'CUSTOMER_CHEQUE_ISSUED',
                    Entity: 'CustomerCheque',
                    EntityId: created.Id,
                    After: created,
                    Metadata: {
                        ChequeNumber: dto.ChequeNumber,
                        SaleId: dto.SaleId ?? null,
                    },
                },
                tx,
            );

            return tx.customerCheque.findUniqueOrThrow({
                where: { Id: created.Id },
                include: CHEQUE_INCLUDE,
            });
        });
    }

    // ---------------------------------------------------------------
    // Bulk create — atomic batch
    // ---------------------------------------------------------------

    async bulkCreate(
        dto: BulkCreateCustomerChequeDto,
        actorId: string,
    ): Promise<{ count: number; items: ChequeRow[] }> {
        return this.prisma.$transaction(async (tx) => {
            const created: { Id: string }[] = [];

            for (const entry of dto.Cheques) {
                const row = await this.createOne(tx, entry, actorId);
                created.push({ Id: row.Id });
            }

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'CUSTOMER_CHEQUE_BULK_ISSUED',
                    Entity: 'CustomerCheque',
                    EntityId: null,
                    Metadata: {
                        Count: created.length,
                        TotalAmount: dto.Cheques
                            .reduce((s, c) => s + c.Amount, 0)
                            .toFixed(4),
                    },
                },
                tx,
            );

            const items = await tx.customerCheque.findMany({
                where: { Id: { in: created.map((c) => c.Id) } },
                include: CHEQUE_INCLUDE,
                orderBy: { CreatedAt: 'asc' },
            });

            return { count: items.length, items };
        });
    }

    // ---------------------------------------------------------------
    // Clear — status only
    // ---------------------------------------------------------------

    async clear(
        id: string,
        dto: ClearCustomerChequeDto,
        actorId: string,
    ): Promise<ChequeRow> {
        return this.prisma.$transaction(async (tx) => {
            const cheque = await tx.customerCheque.findFirst({
                where: { Id: id, DeletedAt: null },
            });
            if (!cheque) throw new NotFoundException('Cheque not found');

            if (cheque.Status !== 'PENDING') {
                throw new ConflictException(
                    `Cannot clear a cheque in ${cheque.Status} status.`,
                );
            }

            const clearedAt = dto.ClearedAt ? new Date(dto.ClearedAt) : new Date();

            await tx.customerCheque.update({
                where: { Id: id },
                data: {
                    Status: 'CLEARED',
                    ClearedAt: clearedAt,
                    Notes: dto.Notes
                        ? cheque.Notes
                            ? `${cheque.Notes}\n\nCleared: ${dto.Notes}`
                            : `Cleared: ${dto.Notes}`
                        : cheque.Notes,
                    UpdatedByUserId: actorId,
                },
            });

            // No ledger effect on clear. Cheque was already applied at issue time.
            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'CUSTOMER_CHEQUE_CLEARED',
                    Entity: 'CustomerCheque',
                    EntityId: id,
                    Before: { Status: 'PENDING' },
                    After: {
                        Status: 'CLEARED',
                        ClearedAt: clearedAt.toISOString(),
                    },
                    Metadata: { ChequeNumber: cheque.ChequeNumber },
                },
                tx,
            );

            return tx.customerCheque.findUniqueOrThrow({
                where: { Id: id },
                include: CHEQUE_INCLUDE,
            });
        });
    }

    // ---------------------------------------------------------------
    // Bounce — reverse ledger effects
    // ---------------------------------------------------------------

    async bounce(
        id: string,
        dto: BounceCustomerChequeDto,
        actorId: string,
    ): Promise<ChequeRow> {
        return this.prisma.$transaction(async (tx) => {
            const cheque = await tx.customerCheque.findFirst({
                where: { Id: id, DeletedAt: null },
                include: {
                    SalePayment: true,
                    CreditPayment: true,
                },
            });
            if (!cheque) throw new NotFoundException('Cheque not found');

            if (cheque.Status !== 'PENDING') {
                throw new ConflictException(
                    `Cannot bounce a cheque in ${cheque.Status} status.`,
                );
            }

            const bouncedAt = dto.BouncedAt
                ? new Date(dto.BouncedAt)
                : new Date();
            const amount = new Prisma.Decimal(cheque.Amount);

            // --- Reverse based on what the cheque was paying ---

            if (cheque.SalePayment) {
                // Cheque paid a sale. Reverse the payment, bump the balance.
                if (!cheque.SalePayment.ReversedAt) {
                    await tx.salePayment.update({
                        where: { Id: cheque.SalePayment.Id },
                        data: {
                            ReversedAt: bouncedAt,
                            ReversedByUserId: actorId,
                            ReversalReason: `Cheque bounced: ${dto.Reason}`,
                        },
                    });

                    await tx.sale.update({
                        where: { Id: cheque.SaleId! },
                        data: { PaidAmount: { decrement: amount } },
                    });
                }
            } else if (cheque.CreditPayment) {
                // Cheque paid down debt. Reverse the CreditPayment.
                if (!cheque.CreditPayment.ReversedAt) {
                    await tx.creditPayment.update({
                        where: { Id: cheque.CreditPayment.Id },
                        data: {
                            ReversedAt: bouncedAt,
                            ReversedByUserId: actorId,
                            ReversalReason: `Cheque bounced: ${dto.Reason}`,
                        },
                    });
                }
            }
            // Standalone cheques (neither SalePayment nor CreditPayment) —
            // there's nothing to reverse; only the customer balance moves.

            // --- Customer ledger + balance: always bumped up ---

            const customer = await tx.customer.findUniqueOrThrow({
                where: { Id: cheque.CustomerId },
                select: { Balance: true },
            });
            const newBalance = new Prisma.Decimal(customer.Balance).add(amount);

            await tx.customerLedger.create({
                data: {
                    CustomerId: cheque.CustomerId,
                    Type: 'CHEQUE_BOUNCED',
                    Amount: amount,
                    BalanceAfter: newBalance,
                    SaleId: cheque.SaleId,
                    ChequeId: cheque.Id,
                    Notes: `Cheque ${cheque.ChequeNumber} bounced: ${dto.Reason}`,
                    CreatedByUserId: actorId,
                },
            });
            await tx.customer.update({
                where: { Id: cheque.CustomerId },
                data: { Balance: newBalance },
            });

            // --- Status update ---

            await tx.customerCheque.update({
                where: { Id: id },
                data: {
                    Status: 'BOUNCED',
                    BouncedAt: bouncedAt,
                    BounceReason: dto.Reason,
                    Notes: dto.Notes
                        ? cheque.Notes
                            ? `${cheque.Notes}\n\nBounced: ${dto.Notes}`
                            : `Bounced: ${dto.Notes}`
                        : cheque.Notes,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'CUSTOMER_CHEQUE_BOUNCED',
                    Entity: 'CustomerCheque',
                    EntityId: id,
                    Before: { Status: 'PENDING' },
                    After: {
                        Status: 'BOUNCED',
                        BouncedAt: bouncedAt.toISOString(),
                    },
                    Metadata: {
                        ChequeNumber: cheque.ChequeNumber,
                        Reason: dto.Reason,
                        HadSalePayment: !!cheque.SalePayment,
                        HadCreditPayment: !!cheque.CreditPayment,
                    },
                },
                tx,
            );

            return tx.customerCheque.findUniqueOrThrow({
                where: { Id: id },
                include: CHEQUE_INCLUDE,
            });
        });
    }

    // ---------------------------------------------------------------
    // Void — same reversal as bounce, different semantic
    // ---------------------------------------------------------------

    async void(
        id: string,
        dto: VoidCustomerChequeDto,
        actorId: string,
    ): Promise<ChequeRow> {
        return this.prisma.$transaction(async (tx) => {
            const cheque = await tx.customerCheque.findFirst({
                where: { Id: id, DeletedAt: null },
                include: {
                    SalePayment: true,
                    CreditPayment: true,
                },
            });
            if (!cheque) throw new NotFoundException('Cheque not found');

            if (cheque.Status !== 'PENDING') {
                throw new ConflictException(
                    `Cannot void a cheque in ${cheque.Status} status. Only PENDING cheques can be voided.`,
                );
            }

            const now = new Date();
            const amount = new Prisma.Decimal(cheque.Amount);

            // Reverse payment references (same logic as bounce)
            if (cheque.SalePayment && !cheque.SalePayment.ReversedAt) {
                await tx.salePayment.update({
                    where: { Id: cheque.SalePayment.Id },
                    data: {
                        ReversedAt: now,
                        ReversedByUserId: actorId,
                        ReversalReason: `Cheque voided: ${dto.Reason}`,
                    },
                });
                await tx.sale.update({
                    where: { Id: cheque.SaleId! },
                    data: { PaidAmount: { decrement: amount } },
                });
            } else if (cheque.CreditPayment && !cheque.CreditPayment.ReversedAt) {
                await tx.creditPayment.update({
                    where: { Id: cheque.CreditPayment.Id },
                    data: {
                        ReversedAt: now,
                        ReversedByUserId: actorId,
                        ReversalReason: `Cheque voided: ${dto.Reason}`,
                    },
                });
            }

            // Customer ledger + balance
            const customer = await tx.customer.findUniqueOrThrow({
                where: { Id: cheque.CustomerId },
                select: { Balance: true },
            });
            const newBalance = new Prisma.Decimal(customer.Balance).add(amount);

            await tx.customerLedger.create({
                data: {
                    CustomerId: cheque.CustomerId,
                    Type: 'CHEQUE_VOIDED',
                    Amount: amount,
                    BalanceAfter: newBalance,
                    SaleId: cheque.SaleId,
                    ChequeId: cheque.Id,
                    Notes: `Cheque ${cheque.ChequeNumber} voided: ${dto.Reason}`,
                    CreatedByUserId: actorId,
                },
            });
            await tx.customer.update({
                where: { Id: cheque.CustomerId },
                data: { Balance: newBalance },
            });

            await tx.customerCheque.update({
                where: { Id: id },
                data: {
                    Status: 'VOIDED',
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'CUSTOMER_CHEQUE_VOIDED',
                    Entity: 'CustomerCheque',
                    EntityId: id,
                    Before: { Status: 'PENDING' },
                    After: { Status: 'VOIDED' },
                    Metadata: {
                        ChequeNumber: cheque.ChequeNumber,
                        Reason: dto.Reason,
                    },
                },
                tx,
            );

            return tx.customerCheque.findUniqueOrThrow({
                where: { Id: id },
                include: CHEQUE_INCLUDE,
            });
        });
    }

    // ---------------------------------------------------------------
    // Internal — shared by create() and bulkCreate()
    // ---------------------------------------------------------------

     private async createOne(
        tx: Prisma.TransactionClient,
        dto: CreateCustomerChequeDto,
        actorId: string,
    ): Promise<{ Id: string; Code: string }>  {
        const customer = await tx.customer.findFirst({
            where: { Id: dto.CustomerId, DeletedAt: null },
            select: { Id: true, IsActive: true, Name: true },
        });
        if (!customer) {
            throw new BadRequestException('Customer not found or has been deleted');
        }
        if (!customer.IsActive) {
            throw new BadRequestException(`Customer "${customer.Name}" is inactive`);
        }

        // If SaleId given, verify it exists and belongs to this customer.
        if (dto.SaleId) {
            const sale = await tx.sale.findFirst({
                where: { Id: dto.SaleId, DeletedAt: null },
                select: { Id: true, CustomerId: true, Status: true },
            });
            if (!sale) throw new BadRequestException('Sale not found');
            if (sale.CustomerId !== dto.CustomerId) {
                throw new BadRequestException(
                    'Sale does not belong to this customer.',
                );
            }
            if (sale.Status === 'CANCELLED') {
                throw new BadRequestException(
                    'Cannot attach a cheque to a cancelled sale.',
                );
            }
        }

        const code = await nextCode(tx, CHEQUE_CODE_PREFIX);
        const amount = new Prisma.Decimal(dto.Amount);

        const cheque = await tx.customerCheque.create({
            data: {
                Code: code,
                CustomerId: dto.CustomerId,
                SaleId: dto.SaleId ?? null,
                ChequeNumber: dto.ChequeNumber,
                BankName: dto.BankName ?? null,
                BankBranch: dto.BankBranch ?? null,
                Amount: amount,
                IssueDate: new Date(dto.IssueDate),
                DueDate: new Date(dto.DueDate),
                Status: 'PENDING',
                Notes: dto.Notes ?? null,
                CreatedByUserId: actorId,
                UpdatedByUserId: actorId,
            },
        });

        // Customer ledger entry: cheque reduces outstanding balance immediately.
        // Customer credit is now "settled by paper" until it clears or bounces.
        const customerRecord = await tx.customer.findUniqueOrThrow({
            where: { Id: dto.CustomerId },
            select: { Balance: true },
        });
        const newBalance = new Prisma.Decimal(customerRecord.Balance).sub(amount);

        await tx.customerLedger.create({
            data: {
                CustomerId: dto.CustomerId,
                Type: 'CHEQUE',
                Amount: amount.neg(),
                BalanceAfter: newBalance,
                SaleId: dto.SaleId ?? null,
                ChequeId: cheque.Id,
                Notes: `Cheque ${dto.ChequeNumber} received`,
                CreatedByUserId: actorId,
            },
        });
        await tx.customer.update({
            where: { Id: dto.CustomerId },
            data: { Balance: newBalance },
        });

        return { Id: cheque.Id, Code: cheque.Code };
    }

     /**
     * Public variant of `createOne` for use by other services that need
     * to create a cheque inside their own transaction. Runs the exact
     * same validation + ledger effect as the HTTP create path so
     * balance and ledger stay consistent.
     */
    async createOneInTx(
        tx: Prisma.TransactionClient,
        dto: CreateCustomerChequeDto,
        actorId: string,
    ): Promise<{ Id: string; Code: string }> {
        return this.createOne(tx, dto, actorId);
    }
}