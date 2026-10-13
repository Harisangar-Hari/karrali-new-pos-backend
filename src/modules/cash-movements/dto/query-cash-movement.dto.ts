import { ApiPropertyOptional } from '@nestjs/swagger';
import { CashMovementType } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const SORTABLE = ['CreatedAt', 'Amount'] as const;
export type CashMovementSortField = (typeof SORTABLE)[number];

export class QueryCashMovementDto extends PaginationDto {
    @ApiPropertyOptional({ enum: CashMovementType })
    @IsOptional()
    @IsEnum(CashMovementType)
    Type?: CashMovementType;

    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    BankAccountId?: string;

    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    CashSessionId?: string;

    @ApiPropertyOptional({ description: 'CreatedAt >= (ISO 8601)' })
    @IsOptional()
    @IsDateString()
    From?: string;

    @ApiPropertyOptional({ description: 'CreatedAt <= (ISO 8601)' })
    @IsOptional()
    @IsDateString()
    To?: string;

    @ApiPropertyOptional({ enum: SORTABLE, default: 'CreatedAt' })
    @IsOptional()
    @IsIn(SORTABLE as unknown as string[])
    override sortBy?: CashMovementSortField;

    @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    override sortOrder: 'asc' | 'desc' = 'desc';
}