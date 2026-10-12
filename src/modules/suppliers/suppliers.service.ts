import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Supplier } from '@prisma/client';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { nextCode } from '../../common/utils/code.util';
import { paginate } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { QuerySupplierDto } from './dto/query-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

const SUPPLIER_CODE_PREFIX = 'SUP';

@Injectable()
export class SuppliersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    // ---------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------

    async list(
        query: QuerySupplierDto,
    ): Promise<PaginatedResponse<Supplier>> {
        const where: Prisma.SupplierWhereInput = {};

        if (!query.includeDeleted) where.DeletedAt = null;
        if (query.IsActive !== undefined) where.IsActive = query.IsActive;

        if (query.search) {
            where.OR = [
                { Name: { contains: query.search, mode: 'insensitive' } },
                { Code: { contains: query.search, mode: 'insensitive' } },
                { Phone: { contains: query.search, mode: 'insensitive' } },
                { Email: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        const orderBy: Prisma.SupplierOrderByWithRelationInput = {
            [query.sortBy ?? 'Name']: query.sortOrder,
        };

        return paginate<Supplier>(
            this.prisma.supplier,
            { where, orderBy },
            query.page,
            query.limit,
        );
    }

    async findOne(id: string): Promise<Supplier> {
        const supplier = await this.prisma.supplier.findFirst({
            where: { Id: id, DeletedAt: null },
        });
        if (!supplier) throw new NotFoundException('Supplier not found');
        return supplier;
    }

    // ---------------------------------------------------------------
    // Writes
    // ---------------------------------------------------------------

    async create(dto: CreateSupplierDto, actorId: string): Promise<Supplier> {
        return this.prisma.$transaction(async (tx) => {
            const code = await nextCode(tx, SUPPLIER_CODE_PREFIX);

            const supplier = await tx.supplier.create({
                data: {
                    Code: code,
                    Name: dto.Name,
                    Phone: dto.Phone ?? null,
                    Email: dto.Email ?? null,
                    Address: dto.Address ?? null,
                    TaxNumber: dto.TaxNumber ?? null,
                    PaymentTerms: dto.PaymentTerms ?? null,
                    BankName: dto.BankName ?? null,
                    BankAccountNo: dto.BankAccountNo ?? null,
                    BankBranch: dto.BankBranch ?? null,
                    BankSwift: dto.BankSwift ?? null,
                    Notes: dto.Notes ?? null,
                    IsActive: dto.IsActive ?? true,
                    CreatedByUserId: actorId,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'SUPPLIER_CREATED',
                    Entity: 'Supplier',
                    EntityId: supplier.Id,
                    After: supplier,
                },
                tx,
            );

            return supplier;
        });
    }

    async update(
        id: string,
        dto: UpdateSupplierDto,
        actorId: string,
    ): Promise<Supplier> {
        const current = await this.prisma.supplier.findFirst({
            where: { Id: id, DeletedAt: null },
        });
        if (!current) throw new NotFoundException('Supplier not found');

        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.supplier.update({
                where: { Id: id },
                data: {
                    Name: dto.Name,
                    Phone:
                        dto.Phone === undefined ? undefined : dto.Phone ?? null,
                    Email:
                        dto.Email === undefined ? undefined : dto.Email ?? null,
                    Address: dto.Address,
                    TaxNumber: dto.TaxNumber,
                    PaymentTerms: dto.PaymentTerms,
                    BankName: dto.BankName,
                    BankAccountNo: dto.BankAccountNo,
                    BankBranch: dto.BankBranch,
                    BankSwift: dto.BankSwift,
                    Notes: dto.Notes,
                    IsActive: dto.IsActive,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'SUPPLIER_UPDATED',
                    Entity: 'Supplier',
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
        const current = await this.prisma.supplier.findFirst({
            where: { Id: id, DeletedAt: null },
        });
        if (!current) throw new NotFoundException('Supplier not found');

        // Phase 3 will add a guard: block delete if the supplier has
        // unpaid Purchase invoices. For now, soft delete is free.

        await this.prisma.$transaction(async (tx) => {
            await tx.supplier.update({
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
                    Action: 'SUPPLIER_DELETED',
                    Entity: 'Supplier',
                    EntityId: id,
                    Before: current,
                },
                tx,
            );
        });

        return { ok: true };
    }
}