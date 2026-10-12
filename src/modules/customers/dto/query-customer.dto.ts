import { ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const SORTABLE = [
    'Name',
    'Code',
    'Type',
    'Balance',
    'CreditLimit',
    'CreatedAt',
    'UpdatedAt',
] as const;
export type CustomerSortField = (typeof SORTABLE)[number];

const toBool = ({ value }: { value: unknown }): unknown => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
};

export class QueryCustomerDto extends PaginationDto {
    @ApiPropertyOptional({ enum: CustomerType })
    @IsOptional()
    @IsEnum(CustomerType)
    Type?: CustomerType;

    @ApiPropertyOptional({ description: 'Filter by active flag' })
    @IsOptional()
    @Transform(toBool)
    @IsBoolean()
    IsActive?: boolean;

    @ApiPropertyOptional({
        description: 'Only return customers with a non-zero balance',
    })
    @IsOptional()
    @Transform(toBool)
    @IsBoolean()
    withBalance?: boolean;

    @ApiPropertyOptional({
        description: 'Include soft-deleted customers',
        default: false,
    })
    @IsOptional()
    @Transform(toBool)
    @IsBoolean()
    includeDeleted?: boolean;

    @ApiPropertyOptional({ enum: SORTABLE, default: 'Name' })
    @IsOptional()
    @IsIn(SORTABLE as unknown as string[])
    override sortBy?: CustomerSortField;

    @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    override sortOrder: 'asc' | 'desc' = 'asc';
}