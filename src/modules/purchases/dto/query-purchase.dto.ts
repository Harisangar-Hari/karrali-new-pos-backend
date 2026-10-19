//src/modules/purchases/dto/query-purchase.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PurchaseStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const SORTABLE = ['InvoiceDate', 'DueDate', 'CreatedAt', 'TotalAmount'] as const;
export type PurchaseSortField = (typeof SORTABLE)[number];

export class QueryPurchaseDto extends PaginationDto {
    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    SupplierId?: string;

    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    WarehouseId?: string;

    @ApiPropertyOptional({ enum: PurchaseStatus })
    @IsOptional()
    @IsEnum(PurchaseStatus)
    Status?: PurchaseStatus;

    @ApiPropertyOptional({ description: 'InvoiceDate >= (ISO 8601)' })
    @IsOptional()
    @IsDateString()
    From?: string;

    @ApiPropertyOptional({ description: 'InvoiceDate <= (ISO 8601)' })
    @IsOptional()
    @IsDateString()
    To?: string;

    @ApiPropertyOptional({
        description: 'Search by Code or SupplierInvoiceNo',
    })
    @IsOptional()
    override search?: string;

    @ApiPropertyOptional({ enum: SORTABLE, default: 'InvoiceDate' })
    @IsOptional()
    @IsIn(SORTABLE as unknown as string[])
    override sortBy?: PurchaseSortField;

    @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    override sortOrder: 'asc' | 'desc' = 'desc';
}