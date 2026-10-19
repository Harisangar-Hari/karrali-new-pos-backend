//src/modules/supplier-payments/dto/query-supplier-payment.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SupplierPaymentMethod } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const SORTABLE = ['PaidAt', 'Amount', 'CreatedAt'] as const;
export type SupplierPaymentSortField = (typeof SORTABLE)[number];

export class QuerySupplierPaymentDto extends PaginationDto {
    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    SupplierId?: string;

    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    PurchaseId?: string;

    @ApiPropertyOptional({ enum: SupplierPaymentMethod })
    @IsOptional()
    @IsEnum(SupplierPaymentMethod)
    Method?: SupplierPaymentMethod;

    @ApiPropertyOptional({ description: 'PaidAt >= (ISO 8601)' })
    @IsOptional()
    @IsDateString()
    From?: string;

    @ApiPropertyOptional({ description: 'PaidAt <= (ISO 8601)' })
    @IsOptional()
    @IsDateString()
    To?: string;

    @ApiPropertyOptional({ enum: SORTABLE, default: 'PaidAt' })
    @IsOptional()
    @IsIn(SORTABLE as unknown as string[])
    override sortBy?: SupplierPaymentSortField;

    @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    override sortOrder: 'asc' | 'desc' = 'desc';
}