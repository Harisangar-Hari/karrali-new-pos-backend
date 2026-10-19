import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AuditService } from '../audit/audit.service';

const PRODUCT_LIST_INCLUDE = {
    Category: { select: { Id: true, Name: true } },
    Brand: { select: { Id: true, Name: true } },
} as const;

const PRODUCT_DETAIL_INCLUDE = {
    ...PRODUCT_LIST_INCLUDE,
    WarehouseStocks: {
        select: {
            Id: true,
            WarehouseId: true,
            Qty: true,
            Warehouse: { select: { Id: true, Name: true, Code: true } },
        },
    },
} as const;

type ProductListRow = Prisma.ProductGetPayload<{
    include: typeof PRODUCT_LIST_INCLUDE;
}>;
type ProductDetailRow = Prisma.ProductGetPayload<{
    include: typeof PRODUCT_DETAIL_INCLUDE;
}>;

@Injectable()
export class ProductsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) {}

    async list(
        query: QueryProductDto,
    ): Promise<PaginatedResponse<unknown>> {
        const where: Prisma.ProductWhereInput = {};

        if (!query.includeDeleted) where.DeletedAt = null;
        if (query.IsActive !== undefined) where.IsActive = query.IsActive;
        if (query.CategoryId) where.CategoryId = query.CategoryId;
        if (query.BrandId) where.BrandId = query.BrandId;

        if (query.minPrice !== undefined || query.maxPrice !== undefined) {
            where.Price = {};
            if (query.minPrice !== undefined) where.Price.gte = query.minPrice;
            if (query.maxPrice !== undefined) where.Price.lte = query.maxPrice;
        }

        // "In stock" filter at the product level. When combined with
        // WarehouseId, scopes to that warehouse's stock. Alone, means
        // "has non-zero stock in any warehouse".
        if (query.inStock) {
            where.WarehouseStocks = query.WarehouseId
                ? {
                      some: {
                          WarehouseId: query.WarehouseId,
                          Qty: { gt: 0 },
                      },
                  }
                : {
                      some: { Qty: { gt: 0 } },
                  };
        }

        if (query.search) {
            where.OR = [
                { Name: { contains: query.search, mode: 'insensitive' } },
                { SKU: { contains: query.search, mode: 'insensitive' } },
                { Barcode: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        if (query.lowStock) {
            return this.listLowStock(query, where);
        }

        const orderBy: Prisma.ProductOrderByWithRelationInput = {
            [query.sortBy ?? 'CreatedAt']: query.sortOrder,
        };

        // WarehouseStocks include is dynamic: filter to a single warehouse
        // when WarehouseId is set, so the response carries only that
        // warehouse's qty per product.
        const include = {
            ...PRODUCT_LIST_INCLUDE,
            WarehouseStocks: {
                select: { WarehouseId: true, Qty: true },
                ...(query.WarehouseId
                    ? { where: { WarehouseId: query.WarehouseId } }
                    : {}),
            },
        } as const;

        return paginate(
            this.prisma.product,
            { where, orderBy, include },
            query.page,
            query.limit,
        );
    }

    async findOne(id: string): Promise<ProductDetailRow> {
        const product = await this.prisma.product.findFirst({
            where: { Id: id, DeletedAt: null },
            include: PRODUCT_DETAIL_INCLUDE,
        });

        if (!product) throw new NotFoundException('Product not found');
        return product;
    }

    async create(dto: CreateProductDto, actorId: string): Promise<Product> {
        await this.assertCategoryUsable(dto.CategoryId);
        if (dto.BrandId) await this.assertBrandUsable(dto.BrandId);

        const sku = dto.SKU ?? null;
        const barcode = dto.Barcode ?? null;

        if (sku) await this.assertUniqueField('SKU', sku);
        if (barcode) await this.assertUniqueField('Barcode', barcode);

        const initialQty = dto.InitialQty ?? 0;
        const initialWarehouseId = dto.InitialWarehouseId;

        if (initialQty > 0 && !initialWarehouseId) {
            throw new BadRequestException(
                'InitialWarehouseId is required when InitialQty is greater than 0',
            );
        }
        if (initialWarehouseId && initialQty === 0) {
            throw new BadRequestException(
                'InitialQty must be greater than 0 when InitialWarehouseId is provided',
            );
        }
        if (initialWarehouseId) {
            await this.assertWarehouseUsable(initialWarehouseId);
        }

        return this.prisma.$transaction(async (tx) => {
            const product = await tx.product.create({
                data: {
                    Name: dto.Name,
                    Barcode: barcode,
                    SKU: sku,
                    Description: dto.Description ?? null,
                    Unit: dto.Unit ?? 'pcs',
                    Price: dto.Price,
                    CostPrice: dto.CostPrice,
                    Discount: dto.Discount ?? 0,
                    TaxRate: dto.TaxRate ?? null,
                    ReorderLevel: dto.ReorderLevel ?? 0,
                    WarrantyMonths: dto.WarrantyMonths ?? 0,
                    ImageUrl: dto.ImageUrl ?? null,
                    IsActive: dto.IsActive ?? true,
                    CategoryId: dto.CategoryId,
                    BrandId: dto.BrandId ?? null,
                    CreatedByUserId: actorId,
                    UpdatedByUserId: actorId,
                },
            });

            if (initialQty > 0 && initialWarehouseId) {
                await tx.warehouseStock.create({
                    data: {
                        ProductId: product.Id,
                        WarehouseId: initialWarehouseId,
                        Qty: initialQty,
                    },
                });

                await tx.stockMovement.create({
                    data: {
                        ProductId: product.Id,
                        WarehouseId: initialWarehouseId,
                        Type: 'OPENING',
                        Quantity: initialQty,
                        UnitCost: dto.CostPrice,
                        Notes: 'Opening stock (product create)',
                        CreatedByUserId: actorId,
                    },
                });
            }

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'PRODUCT_CREATED',
                    Entity: 'Product',
                    EntityId: product.Id,
                    After: product,
                    Metadata:
                        initialQty > 0 && initialWarehouseId
                            ? {
                                  InitialQty: initialQty,
                                  InitialWarehouseId: initialWarehouseId,
                              }
                            : undefined,
                },
                tx,
            );

            return product;
        });
    }

    async update(
        id: string,
        dto: UpdateProductDto,
        actorId: string,
    ): Promise<Product> {
        const current = await this.prisma.product.findFirst({
            where: { Id: id, DeletedAt: null },
        });
        if (!current) throw new NotFoundException('Product not found');

        if (dto.CategoryId && dto.CategoryId !== current.CategoryId) {
            await this.assertCategoryUsable(dto.CategoryId);
        }
        if (dto.BrandId && dto.BrandId !== current.BrandId) {
            await this.assertBrandUsable(dto.BrandId);
        }

        const nextSku =
            dto.SKU === undefined ? current.SKU : (dto.SKU ?? null);
        const nextBarcode =
            dto.Barcode === undefined ? current.Barcode : (dto.Barcode ?? null);

        if (nextSku && nextSku !== current.SKU) {
            await this.assertUniqueField('SKU', nextSku, id);
        }
        if (nextBarcode && nextBarcode !== current.Barcode) {
            await this.assertUniqueField('Barcode', nextBarcode, id);
        }

        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.product.update({
                where: { Id: id },
                data: {
                    Name: dto.Name,
                    Barcode: dto.Barcode === undefined ? undefined : nextBarcode,
                    SKU: dto.SKU === undefined ? undefined : nextSku,
                    Description: dto.Description,
                    Unit: dto.Unit,
                    Price: dto.Price,
                    CostPrice: dto.CostPrice,
                    Discount: dto.Discount,
                    TaxRate: dto.TaxRate,
                    ReorderLevel: dto.ReorderLevel,
                    WarrantyMonths: dto.WarrantyMonths,
                    ImageUrl: dto.ImageUrl,
                    IsActive: dto.IsActive,
                    CategoryId: dto.CategoryId,
                    BrandId: dto.BrandId,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'PRODUCT_UPDATED',
                    Entity: 'Product',
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
        const current = await this.prisma.product.findFirst({
            where: { Id: id, DeletedAt: null },
        });
        if (!current) throw new NotFoundException('Product not found');

        const stockedCount = await this.prisma.warehouseStock.count({
            where: { ProductId: id, Qty: { not: 0 } },
        });
        if (stockedCount > 0) {
            throw new ConflictException(
                `Cannot delete — ${stockedCount} warehouse(s) still hold non-zero stock. Adjust to zero first.`,
            );
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.product.update({
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
                    Action: 'PRODUCT_DELETED',
                    Entity: 'Product',
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

    private async assertCategoryUsable(categoryId: string): Promise<void> {
        const cat = await this.prisma.category.findFirst({
            where: { Id: categoryId, DeletedAt: null },
            select: { IsActive: true, Name: true },
        });
        if (!cat) {
            throw new BadRequestException(
                'Category not found or has been deleted',
            );
        }
        if (!cat.IsActive) {
            throw new BadRequestException(
                `Category "${cat.Name}" is inactive — reactivate it first`,
            );
        }
    }

    private async assertBrandUsable(brandId: string): Promise<void> {
        const brand = await this.prisma.brand.findFirst({
            where: { Id: brandId, DeletedAt: null },
            select: { IsActive: true, Name: true },
        });
        if (!brand) {
            throw new BadRequestException(
                'Brand not found or has been deleted',
            );
        }
        if (!brand.IsActive) {
            throw new BadRequestException(
                `Brand "${brand.Name}" is inactive — reactivate it first`,
            );
        }
    }

    private async assertWarehouseUsable(warehouseId: string): Promise<void> {
        const wh = await this.prisma.warehouse.findFirst({
            where: { Id: warehouseId, DeletedAt: null },
            select: { IsActive: true, Name: true },
        });
        if (!wh) {
            throw new BadRequestException(
                'Warehouse not found or has been deleted',
            );
        }
        if (!wh.IsActive) {
            throw new BadRequestException(
                `Warehouse "${wh.Name}" is inactive`,
            );
        }
    }

    private async assertUniqueField(
        field: 'SKU' | 'Barcode',
        value: string,
        excludeId?: string,
    ): Promise<void> {
        const clash = await this.prisma.product.findUnique({
            where: field === 'SKU' ? { SKU: value } : { Barcode: value },
            select: { Id: true },
        });

        if (clash && clash.Id !== excludeId) {
            throw new ConflictException(
                `A product with ${field} "${value}" already exists`,
            );
        }
    }

    /**
     * Low-stock filter. When WarehouseId is set, "low stock" means
     * low stock IN THAT WAREHOUSE — the warehouse-scoped qty is compared
     * to the product's reorder level.
     */
    private async listLowStock(
        query: QueryProductDto,
        where: Prisma.ProductWhereInput,
    ): Promise<PaginatedResponse<unknown>> {
        const orderBy: Prisma.ProductOrderByWithRelationInput = {
            [query.sortBy ?? 'CreatedAt']: query.sortOrder,
        };

        const rows = await this.prisma.product.findMany({
            where,
            orderBy,
            include: {
                Category: { select: { Id: true, Name: true } },
                Brand: { select: { Id: true, Name: true } },
                WarehouseStocks: {
                    select: { WarehouseId: true, Qty: true },
                    ...(query.WarehouseId
                        ? { where: { WarehouseId: query.WarehouseId } }
                        : {}),
                },
            },
        });

        const filtered = rows.filter((p) => {
            const total = p.WarehouseStocks.reduce((s, ws) => s + ws.Qty, 0);
            return total <= p.ReorderLevel;
        });

        const skip = (query.page - 1) * query.limit;
        const data = filtered.slice(skip, skip + query.limit);

        const total = filtered.length;
        const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

        return {
            data,
            meta: {
                page: query.page,
                limit: query.limit,
                total,
                totalPages,
                hasNext: query.page < totalPages,
                hasPrev: query.page > 1,
            },
        };
    }
}