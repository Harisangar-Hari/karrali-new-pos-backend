//src/modules/quotations/dto/create-quotation.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsDateString,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    ValidateNested,
} from 'class-validator';
import { QuotationItemDto } from './quotation-item.dto';

export class CreateQuotationDto {
    @ApiPropertyOptional({
        format: 'uuid',
        description: 'Customer. Optional — walk-in quotes are allowed.',
    })
    @IsOptional()
    @IsUUID()
    CustomerId?: string;

    @ApiPropertyOptional({
        description:
            'When the quote stops being valid. Informational only — no auto-expiry.',
        example: '2026-11-13T00:00:00.000Z',
    })
    @IsOptional()
    @IsDateString()
    ValidUntil?: string;

    @ApiPropertyOptional({ maxLength: 2000 })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    Notes?: string;

    @ApiProperty({ type: [QuotationItemDto] })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => QuotationItemDto)
    Items!: QuotationItemDto[];
}