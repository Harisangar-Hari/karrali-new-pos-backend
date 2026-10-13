import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ChequeCalendarQueryDto {
    @ApiPropertyOptional({
        description: 'DueDate >= (ISO 8601). Defaults to today.',
    })
    @IsOptional()
    @IsDateString()
    From?: string;

    @ApiPropertyOptional({
        description: 'DueDate <= (ISO 8601). Defaults to 30 days from today.',
    })
    @IsOptional()
    @IsDateString()
    To?: string;

    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    SupplierId?: string;

    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    CustomerId?: string;
}