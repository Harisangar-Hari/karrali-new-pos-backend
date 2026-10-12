import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockMovementType } from '@prisma/client';
import {
    IsEnum,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    Min,
    NotEquals,
} from 'class-validator';

/**
 * Manual stock adjustment. Manual writes are limited to OPENING and
 * ADJUSTMENT — PURCHASE / SALE / *RETURN / TRANSFER_* are produced
 * internally by their respective modules and are never accepted from
 * a client.
 */
export class AdjustStockDto {
    @ApiProperty({ format: 'uuid' })
    @IsUUID()
    ProductId!: string;

    @ApiProperty({ format: 'uuid' })
    @IsUUID()
    WarehouseId!: string;

    @ApiProperty({
        description:
            'Signed quantity. Positive = into warehouse, negative = out.',
        example: 10,
    })
    @IsInt()
    @NotEquals(0, { message: 'Quantity must be non-zero' })
    Quantity!: number;

    @ApiProperty({
        enum: [StockMovementType.OPENING, StockMovementType.ADJUSTMENT],
        description: 'Only OPENING and ADJUSTMENT are allowed manually',
    })
    @IsEnum(StockMovementType)
    Type!: StockMovementType;

    @ApiPropertyOptional({
        description: 'Unit cost for this movement (COGS baseline). Optional.',
        minimum: 0,
    })
    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(0)
    UnitCost?: number;

    @ApiPropertyOptional({ maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    Notes?: string;
}