import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { DateRangeDto } from './date-range.dto';

export const CASH_FLOW_GROUPS = ['day', 'week', 'month'] as const;
export type CashFlowGroup = (typeof CASH_FLOW_GROUPS)[number];

export class CashFlowQueryDto extends DateRangeDto {
    @ApiPropertyOptional({
        enum: CASH_FLOW_GROUPS,
        default: 'day',
    })
    @IsOptional()
    @IsIn(CASH_FLOW_GROUPS as unknown as string[])
    GroupBy?: CashFlowGroup;

    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    TerminalId?: string;

    @ApiPropertyOptional({
        format: 'uuid',
        description:
            'Scope to a single cash session. Overrides From/To with the session window.',
    })
    @IsOptional()
    @IsUUID()
    CashSessionId?: string;
}