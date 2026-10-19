//src/modules/sale-returns/dto/sale-return-item.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    Min,
} from 'class-validator';

export class SaleReturnItemDto {
    @ApiProperty({
        format: 'uuid',
        description:
            'Original SaleItem row being returned. Pricing and tax are taken from that snapshot — not from the client.',
    })
    @IsUUID()
    SaleItemId!: string;

    @ApiProperty({
        minimum: 1,
        example: 1,
        description:
            'How many units are coming back. Cannot exceed the remaining returnable qty on that line.',
    })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    Qty!: number;

    @ApiPropertyOptional({ maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    Notes?: string;
}