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

export class PurchaseItemDto {
    @ApiProperty({ format: 'uuid' })
    @IsUUID()
    ProductId!: string;

    @ApiProperty({ minimum: 1, example: 100 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    Qty!: number;

    @ApiProperty({
        minimum: 0,
        example: 180.0,
        description: 'Unit cost for this line',
    })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(0)
    UnitCost!: number;

    @ApiPropertyOptional({
        minimum: 0,
        maximum: 100,
        description:
            'Tax rate %. Omit to inherit the product default; explicitly send 0 to override to no tax.',
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