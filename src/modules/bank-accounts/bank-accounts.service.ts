import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { BankAccount, Prisma } from '@prisma/client';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { QueryBankAccountDto } from './dto/query-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';

@Injectable()
export class BankAccountsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) {}

    async list(
        query: QueryBankAccountDto,
    ): Promise<PaginatedResponse<BankAccount>> {
        const where: Prisma.BankAccountWhereInput = {};
        if (!query.includeDeleted) where.DeletedAt = null;
        if (query.IsActive !== undefined) where.IsActive = query.IsActive;

        if (query.search) {
            where.OR = [
                { Name: { contains: query.search, mode: 'insensitive' } },
                { BankName: { contains: query.search, mode: 'insensitive' } },
                { AccountNumber: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        const orderBy: Prisma.BankAccountOrderByWithRelationInput = {
            [query.sortBy ?? 'Name']: query.sortOrder,
        };

        return paginate<BankAccount>(
            this.prisma.bankAccount,
            { where, orderBy },
            query.page,
            query.limit,
        );
    }

    async findOne(id: string): Promise<BankAccount> {
        const account = await this.prisma.bankAccount.findFirst({
            where: { Id: id, DeletedAt: null },
        });
        if (!account) throw new NotFoundException('Bank account not found');
        return account;
    }

    async create(
        dto: CreateBankAccountDto,
        actorId: string,
    ): Promise<BankAccount> {
        return this.prisma.$transaction(async (tx) => {
            const dupe = await tx.bankAccount.findUnique({
                where: { AccountNumber: dto.AccountNumber },
                select: { Id: true },
            });
            if (dupe) {
                throw new ConflictException(
                    `Account number "${dto.AccountNumber}" is already in use`,
                );
            }

            if (dto.IsDefault === true) {
                await tx.bankAccount.updateMany({
                    where: { IsDefault: true, DeletedAt: null },
                    data: { IsDefault: false, UpdatedByUserId: actorId },
                });
            }

            const created = await tx.bankAccount.create({
                data: {
                    Name: dto.Name,
                    BankName: dto.BankName,
                    AccountNumber: dto.AccountNumber,
                    Branch: dto.Branch ?? null,
                    Swift: dto.Swift ?? null,
                    IsDefault: dto.IsDefault ?? false,
                    IsActive: dto.IsActive ?? true,
                    CreatedByUserId: actorId,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'BANK_ACCOUNT_CREATED',
                    Entity: 'BankAccount',
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
        dto: UpdateBankAccountDto,
        actorId: string,
    ): Promise<BankAccount> {
        return this.prisma.$transaction(async (tx) => {
            const current = await tx.bankAccount.findFirst({
                where: { Id: id, DeletedAt: null },
            });
            if (!current) throw new NotFoundException('Bank account not found');

            if (dto.AccountNumber && dto.AccountNumber !== current.AccountNumber) {
                const dupe = await tx.bankAccount.findUnique({
                    where: { AccountNumber: dto.AccountNumber },
                    select: { Id: true },
                });
                if (dupe) {
                    throw new ConflictException(
                        `Account number "${dto.AccountNumber}" is already in use`,
                    );
                }
            }

            if (dto.IsDefault === true && !current.IsDefault) {
                await tx.bankAccount.updateMany({
                    where: { IsDefault: true, DeletedAt: null, NOT: { Id: id } },
                    data: { IsDefault: false, UpdatedByUserId: actorId },
                });
            }

            if (dto.IsDefault === false && current.IsDefault) {
                const otherDefaults = await tx.bankAccount.count({
                    where: { IsDefault: true, DeletedAt: null, NOT: { Id: id } },
                });
                if (otherDefaults === 0) {
                    throw new ConflictException(
                        'Cannot unset the default bank account. Promote another account first.',
                    );
                }
            }

            const updated = await tx.bankAccount.update({
                where: { Id: id },
                data: {
                    Name: dto.Name,
                    BankName: dto.BankName,
                    AccountNumber: dto.AccountNumber,
                    Branch: dto.Branch,
                    Swift: dto.Swift,
                    IsDefault: dto.IsDefault,
                    IsActive: dto.IsActive,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'BANK_ACCOUNT_UPDATED',
                    Entity: 'BankAccount',
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
            const current = await tx.bankAccount.findFirst({
                where: { Id: id, DeletedAt: null },
            });
            if (!current) throw new NotFoundException('Bank account not found');

            if (current.IsDefault) {
                throw new ConflictException(
                    'Cannot delete the default bank account. Promote another account first.',
                );
            }

            const expenseCount = await tx.expense.count({
                where: { BankAccountId: id, DeletedAt: null },
            });
            if (expenseCount > 0) {
                throw new ConflictException(
                    `Cannot delete — ${expenseCount} expense(s) reference this account.`,
                );
            }

            const movementCount = await tx.cashMovement.count({
                where: { BankAccountId: id },
            });
            if (movementCount > 0) {
                throw new ConflictException(
                    `Cannot delete — ${movementCount} cash movement(s) reference this account.`,
                );
            }

            await tx.bankAccount.update({
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
                    Action: 'BANK_ACCOUNT_DELETED',
                    Entity: 'BankAccount',
                    EntityId: id,
                    Before: current,
                },
                tx,
            );
        });

        return { ok: true };
    }
}