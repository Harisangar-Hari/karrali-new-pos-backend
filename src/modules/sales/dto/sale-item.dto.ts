//src/modules/sales/dto/sale-item.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min,
} from 'class-validator';

export class SaleItemDto {
    @ApiProperty({ format: 'uuid' })
    @IsUUID()
    ProductId!: string;

    @ApiProperty({ minimum: 1, example: 2 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    Qty!: number;

    @ApiProperty({
        minimum: 0,
        example: 250.0,
        description:
            'Unit price. Typically the product price at time of sale; can be overridden for negotiated prices.',
    })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(0)
    UnitPrice!: number;

    @ApiPropertyOptional({
        minimum: 0,
        maximum: 100,
        description: 'Line discount % applied to the subtotal. Requires sales.discount permission.',
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    @Max(100)
    Discount?: number;

    @ApiPropertyOptional({
        minimum: 0,
        maximum: 100,
        description:
            'Tax rate %. Omit to inherit product default; explicitly send 0 to override.',
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    @Max(100)
    TaxRate?: number;

    @ApiPropertyOptional({ maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    Notes?: string;
}