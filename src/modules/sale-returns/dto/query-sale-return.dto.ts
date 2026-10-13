import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const SORTABLE = ['CreatedAt', 'RefundAmount'] as const;
export type SaleReturnSortField = (typeof SORTABLE)[number];

export class QuerySaleReturnDto extends PaginationDto {
    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    SaleId?: string;

    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    CustomerId?: string;

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
    override sortBy?: SaleReturnSortField;

    @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    override sortOrder: 'asc' | 'desc' = 'desc';
}