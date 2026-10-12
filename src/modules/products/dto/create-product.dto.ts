import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    IsBoolean,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    IsUrl,
    IsUUID,
    Max,
    MaxLength,
    Min,
    MinLength,
} from 'class-validator';

/**
 * `""` becomes `null` for nullable unique fields. Undefined stays
 * undefined so `@IsOptional` keeps working. Non-string values pass
 * through for class-validator to reject.
 */
const emptyToNull = ({ value }: { value: unknown }): unknown => {
    if (typeof value === 'string' && value.trim() === '') return null;
    return value;
};

export class CreateProductDto {
    @ApiProperty({ example: 'Coca-Cola 500ml', maxLength: 200 })
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    Name!: string;

    @ApiPropertyOptional({
        type: String,
        nullable: true,
        description: 'Unique barcode. Empty string is treated as null.',
    })
    @IsOptional()
    @Transform(emptyToNull)
    @IsString()
    @MaxLength(64)
    Barcode?: string | null;

    @ApiPropertyOptional({
        type: String,
        nullable: true,
        description: 'Unique SKU. Empty string is treated as null.',
    })
    @IsOptional()
    @Transform(emptyToNull)
    @IsString()
    @MaxLength(64)
    SKU?: string | null;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    Description?: string;

    @ApiPropertyOptional({ default: 'pcs', maxLength: 20 })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    Unit?: string;

    @ApiProperty({ example: 250.0, minimum: 0 })
    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(0)
    Price!: number;

    @ApiProperty({ example: 180.0, minimum: 0 })
    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(0)
    CostPrice!: number;

    @ApiPropertyOptional({
        default: 0,
        minimum: 0,
        maximum: 100,
        description: 'Default discount percentage applied to this product',
    })
    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(0)
    @Max(100)
    Discount?: number;

    @ApiPropertyOptional({
        nullable: true,
        minimum: 0,
        maximum: 100,
        description: 'Tax rate percentage. Null means no tax.',
    })
    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    @Max(100)
    TaxRate?: number | null;

    @ApiPropertyOptional({ default: 0, minimum: 0 })
    @IsOptional()
    @IsInt()
    @Min(0)
    ReorderLevel?: number;

    @ApiPropertyOptional({ default: 0, minimum: 0 })
    @IsOptional()
    @IsInt()
    @Min(0)
    WarrantyMonths?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUrl({ require_tld: false })
    @MaxLength(500)
    ImageUrl?: string;

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    IsActive?: boolean;

    @ApiProperty({ format: 'uuid' })
    @IsUUID()
    CategoryId!: string;

    @ApiPropertyOptional({ format: 'uuid', nullable: true })
    @IsOptional()
    @IsUUID()
    BrandId?: string | null;

    // ---------------------------------------------------------------
    // Opening stock — optional. If either is provided, both must be.
    // ---------------------------------------------------------------

    @ApiPropertyOptional({
        minimum: 0,
        description:
            'Opening quantity. If > 0, InitialWarehouseId is required and an OPENING stock movement is written.',
    })
    @IsOptional()
    @IsInt()
    @Min(0)
    InitialQty?: number;

    @ApiPropertyOptional({
        format: 'uuid',
        description: 'Warehouse for InitialQty. Required when InitialQty is set.',
    })
    @IsOptional()
    @IsUUID()
    InitialWarehouseId?: string;
}