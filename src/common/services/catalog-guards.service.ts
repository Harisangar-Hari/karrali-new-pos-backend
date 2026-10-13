import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

/**
 * Shared existence + state guards for catalog references.
 *
 * Every module that writes a FK to a catalog entity (Products, Stock,
 * and later Purchases/Sales) should call these instead of hand-rolling
 * the check. Keeps error messages consistent and DRY.
 */
@Injectable()
export class CatalogGuardsService {
    constructor(private readonly prisma: PrismaService) {}

    async assertWarehouseUsable(warehouseId: string): Promise<void> {
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
                `Warehouse "${wh.Name}" is inactive — reactivate it first`,
            );
        }
    }

    async assertCategoryUsable(categoryId: string): Promise<void> {
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

    async assertBrandUsable(brandId: string): Promise<void> {
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

    async assertProductUsable(productId: string): Promise<void> {
        const product = await this.prisma.product.findFirst({
            where: { Id: productId, DeletedAt: null },
            select: { IsActive: true, Name: true },
        });

        if (!product) {
            throw new BadRequestException(
                'Product not found or has been deleted',
            );
        }
        if (!product.IsActive) {
            throw new BadRequestException(
                `Product "${product.Name}" is inactive`,
            );
        }
    }

    async assertExpenseCategoryUsable(categoryId: string): Promise<void> {
        const cat = await this.prisma.expenseCategory.findFirst({
            where: { Id: categoryId, DeletedAt: null },
            select: { IsActive: true, Name: true },
        });

        if (!cat) {
            throw new BadRequestException(
                'Expense category not found or has been deleted',
            );
        }
        if (!cat.IsActive) {
            throw new BadRequestException(
                `Expense category "${cat.Name}" is inactive — reactivate it first`,
            );
        }
    }

    async assertBankAccountUsable(bankAccountId: string): Promise<void> {
        const account = await this.prisma.bankAccount.findFirst({
            where: { Id: bankAccountId, DeletedAt: null },
            select: { IsActive: true, Name: true },
        });

        if (!account) {
            throw new BadRequestException(
                'Bank account not found or has been deleted',
            );
        }
        if (!account.IsActive) {
            throw new BadRequestException(
                `Bank account "${account.Name}" is inactive — reactivate it first`,
            );
        }
    }

}