import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Category, Prisma } from '@prisma/client';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { QueryCategoryDto } from './dto/query-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { AuditService } from '../audit/audit.service';

const CATEGORY_INCLUDE = {
    Parent: { select: { Id: true, Name: true } },
    _count: { select: { Children: true, Products: true } },
} as const;

type CategoryWithMeta = Prisma.CategoryGetPayload<{
    include: typeof CATEGORY_INCLUDE;
}>;

@Injectable()
export class CategoriesService {
    constructor(private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    async list(
        query: QueryCategoryDto,
    ): Promise<PaginatedResponse<CategoryWithMeta>> {
        const where: Prisma.CategoryWhereInput = {};

        if (!query.includeDeleted) where.DeletedAt = null;
        if (query.IsActive !== undefined) where.IsActive = query.IsActive;
        if (query.rootOnly) {
            where.ParentId = null;
        } else if (query.ParentId) {
            where.ParentId = query.ParentId;
        }

        if (query.search) {
            where.OR = [
                { Name: { contains: query.search, mode: 'insensitive' } },
                { Description: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        const orderBy: Prisma.CategoryOrderByWithRelationInput = {
            [query.sortBy ?? 'Name']: query.sortOrder,
        };

        return paginate<CategoryWithMeta>(
            this.prisma.category,
            { where, orderBy, include: CATEGORY_INCLUDE },
            query.page,
            query.limit,
        );
    }

    async findOne(id: string): Promise<CategoryWithMeta> {
        const category = await this.prisma.category.findFirst({
            where: { Id: id, DeletedAt: null },
            include: CATEGORY_INCLUDE,
        });

        if (!category) throw new NotFoundException('Category not found');
        return category;
    }

    async create(
        dto: CreateCategoryDto,
        actorId: string,
    ): Promise<Category> {
        const parentId = dto.ParentId ?? null;

        if (parentId) {
            await this.assertParentUsable(parentId);
        }

        await this.assertNameFreeAmongSiblings(dto.Name, parentId);

        return this.prisma.$transaction(async (tx) => {
            const created = await tx.category.create({
                data: {
                    Name: dto.Name,
                    Description: dto.Description ?? null,
                    ParentId: parentId,
                    IsActive: dto.IsActive ?? true,
                    CreatedByUserId: actorId,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'CATEGORY_CREATED',
                    Entity: 'Category',
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
        dto: UpdateCategoryDto,
        actorId: string,
    ): Promise<Category> {
        const current = await this.prisma.category.findFirst({
            where: { Id: id, DeletedAt: null },
        });
        if (!current) throw new NotFoundException('Category not found');

        const nextParentId =
            dto.ParentId === undefined ? current.ParentId : dto.ParentId ?? null;

        if (nextParentId) {
            if (nextParentId === id) {
                throw new BadRequestException(
                    'A category cannot be its own parent',
                );
            }
            await this.assertParentUsable(nextParentId);
            await this.assertNoCycle(id, nextParentId);
        }

        const nameChanged =
            dto.Name !== undefined && dto.Name !== current.Name;
        const parentChanged = nextParentId !== current.ParentId;

        if (nameChanged || parentChanged) {
            await this.assertNameFreeAmongSiblings(
                dto.Name ?? current.Name,
                nextParentId,
                id,
            );
        }

        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.category.update({
                where: { Id: id },
                data: {
                    Name: dto.Name,
                    Description: dto.Description,
                    ParentId: nextParentId,
                    IsActive: dto.IsActive,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'CATEGORY_UPDATED',
                    Entity: 'Category',
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
        const current = await this.prisma.category.findFirst({
            where: { Id: id, DeletedAt: null },
        });
        if (!current) throw new NotFoundException('Category not found');

        const childCount = await this.prisma.category.count({
            where: { ParentId: id, DeletedAt: null },
        });
        if (childCount > 0) {
            throw new ConflictException(
                `Cannot delete — ${childCount} sub-categor${childCount === 1 ? 'y' : 'ies'} still exist under this one.`,
            );
        }

        const productCount = await this.prisma.product.count({
            where: { CategoryId: id, DeletedAt: null },
        });
        if (productCount > 0) {
            throw new ConflictException(
                `Cannot delete — ${productCount} product(s) are still filed under this category.`,
            );
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.category.update({
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
                    Action: 'CATEGORY_DELETED',
                    Entity: 'Category',
                    EntityId: id,
                    Before: current,
                },
                tx,
            );
        });

        return { ok: true };
    }

    // ---------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------

    /**
     * Reject if the referenced parent doesn't exist, is soft-deleted,
     * or is inactive. Inactive parents are blocked to keep the tree
     * clean for dropdowns — reactivate first if you want to nest.
     */
    private async assertParentUsable(parentId: string): Promise<void> {
        const parent = await this.prisma.category.findFirst({
            where: { Id: parentId, DeletedAt: null },
            select: { IsActive: true, Name: true },
        });

        if (!parent) {
            throw new BadRequestException(
                'Parent category not found or has been deleted',
            );
        }
        if (!parent.IsActive) {
            throw new BadRequestException(
                `Parent category "${parent.Name}" is inactive — reactivate it first`,
            );
        }
    }

    /**
     * Walk up from the proposed parent. If we ever hit `id`, the update
     * would create a cycle. Depth is bounded by the existing tree, so
     * this terminates.
     */
    private async assertNoCycle(id: string, proposedParentId: string): Promise<void> {
        let cursor: string | null = proposedParentId;
        const seen = new Set<string>();

        while (cursor) {
            if (cursor === id) {
                throw new BadRequestException(
                    'Cannot move category — this would create a cycle',
                );
            }
            if (seen.has(cursor)) break; // defensive: pre-existing corruption
            seen.add(cursor);

            const parent: { ParentId: string | null } | null =
                await this.prisma.category.findUnique({
                    where: { Id: cursor },
                    select: { ParentId: true },
                });

            cursor = parent?.ParentId ?? null;
        }
    }

    /**
     * Per-parent uniqueness: same Name can't repeat under the same parent.
     * Root categories (ParentId null) share the "null parent" bucket.
     */
    private async assertNameFreeAmongSiblings(
        name: string,
        parentId: string | null,
        excludeId?: string,
    ): Promise<void> {
        const clash = await this.prisma.category.findFirst({
            where: {
                Name: name,
                ParentId: parentId,
                DeletedAt: null,
                ...(excludeId ? { NOT: { Id: excludeId } } : {}),
            },
            select: { Id: true },
        });

        if (clash) {
            const scope = parentId ? 'under this parent' : 'at the root level';
            throw new ConflictException(
                `A category named "${name}" already exists ${scope}`,
            );
        }
    }
}