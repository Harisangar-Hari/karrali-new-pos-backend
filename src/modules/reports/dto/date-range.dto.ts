//src/modules/reports/dto/date-range.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

/**
 * Base date range. Both inclusive. Omit either side to leave that
 * boundary open. If both are omitted, reports default to "today"
 * (server local time).
 */
export class DateRangeDto {
    @ApiPropertyOptional({
        example: '2026-10-01T00:00:00.000Z',
        description: 'Inclusive lower bound (ISO 8601).',
    })
    @IsOptional()
    @IsDateString()
    From?: string;

    @ApiPropertyOptional({
        example: '2026-10-31T23:59:59.999Z',
        description: 'Inclusive upper bound (ISO 8601).',
    })
    @IsOptional()
    @IsDateString()
    To?: string;
}