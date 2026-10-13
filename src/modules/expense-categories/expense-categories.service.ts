import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ExpenseCategory, Prisma } from '@prisma/client';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { QueryExpenseCategoryDto } from './dto/query-expense-category.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';

@Injectable()
export class ExpenseCategoriesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    async list(
        query: QueryExpenseCategoryDto,
    ): Promise<PaginatedResponse<ExpenseCategory>> {
        const where: Prisma.ExpenseCategoryWhereInput = {};
        if (!query.includeDeleted) where.DeletedAt = null;
        if (query.IsActive !== undefined) where.IsActive = query.IsActive;

        if (query.search) {
            where.Name = { contains: query.search, mode: 'insensitive' };
        }

        const orderBy: Prisma.ExpenseCategoryOrderByWithRelationInput = {
            [query.sortBy ?? 'Name']: query.sortOrder,
        };

        return paginate<ExpenseCategory>(
            this.prisma.expenseCategory,
            { where, orderBy },
            query.page,
            query.limit,
        );
    }

    async findOne(id: string): Promise<ExpenseCategory> {
        const category = await this.prisma.expenseCategory.findFirst({
            where: { Id: id, DeletedAt: null },
        });
        if (!category) throw new NotFoundException('Expense category not found');
        return category;
    }

    async create(
        dto: CreateExpenseCategoryDto,
        actorId: string,
    ): Promise<ExpenseCategory> {
        return this.prisma.$transaction(async (tx) => {
            const dupe = await tx.expenseCategory.findUnique({
                where: { Name: dto.Name },
                select: { Id: true },
            });
            if (dupe) {
                throw new ConflictException(
                    `An expense category named "${dto.Name}" already exists`,
                );
            }

            const created = await tx.expenseCategory.create({
                data: {
                    Name: dto.Name,
                    IsActive: dto.IsActive ?? true,
                    CreatedByUserId: actorId,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'EXPENSE_CATEGORY_CREATED',
                    Entity: 'ExpenseCategory',
                    EntityId: created.Id,
                    After: created,
                },
                tx,
            );

            return created;
        });
    }

    async update(
        id: string,
        dto: UpdateExpenseCategoryDto,
        actorId: string,
    ): Promise<ExpenseCategory> {
        return this.prisma.$transaction(async (tx) => {
            const current = await tx.expenseCategory.findFirst({
                where: { Id: id, DeletedAt: null },
            });
            if (!current) throw new NotFoundException('Expense category not found');

            if (dto.Name && dto.Name !== current.Name) {
                const dupe = await tx.expenseCategory.findUnique({
                    where: { Name: dto.Name },
                    select: { Id: true },
                });
                if (dupe) {
                    throw new ConflictException(
                        `An expense category named "${dto.Name}" already exists`,
                    );
                }
            }

            const updated = await tx.expenseCategory.update({
                where: { Id: id },
                data: {
                    Name: dto.Name,
                    IsActive: dto.IsActive,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'EXPENSE_CATEGORY_UPDATED',
                    Entity: 'ExpenseCategory',
                    EntityId: id,
                    Before: current,
                    After: updated,
                },
                tx,
            );

            return updated;
        });
    }

    async remove(id: string, actorId: string): Promise<{ ok: true }> {
        await this.prisma.$transaction(async (tx) => {
            const current = await tx.expenseCategory.findFirst({
                where: { Id: id, DeletedAt: null },
            });
            if (!current) throw new NotFoundException('Expense category not found');

            const expenseCount = await tx.expense.count({
                where: { CategoryId: id, DeletedAt: null },
            });
            if (expenseCount > 0) {
                throw new ConflictException(
                    `Cannot delete — ${expenseCount} expense(s) use this category.`,
                );
            }

            await tx.expenseCategory.update({
                where: { Id: id },
                data: {
                    DeletedAt: new Date(),
                    IsActive: false,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'EXPENSE_CATEGORY_DELETED',
                    Entity: 'ExpenseCategory',
                    EntityId: id,
                    Before: current,
                },
                tx,
            );
        });

        return { ok: true };
    }
}