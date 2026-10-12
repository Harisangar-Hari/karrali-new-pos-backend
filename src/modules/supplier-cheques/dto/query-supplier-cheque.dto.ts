import { ApiPropertyOptional } from '@nestjs/swagger';
import { SupplierChequeStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const SORTABLE = ['DueDate', 'IssueDate', 'Amount', 'CreatedAt'] as const;
export type SupplierChequeSortField = (typeof SORTABLE)[number];

export class QuerySupplierChequeDto extends PaginationDto {
    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    SupplierId?: string;

    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    PurchaseId?: string;

    @ApiPropertyOptional({ enum: SupplierChequeStatus })
    @IsOptional()
    @IsEnum(SupplierChequeStatus)
    Status?: SupplierChequeStatus;

    @ApiPropertyOptional({
        description: 'DueDate <= (ISO 8601). Use for "cheques due in next 7 days".',
    })
    @IsOptional()
    @IsDateString()
    dueBefore?: string;

    @ApiPropertyOptional({
        description: 'DueDate >= (ISO 8601). Use for calendar range start.',
    })
    @IsOptional()
    @IsDateString()
    dueAfter?: string;

    @ApiPropertyOptional({ enum: SORTABLE, default: 'DueDate' })
    @IsOptional()
    @IsIn(SORTABLE as unknown as string[])
    override sortBy?: SupplierChequeSortField;

    @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    override sortOrder: 'asc' | 'desc' = 'asc';
}