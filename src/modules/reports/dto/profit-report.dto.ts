import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { DateRangeDto } from './date-range.dto';

export const PROFIT_GROUPS = ['none', 'day', 'week', 'month'] as const;
export type ProfitGroup = (typeof PROFIT_GROUPS)[number];

export class ProfitReportQueryDto extends DateRangeDto {
    @ApiPropertyOptional({
        enum: PROFIT_GROUPS,
        default: 'none',
        description:
            'Time bucket. "none" returns per-product rows for the whole window.',
    })
    @IsOptional()
    @IsIn(PROFIT_GROUPS as unknown as string[])
    GroupBy?: ProfitGroup;

    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    TerminalId?: string;

    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    CategoryId?: string;

    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    ProductId?: string;

    @ApiPropertyOptional({
        default: false,
        description:
            'Include products with zero sales in the window (only useful when ProductId is set).',
    })
    @IsOptional()
    IncludeZeroSales?: boolean;
}