//src/modules/loyalty/dto/query-loyalty-transaction.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LoyaltyTransactionType } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const SORTABLE = ['CreatedAt', 'Points'] as const;
export type LoyaltyTransactionSortField = (typeof SORTABLE)[number];

export class QueryLoyaltyTransactionDto extends PaginationDto {
    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    CustomerId?: string;

    @ApiPropertyOptional({ enum: LoyaltyTransactionType })
    @IsOptional()
    @IsEnum(LoyaltyTransactionType)
    Type?: LoyaltyTransactionType;

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
    override sortBy?: LoyaltyTransactionSortField;

    @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    override sortOrder: 'asc' | 'desc' = 'desc';
}