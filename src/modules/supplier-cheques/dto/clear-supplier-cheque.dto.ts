import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class ClearSupplierChequeDto {
    @ApiPropertyOptional({
        description: 'Date the bank confirmed clearing. Defaults to now.',
        example: '2026-11-11T00:00:00.000Z',
    })
    @IsOptional()
    @IsDateString()
    ClearedAt?: string;

    @ApiPropertyOptional({ maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    Notes?: string;
}