//src/modules/cash-sessions/dto/query-cash-ledger.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CashLedgerType } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryCashLedgerDto extends PaginationDto {
    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    CashSessionId?: string;

    @ApiPropertyOptional({ enum: CashLedgerType })
    @IsOptional()
    @IsEnum(CashLedgerType)
    Type?: CashLedgerType;

    @ApiPropertyOptional({ description: 'CreatedAt >= (ISO 8601)' })
    @IsOptional()
    @IsDateString()
    From?: string;

    @ApiPropertyOptional({ description: 'CreatedAt <= (ISO 8601)' })
    @IsOptional()
    @IsDateString()
    To?: string;

    @ApiPropertyOptional({ default: 'CreatedAt' })
    @IsOptional()
    @IsIn(['CreatedAt'])
    override sortBy: 'CreatedAt' = 'CreatedAt';

    @ApiPropertyOptional({ default: 'desc' })
    @IsOptional()
    @IsIn(['desc'])
    override sortOrder: 'desc' = 'desc';
}