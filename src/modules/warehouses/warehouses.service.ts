import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma, Warehouse } from '@prisma/client';
import {
    PaginatedResponse,
} from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { QueryWarehouseDto } from './dto/query-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { Global, Module } from '@nestjs/common';
import { AuditController } from '../audit/audit.controller';
import { AuditService } from '../audit/audit.service';

/**
 * Global so feature modules don't need to import this module just to
 * call `audit.log(...)`. AuditService has no side-effect dependencies
 * beyond PrismaService (already @Global()).
 */
@Global()
@Module({
    controllers: [AuditController],
    providers: [AuditService],
    exports: [AuditService],
})
export class AuditModule {}

@Injectable()
export class WarehousesService {
    constructor(private readonly prisma: PrismaService,
      private readonly audit: AuditService,   
    ) { }

    async list(
        query: QueryWarehouseDto,
    ): Promise<PaginatedResponse<Warehouse>> {
        const where: Prisma.WarehouseWhereInput = {};

        if (!query.includeDeleted) where.DeletedAt = null;
        if (query.IsActive !== undefined) where.IsActive = query.IsActive;

        if (query.search) {
            where.OR = [
                { Name: { contains: query.search, mode: 'insensitive' } },
                { Code: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        const orderBy: Prisma.WarehouseOrderByWithRelationInput = {
            [query.sortBy ?? 'CreatedAt']: query.sortOrder,
        };

        return paginate<Warehouse>(
            this.prisma.warehouse,
            { where, orderBy },
            query.page,
            query.limit,
        );
    }

    async findOne(id: string) {
        const warehouse = await this.prisma.warehouse.findFirst({
            where: { Id: id, DeletedAt: null },
            include: {
                _count: {
                    select: { Terminals: true, WarehouseStocks: true },
                },
            },
        });

        if (!warehouse) throw new NotFoundException('Warehouse not found');
        return warehouse;
    }

     async create(dto: CreateWarehouseDto, actorId: string): Promise<Warehouse> {
        return this.prisma.$transaction(async (tx) => {
            const dupe = await tx.warehouse.findUnique({
                where: { Code: dto.Code },
                select: { Id: true },
            });
            if (dupe) {
                throw new ConflictException(
                    `Warehouse code "${dto.Code}" is already in use`,
                );
            }

            if (dto.IsDefault === true) {
                await tx.warehouse.updateMany({
                    where: { IsDefault: true, DeletedAt: null },
                    data: { IsDefault: false, UpdatedByUserId: actorId },
                });
            }

            const created = await tx.warehouse.create({
                data: {
                    Name: dto.Name,
                    Code: dto.Code,
                    Address: dto.Address ?? null,
                    IsActive: dto.IsActive ?? true,
                    IsDefault: dto.IsDefault ?? false,
                    CreatedByUserId: actorId,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'WAREHOUSE_CREATED',
                    Entity: 'Warehouse',
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
        dto: UpdateWarehouseDto,
        actorId: string,
    ): Promise<Warehouse> {
        return this.prisma.$transaction(async (tx) => {
            const current = await tx.warehouse.findFirst({
                where: { Id: id, DeletedAt: null },
            });
            if (!current) throw new NotFoundException('Warehouse not found');

            if (dto.Code && dto.Code !== current.Code) {
                const dupe = await tx.warehouse.findUnique({
                    where: { Code: dto.Code },
                    select: { Id: true },
                });
                if (dupe) {
                    throw new ConflictException(
                        `Warehouse code "${dto.Code}" is already in use`,
                    );
                }
            }

            if (dto.IsDefault === true && !current.IsDefault) {
                await tx.warehouse.updateMany({
                    where: {
                        IsDefault: true,
                        DeletedAt: null,
                        NOT: { Id: id },
                    },
                    data: { IsDefault: false, UpdatedByUserId: actorId },
                });
            }

            if (dto.IsDefault === false && current.IsDefault) {
                const otherDefaults = await tx.warehouse.count({
                    where: {
                        IsDefault: true,
                        DeletedAt: null,
                        NOT: { Id: id },
                    },
                });
                if (otherDefaults === 0) {
                    throw new ConflictException(
                        'Cannot unset the default warehouse. Promote another warehouse to default first.',
                    );
                }
            }

            const updated = await tx.warehouse.update({
                where: { Id: id },
                data: {
                    Name: dto.Name,
                    Code: dto.Code,
                    Address: dto.Address,
                    IsActive: dto.IsActive,
                    IsDefault: dto.IsDefault,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'WAREHOUSE_UPDATED',
                    Entity: 'Warehouse',
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
            const current = await tx.warehouse.findFirst({
                where: { Id: id, DeletedAt: null },
            });
            if (!current) throw new NotFoundException('Warehouse not found');

            if (current.IsDefault) {
                throw new ConflictException(
                    'Cannot delete the default warehouse. Promote another warehouse to default first.',
                );
            }

            const terminalCount = await tx.terminal.count({
                where: { WarehouseId: id, DeletedAt: null },
            });
            if (terminalCount > 0) {
                throw new ConflictException(
                    `Cannot delete warehouse — ${terminalCount} active terminal(s) reference it.`,
                );
            }

            const stockedCount = await tx.warehouseStock.count({
                where: { WarehouseId: id, Qty: { not: 0 } },
            });
            if (stockedCount > 0) {
                throw new ConflictException(
                    `Cannot delete warehouse — ${stockedCount} product(s) still hold stock here.`,
                );
            }

            await tx.warehouse.update({
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
                    Action: 'WAREHOUSE_DELETED',
                    Entity: 'Warehouse',
                    EntityId: id,
                    Before: current,
                },
                tx,
            );
        });

        return { ok: true };
    }
}