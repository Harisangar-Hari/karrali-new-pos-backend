//src/modules/reports/dto/profit-report.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { DateRangeDto } from './date-range.dto';

export const SALES_SUMMARY_GROUPS = ['none', 'day', 'week', 'month'] as const;
export type SalesSummaryGroup = (typeof SALES_SUMMARY_GROUPS)[number];

export class SalesSummaryQueryDto extends DateRangeDto {
    @ApiPropertyOptional({
        enum: SALES_SUMMARY_GROUPS,
        default: 'day',
        description:
            'Time bucket for the result. "none" returns a single aggregate row for the whole window.',
    })
    @IsOptional()
    @IsIn(SALES_SUMMARY_GROUPS as unknown as string[])
    GroupBy?: SalesSummaryGroup;

    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    TerminalId?: string;

    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    CashierId?: string;
}