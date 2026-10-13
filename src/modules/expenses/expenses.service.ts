import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Expense, Prisma } from '@prisma/client';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { CatalogGuardsService } from '../../common/services/catalog-guards.service';
import { nextCode } from '../../common/utils/code.util';
import { paginate } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { QueryExpenseDto } from './dto/query-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

const EXPENSE_CODE_PREFIX = 'EXP';

const EXPENSE_INCLUDE = {
    Category: { select: { Id: true, Name: true } },
    BankAccount: { select: { Id: true, Name: true, BankName: true } },
} as const;

type ExpenseRow = Prisma.ExpenseGetPayload<{ include: typeof EXPENSE_INCLUDE }>;

@Injectable()
export class ExpensesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly guards: CatalogGuardsService,
    ) {}

    // ---------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------

    async list(query: QueryExpenseDto): Promise<PaginatedResponse<ExpenseRow>> {
        const where: Prisma.ExpenseWhereInput = { DeletedAt: null };

        if (query.CategoryId) where.CategoryId = query.CategoryId;
        if (query.BankAccountId) where.BankAccountId = query.BankAccountId;
        if (query.Method) where.Method = query.Method;

        if (query.From || query.To) {
            where.PaidAt = {};
            if (query.From) where.PaidAt.gte = new Date(query.From);
            if (query.To) where.PaidAt.lte = new Date(query.To);
        }

        if (query.search) {
            where.OR = [
                { Code: { contains: query.search, mode: 'insensitive' } },
                { Description: { contains: query.search, mode: 'insensitive' } },
                { Payee: { contains: query.search, mode: 'insensitive' } },
                { Notes: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        const orderBy: Prisma.ExpenseOrderByWithRelationInput = {
            [query.sortBy ?? 'PaidAt']: query.sortOrder,
        };

        return paginate<ExpenseRow>(
            this.prisma.expense,
            { where, orderBy, include: EXPENSE_INCLUDE },
            query.page,
            query.limit,
        );
    }

    async findOne(id: string): Promise<ExpenseRow> {
        const expense = await this.prisma.expense.findFirst({
            where: { Id: id, DeletedAt: null },
            include: EXPENSE_INCLUDE,
        });
        if (!expense) throw new NotFoundException('Expense not found');
        return expense;
    }

    // ---------------------------------------------------------------
    // Create
    // ---------------------------------------------------------------

    async create(dto: CreateExpenseDto, actorId: string): Promise<ExpenseRow> {
        await this.guards.assertExpenseCategoryUsable(dto.CategoryId);

        // Bank-account coherence
        if (dto.Method === 'BANK') {
            if (!dto.BankAccountId) {
                throw new BadRequestException(
                    'BankAccountId is required when Method = BANK',
                );
            }
            await this.guards.assertBankAccountUsable(dto.BankAccountId);
        } else {
            // CASH — a bank account makes no sense
            if (dto.BankAccountId) {
                throw new BadRequestException(
                    'BankAccountId must be omitted when Method = CASH',
                );
            }
        }

        const amount = new Prisma.Decimal(dto.Amount);
        const paidAt = dto.PaidAt ? new Date(dto.PaidAt) : new Date();

        return this.prisma.$transaction(async (tx) => {
            const code = await nextCode(tx, EXPENSE_CODE_PREFIX);

            const expense = await tx.expense.create({
                data: {
                    Code: code,
                    CategoryId: dto.CategoryId,
                    Amount: amount,
                    Method: dto.Method,
                    BankAccountId:
                        dto.Method === 'BANK' ? dto.BankAccountId! : null,
                    Description: dto.Description,
                    Payee: dto.Payee ?? null,
                    PaidAt: paidAt,
                    Notes: dto.Notes ?? null,
                    CreatedByUserId: actorId,
                    UpdatedByUserId: actorId,
                },
            });

            // Cash method → drawer loses cash. Negative amount.
            if (dto.Method === 'CASH') {
                await tx.cashLedger.create({
                    data: {
                        Type: 'EXPENSE',
                        Amount: amount.neg(),
                        ExpenseId: expense.Id,
                        Notes: `Expense ${code}: ${dto.Description}`,
                        CreatedByUserId: actorId,
                    },
                });
            }

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'EXPENSE_CREATED',
                    Entity: 'Expense',
                    EntityId: expense.Id,
                    After: expense,
                    Metadata: {
                        Category: dto.CategoryId,
                        Method: dto.Method,
                        Payee: dto.Payee ?? null,
                    },
                },
                tx,
            );

            return tx.expense.findUniqueOrThrow({
                where: { Id: expense.Id },
                include: EXPENSE_INCLUDE,
            });
        });
    }

    // ---------------------------------------------------------------
    // Update — non-financial fields only
    // ---------------------------------------------------------------

    async update(
        id: string,
        dto: UpdateExpenseDto,
        actorId: string,
    ): Promise<ExpenseRow> {
        return this.prisma.$transaction(async (tx) => {
            const current = await tx.expense.findFirst({
                where: { Id: id, DeletedAt: null },
            });
            if (!current) throw new NotFoundException('Expense not found');

            const updated = await tx.expense.update({
                where: { Id: id },
                data: {
                    Description: dto.Description,
                    Payee: dto.Payee,
                    Notes: dto.Notes,
                    UpdatedByUserId: actorId,
                },
                include: EXPENSE_INCLUDE,
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'EXPENSE_UPDATED',
                    Entity: 'Expense',
                    EntityId: id,
                    Before: {
                        Description: current.Description,
                        Payee: current.Payee,
                        Notes: current.Notes,
                    },
                    After: {
                        Description: updated.Description,
                        Payee: updated.Payee,
                        Notes: updated.Notes,
                    },
                },
                tx,
            );

            return updated;
        });
    }

    // ---------------------------------------------------------------
    // Remove — soft delete + reverse cash effect
    // ---------------------------------------------------------------

    async remove(id: string, actorId: string): Promise<{ ok: true }> {
        await this.prisma.$transaction(async (tx) => {
            const current = await tx.expense.findFirst({
                where: { Id: id, DeletedAt: null },
            });
            if (!current) throw new NotFoundException('Expense not found');

            // Reverse the cash effect if this was a cash expense.
            if (current.Method === 'CASH') {
                await tx.cashLedger.create({
                    data: {
                        Type: 'EXPENSE_REVERSED',
                        Amount: current.Amount, // positive: money back to drawer
                        ExpenseId: current.Id,
                        Notes: `Expense ${current.Code} deleted — cash returned to drawer`,
                        CreatedByUserId: actorId,
                    },
                });
            }

            await tx.expense.update({
                where: { Id: id },
                data: {
                    DeletedAt: new Date(),
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'EXPENSE_DELETED',
                    Entity: 'Expense',
                    EntityId: id,
                    Before: current,
                    Metadata: {
                        ReversedCash:
                            current.Method === 'CASH'
                                ? current.Amount.toString()
                                : null,
                    },
                },
                tx,
            );
        });

        return { ok: true };
    }
}