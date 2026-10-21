import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';

export class ImportProductRowDto {
    @ApiProperty({ example: 'Coca-Cola 500ml', maxLength: 200 })
    @IsString()
    @MaxLength(200)
    Name!: string;

    @ApiPropertyOptional({ maxLength: 64 })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    SKU?: string;

    @ApiPropertyOptional({ maxLength: 64 })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    Barcode?: string;

    @ApiProperty({
        example: 'Beverages',
        description: 'Category name — resolved or created on the fly',
        maxLength: 100,
    })
    @IsString()
    @MaxLength(100)
    CategoryName!: string;

    @ApiPropertyOptional({
        example: 'Coca-Cola',
        description: 'Brand name — resolved or created on the fly',
        maxLength: 100,
    })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    BrandName?: string;

    @ApiProperty({ example: 250 })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(0)
    Price!: number;

    @ApiProperty({ example: 180 })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(0)
    CostPrice!: number;

    @ApiPropertyOptional({ default: 'pcs', maxLength: 20 })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    Unit?: string;

    @ApiPropertyOptional({ maxLength: 2000 })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    Description?: string;

    @ApiPropertyOptional({ minimum: 0, maximum: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(0)
    Discount?: number;

    @ApiPropertyOptional({ minimum: 0, maximum: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    TaxRate?: number;

    @ApiPropertyOptional({ minimum: 0 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    ReorderLevel?: number;

    @ApiPropertyOptional({ minimum: 0 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    WarrantyMonths?: number;

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    IsActive?: boolean;

    @ApiPropertyOptional({
        minimum: 0,
        description:
            'Only applied when the product is CREATED (not on update). Requires InitialWarehouseCode.',
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    InitialQty?: number;

    @ApiPropertyOptional({
        maxLength: 20,
        description:
            'Warehouse code (e.g. MAIN). Required if InitialQty > 0.',
    })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    InitialWarehouseCode?: string;
}

export class ImportProductsDto {
    @ApiProperty({
        type: [ImportProductRowDto],
        description: 'Products to import. Max 1000 per request.',
    })
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(1000)
    @ValidateNested({ each: true })
    @Type(() => ImportProductRowDto)
    Rows!: ImportProductRowDto[];
}

export interface ImportProductsResult {
    Total: number;
    Created: number;
    Updated: number;
    CategoriesCreated: number;
    BrandsCreated: number;
}