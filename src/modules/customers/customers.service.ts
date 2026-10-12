import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Customer, Prisma } from '@prisma/client';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { nextCode } from '../../common/utils/code.util';
import { paginate } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { QueryLedgerDto } from './dto/query-ledger.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

const CUSTOMER_CODE_PREFIX = 'CUST';

export interface CreditStatus {
    CustomerId: string;
    Code: string;
    Name: string;
    CreditLimit: Prisma.Decimal;
    Balance: Prisma.Decimal;
    Available: Prisma.Decimal;
    OverLimit: boolean;
}

@Injectable()
export class CustomersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    // ---------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------

    async list(
        query: QueryCustomerDto,
    ): Promise<PaginatedResponse<Customer>> {
        const where: Prisma.CustomerWhereInput = {};

        if (!query.includeDeleted) where.DeletedAt = null;
        if (query.IsActive !== undefined) where.IsActive = query.IsActive;
        if (query.Type) where.Type = query.Type;
        if (query.withBalance) where.Balance = { not: 0 };

        if (query.search) {
            where.OR = [
                { Name: { contains: query.search, mode: 'insensitive' } },
                { Code: { contains: query.search, mode: 'insensitive' } },
                { Phone: { contains: query.search, mode: 'insensitive' } },
                { Email: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        const orderBy: Prisma.CustomerOrderByWithRelationInput = {
            [query.sortBy ?? 'Name']: query.sortOrder,
        };

        return paginate<Customer>(
            this.prisma.customer,
            { where, orderBy },
            query.page,
            query.limit,
        );
    }

    async findOne(id: string): Promise<Customer> {
        const customer = await this.prisma.customer.findFirst({
            where: { Id: id, DeletedAt: null },
        });
        if (!customer) throw new NotFoundException('Customer not found');
        return customer;
    }

    /**
     * POS quick-lookup: exact match on Code, or Phone with ilike.
     * Returns the first non-deleted hit or null (no 404) so callers
     * can decide what to do.
     */
    async lookup(by: 'code' | 'phone', value: string): Promise<Customer | null> {
        if (by === 'code') {
            return this.prisma.customer.findFirst({
                where: { Code: value, DeletedAt: null },
            });
        }
        return this.prisma.customer.findFirst({
            where: { Phone: value, DeletedAt: null },
            orderBy: { CreatedAt: 'desc' },
        });
    }

    async getCreditStatus(id: string): Promise<CreditStatus> {
        const c = await this.findOne(id);
        const available = new Prisma.Decimal(c.CreditLimit).sub(c.Balance);
        return {
            CustomerId: c.Id,
            Code: c.Code,
            Name: c.Name,
            CreditLimit: c.CreditLimit,
            Balance: c.Balance,
            Available: available,
            OverLimit: c.Balance.greaterThan(c.CreditLimit),
        };
    }

    async getLedger(
        customerId: string,
        query: QueryLedgerDto,
    ): Promise<PaginatedResponse<Prisma.CustomerLedgerGetPayload<{}>>> {
        // Confirm the customer exists (and isn't deleted) before returning
        // an empty ledger — otherwise a typo'd UUID looks like an empty
        // ledger rather than a bad ID.
        const exists = await this.prisma.customer.findFirst({
            where: { Id: customerId, DeletedAt: null },
            select: { Id: true },
        });
        if (!exists) throw new NotFoundException('Customer not found');

        const where: Prisma.CustomerLedgerWhereInput = { CustomerId: customerId };
        if (query.Type) where.Type = query.Type;

        return paginate<Prisma.CustomerLedgerGetPayload<{}>>(
            this.prisma.customerLedger,
            { where, orderBy: { CreatedAt: 'desc' } },
            query.page,
            query.limit,
        );
    }

    // ---------------------------------------------------------------
    // Writes
    // ---------------------------------------------------------------

    async create(dto: CreateCustomerDto, actorId: string): Promise<Customer> {
        const opening = new Prisma.Decimal(dto.OpeningBalance ?? 0);

        return this.prisma.$transaction(async (tx) => {
            const code = await nextCode(tx, CUSTOMER_CODE_PREFIX);

            const customer = await tx.customer.create({
                data: {
                    Code: code,
                    Name: dto.Name,
                    Type: dto.Type ?? 'RETAIL',
                    Phone: dto.Phone ?? null,
                    Email: dto.Email ?? null,
                    Address: dto.Address ?? null,
                    TaxNumber: dto.TaxNumber ?? null,
                    Balance: opening,
                    CreditLimit: new Prisma.Decimal(dto.CreditLimit ?? 0),
                    PaymentTerms: dto.PaymentTerms ?? null,
                    Notes: dto.Notes ?? null,
                    IsActive: dto.IsActive ?? true,
                    CreatedByUserId: actorId,
                    UpdatedByUserId: actorId,
                },
            });

            if (!opening.isZero()) {
                await tx.customerLedger.create({
                    data: {
                        CustomerId: customer.Id,
                        Type: 'OPENING',
                        Amount: opening,
                        BalanceAfter: opening,
                        Notes: 'Opening balance',
                        CreatedByUserId: actorId,
                    },
                });
            }

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'CUSTOMER_CREATED',
                    Entity: 'Customer',
                    EntityId: customer.Id,
                    After: customer,
                    Metadata: opening.isZero()
                        ? undefined
                        : { OpeningBalance: opening.toString() },
                },
                tx,
            );

            return customer;
        });
    }

    async update(
        id: string,
        dto: UpdateCustomerDto,
        actorId: string,
    ): Promise<Customer> {
        const current = await this.prisma.customer.findFirst({
            where: { Id: id, DeletedAt: null },
        });
        if (!current) throw new NotFoundException('Customer not found');

        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.customer.update({
                where: { Id: id },
                data: {
                    Name: dto.Name,
                    Type: dto.Type,
                    Phone: dto.Phone === undefined ? undefined : dto.Phone ?? null,
                    Email: dto.Email === undefined ? undefined : dto.Email ?? null,
                    Address: dto.Address,
                    TaxNumber: dto.TaxNumber,
                    CreditLimit:
                        dto.CreditLimit === undefined
                            ? undefined
                            : new Prisma.Decimal(dto.CreditLimit),
                    PaymentTerms: dto.PaymentTerms,
                    Notes: dto.Notes,
                    IsActive: dto.IsActive,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'CUSTOMER_UPDATED',
                    Entity: 'Customer',
                    EntityId: id,
                    Before: current,
                    After: updated,
                },
                tx,
            );

            return updated;
        });
    }

    /**
     * Manual balance correction. Writes one CustomerLedger row (ADJUSTMENT)
     * and updates the cached Customer.Balance in the same tx.
     *
     * Sign convention: positive Amount increases what the customer owes.
     * Negative reduces it. Reason is required and stored on the ledger
     * row so aging reports can explain the entry.
     */
    async adjustBalance(
        id: string,
        dto: AdjustBalanceDto,
        actorId: string,
    ): Promise<Customer> {
        const delta = new Prisma.Decimal(dto.Amount);

        return this.prisma.$transaction(async (tx) => {
            const current = await tx.customer.findFirst({
                where: { Id: id, DeletedAt: null },
            });
            if (!current) throw new NotFoundException('Customer not found');

            const newBalance = new Prisma.Decimal(current.Balance).add(delta);

            await tx.customerLedger.create({
                data: {
                    CustomerId: id,
                    Type: 'ADJUSTMENT',
                    Amount: delta,
                    BalanceAfter: newBalance,
                    Notes: dto.Reason,
                    CreatedByUserId: actorId,
                },
            });

            const updated = await tx.customer.update({
                where: { Id: id },
                data: {
                    Balance: newBalance,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'CUSTOMER_BALANCE_ADJUSTED',
                    Entity: 'Customer',
                    EntityId: id,
                    Before: { Balance: current.Balance.toString() },
                    After: { Balance: updated.Balance.toString() },
                    Metadata: { Delta: delta.toString(), Reason: dto.Reason },
                },
                tx,
            );

            return updated;
        });
    }

    async remove(id: string, actorId: string): Promise<{ ok: true }> {
        const current = await this.prisma.customer.findFirst({
            where: { Id: id, DeletedAt: null },
        });
        if (!current) throw new NotFoundException('Customer not found');

        if (!new Prisma.Decimal(current.Balance).isZero()) {
            throw new ConflictException(
                `Cannot delete — customer has an outstanding balance of ${current.Balance.toString()}. Settle or write off first.`,
            );
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.customer.update({
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
                    Action: 'CUSTOMER_DELETED',
                    Entity: 'Customer',
                    EntityId: id,
                    Before: current,
                },
                tx,
            );
        });

        return { ok: true };
    }
}