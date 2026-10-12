import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Brand, Prisma } from '@prisma/client';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { QueryBrandDto } from './dto/query-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { AuditService } from '../audit/audit.service';


const BRAND_INCLUDE = {
    _count: { select: { Products: true } },
} as const;

type BrandWithMeta = Prisma.BrandGetPayload<{ include: typeof BRAND_INCLUDE }>;

@Injectable()
export class BrandsService {
    constructor(private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    async list(query: QueryBrandDto): Promise<PaginatedResponse<BrandWithMeta>> {
        const where: Prisma.BrandWhereInput = {};

        if (!query.includeDeleted) where.DeletedAt = null;
        if (query.IsActive !== undefined) where.IsActive = query.IsActive;

        if (query.search) {
            where.OR = [
                { Name: { contains: query.search, mode: 'insensitive' } },
                { Description: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        const orderBy: Prisma.BrandOrderByWithRelationInput = {
            [query.sortBy ?? 'Name']: query.sortOrder,
        };

        return paginate<BrandWithMeta>(
            this.prisma.brand,
            { where, orderBy, include: BRAND_INCLUDE },
            query.page,
            query.limit,
        );
    }

    async findOne(id: string): Promise<BrandWithMeta> {
        const brand = await this.prisma.brand.findFirst({
            where: { Id: id, DeletedAt: null },
            include: BRAND_INCLUDE,
        });

        if (!brand) throw new NotFoundException('Brand not found');
        return brand;
    }

    async create(dto: CreateBrandDto, actorId: string): Promise<Brand> {
        await this.assertNameFree(dto.Name);

        return this.prisma.$transaction(async (tx) => {
            const created = await tx.brand.create({
                data: {
                    Name: dto.Name,
                    Description: dto.Description ?? null,
                    IsActive: dto.IsActive ?? true,
                    CreatedByUserId: actorId,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'BRAND_CREATED',
                    Entity: 'Brand',
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
        dto: UpdateBrandDto,
        actorId: string,
    ): Promise<Brand> {
        const current = await this.prisma.brand.findFirst({
            where: { Id: id, DeletedAt: null },
        });
        if (!current) throw new NotFoundException('Brand not found');

        if (dto.Name && dto.Name !== current.Name) {
            await this.assertNameFree(dto.Name, id);
        }

        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.brand.update({
                where: { Id: id },
                data: {
                    Name: dto.Name,
                    Description: dto.Description,
                    IsActive: dto.IsActive,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'BRAND_UPDATED',
                    Entity: 'Brand',
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
        const current = await this.prisma.brand.findFirst({
            where: { Id: id, DeletedAt: null },
        });
        if (!current) throw new NotFoundException('Brand not found');

        const productCount = await this.prisma.product.count({
            where: { BrandId: id, DeletedAt: null },
        });
        if (productCount > 0) {
            throw new ConflictException(
                `Cannot delete — ${productCount} product(s) still reference this brand.`,
            );
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.brand.update({
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
                    Action: 'BRAND_DELETED',
                    Entity: 'Brand',
                    EntityId: id,
                    Before: current,
                },
                tx,
            );
        });

        return { ok: true };
    }

    /**
     * Name is globally unique on the Brand table. `findUnique` catches
     * soft-deleted rows too — deleted brand names remain reserved so
     * historical products keep a stable reference path. Same policy
     * as Warehouses.Code.
     */
    private async assertNameFree(
        name: string,
        excludeId?: string,
    ): Promise<void> {
        const clash = await this.prisma.brand.findUnique({
            where: { Name: name },
            select: { Id: true },
        });

        if (clash && clash.Id !== excludeId) {
            throw new ConflictException(
                `A brand named "${name}" already exists`,
            );
        }
    }
}