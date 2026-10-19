//src/modules/quotations/dto/query-quotation.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { QuotationStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const SORTABLE = ['CreatedAt', 'ValidUntil', 'TotalAmount', 'Code'] as const;
export type QuotationSortField = (typeof SORTABLE)[number];

export class QueryQuotationDto extends PaginationDto {
    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    CustomerId?: string;

    @ApiPropertyOptional({ enum: QuotationStatus })
    @IsOptional()
    @IsEnum(QuotationStatus)
    Status?: QuotationStatus;

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
    override sortBy?: QuotationSortField;

    @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    override sortOrder: 'asc' | 'desc' = 'desc';
}