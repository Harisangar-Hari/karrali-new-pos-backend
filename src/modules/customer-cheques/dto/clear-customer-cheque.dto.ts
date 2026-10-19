//src/modules/customer-cheques/dto/clear-customer-cheque.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class ClearCustomerChequeDto {
    @ApiPropertyOptional({ example: '2026-11-13T00:00:00.000Z' })
    @IsOptional()
    @IsDateString()
    ClearedAt?: string;

    @ApiPropertyOptional({ maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    Notes?: string;
}