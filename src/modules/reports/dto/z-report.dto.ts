//src/modules/reports/dto/z-report.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ZReportQueryDto {
    @ApiProperty({
        example: '2026-10-13',
        description:
            'Business date (YYYY-MM-DD). Interpreted in server local time.',
    })
    @IsDateString()
    Date!: string;

    @ApiPropertyOptional({
        format: 'uuid',
        description: 'Scope to one terminal. Omit for store-wide.',
    })
    @IsOptional()
    @IsUUID()
    TerminalId?: string;

    @ApiPropertyOptional({
        format: 'uuid',
        description:
            'Scope to one cash session. If given, TerminalId is derived from the session.',
    })
    @IsOptional()
    @IsUUID()
    CashSessionId?: string;
}