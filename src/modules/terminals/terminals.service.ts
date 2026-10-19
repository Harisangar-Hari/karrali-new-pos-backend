//src/modules/terminals/terminals.service.ts
import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma, Terminal } from '@prisma/client';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateTerminalDto } from './dto/create-terminal.dto';
import { QueryTerminalDto } from './dto/query-terminal.dto';
import { UpdateTerminalDto } from './dto/update-terminal.dto';
import { AuditService } from '../audit/audit.service';

const TERMINAL_INCLUDE = {
    Warehouse: { select: { Id: true, Name: true, Code: true } },
} as const;

type TerminalWithWarehouse = Prisma.TerminalGetPayload<{
    include: typeof TERMINAL_INCLUDE;
}>;

@Injectable()
export class TerminalsService {
    constructor(private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    async list(
        query: QueryTerminalDto,
    ): Promise<PaginatedResponse<TerminalWithWarehouse>> {
        const where: Prisma.TerminalWhereInput = {};

        if (!query.includeDeleted) where.DeletedAt = null;
        if (query.IsActive !== undefined) where.IsActive = query.IsActive;
        if (query.WarehouseId) where.WarehouseId = query.WarehouseId;

        if (query.search) {
            where.OR = [
                { Name: { contains: query.search, mode: 'insensitive' } },
                { Code: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        const orderBy: Prisma.TerminalOrderByWithRelationInput = {
            [query.sortBy ?? 'CreatedAt']: query.sortOrder,
        };

        return paginate<TerminalWithWarehouse>(
            this.prisma.terminal,
            { where, orderBy, include: TERMINAL_INCLUDE },
            query.page,
            query.limit,
        );
    }

    async findOne(id: string): Promise<TerminalWithWarehouse> {
        const terminal = await this.prisma.terminal.findFirst({
            where: { Id: id, DeletedAt: null },
            include: TERMINAL_INCLUDE,
        });

        if (!terminal) throw new NotFoundException('Terminal not found');
        return terminal;
    }

    async create(dto: CreateTerminalDto, actorId: string): Promise<Terminal> {
        const dupe = await this.prisma.terminal.findUnique({
            where: { Code: dto.Code },
            select: { Id: true },
        });
        if (dupe) {
            throw new ConflictException(
                `Terminal code "${dto.Code}" is already in use`,
            );
        }

        await this.assertWarehouseUsable(dto.WarehouseId);

        return this.prisma.$transaction(async (tx) => {
            const created = await tx.terminal.create({
                data: {
                    Name: dto.Name,
                    Code: dto.Code,
                    WarehouseId: dto.WarehouseId,
                    IsActive: dto.IsActive ?? true,
                    CreatedByUserId: actorId,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'TERMINAL_CREATED',
                    Entity: 'Terminal',
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
        dto: UpdateTerminalDto,
        actorId: string,
    ): Promise<Terminal> {
        const current = await this.prisma.terminal.findFirst({
            where: { Id: id, DeletedAt: null },
        });
        if (!current) throw new NotFoundException('Terminal not found');

        if (dto.Code && dto.Code !== current.Code) {
            const dupe = await this.prisma.terminal.findUnique({
                where: { Code: dto.Code },
                select: { Id: true },
            });
            if (dupe) {
                throw new ConflictException(
                    `Terminal code "${dto.Code}" is already in use`,
                );
            }
        }

        if (dto.WarehouseId && dto.WarehouseId !== current.WarehouseId) {
            await this.assertWarehouseUsable(dto.WarehouseId);
        }

        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.terminal.update({
                where: { Id: id },
                data: {
                    Name: dto.Name,
                    Code: dto.Code,
                    WarehouseId: dto.WarehouseId,
                    IsActive: dto.IsActive,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'TERMINAL_UPDATED',
                    Entity: 'Terminal',
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
        const current = await this.prisma.terminal.findFirst({
            where: { Id: id, DeletedAt: null },
        });
        if (!current) throw new NotFoundException('Terminal not found');

        await this.prisma.$transaction(async (tx) => {
            await tx.terminal.update({
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
                    Action: 'TERMINAL_DELETED',
                    Entity: 'Terminal',
                    EntityId: id,
                    Before: current,
                },
                tx,
            );
        });

        return { ok: true };
    }
    /**
     * A terminal can only bind to a live warehouse. Guards against
     * pointing at soft-deleted or inactive warehouses.
     */
    private async assertWarehouseUsable(warehouseId: string): Promise<void> {
        const warehouse = await this.prisma.warehouse.findFirst({
            where: { Id: warehouseId, DeletedAt: null },
            select: { IsActive: true, Name: true },
        });

        if (!warehouse) {
            throw new BadRequestException(
                'Warehouse not found or has been deleted',
            );
        }
        if (!warehouse.IsActive) {
            throw new BadRequestException(
                `Warehouse "${warehouse.Name}" is inactive — reactivate it first`,
            );
        }
    }
}