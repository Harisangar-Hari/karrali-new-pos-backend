//src/modules/quotations/dto/quotation-item.dto.ts
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

export class QuotationItemDto {
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
            'Quoted unit price. Frozen at quote time — subsequent Product.Price changes do not affect this quote.',
    })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(0)
    UnitPrice!: number;

    @ApiPropertyOptional({
        minimum: 0,
        maximum: 100,
        description: 'Line discount %. Requires sales.discount permission.',
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
        description: 'Tax rate %. Omit to inherit product default.',
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