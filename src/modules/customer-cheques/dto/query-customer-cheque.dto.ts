import { ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerChequeStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const SORTABLE = ['DueDate', 'IssueDate', 'Amount', 'CreatedAt'] as const;
export type CustomerChequeSortField = (typeof SORTABLE)[number];

export class QueryCustomerChequeDto extends PaginationDto {
    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    CustomerId?: string;

    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    SaleId?: string;

    @ApiPropertyOptional({ enum: CustomerChequeStatus })
    @IsOptional()
    @IsEnum(CustomerChequeStatus)
    Status?: CustomerChequeStatus;

    @ApiPropertyOptional({ description: 'DueDate >= (ISO 8601)' })
    @IsOptional()
    @IsDateString()
    dueAfter?: string;

    @ApiPropertyOptional({ description: 'DueDate <= (ISO 8601)' })
    @IsOptional()
    @IsDateString()
    dueBefore?: string;

    @ApiPropertyOptional({ enum: SORTABLE, default: 'DueDate' })
    @IsOptional()
    @IsIn(SORTABLE as unknown as string[])
    override sortBy?: CustomerChequeSortField;

    @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    override sortOrder: 'asc' | 'desc' = 'asc';
}