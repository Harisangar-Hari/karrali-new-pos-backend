import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    IsBoolean,
    IsIn,
    IsNumber,
    IsOptional,
    IsUUID,
    Min,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const SORTABLE = [
    'Name',
    'SKU',
    'Price',
    'CostPrice',
    'CreatedAt',
    'UpdatedAt',
] as const;
export type ProductSortField = (typeof SORTABLE)[number];

const toBool = ({ value }: { value: unknown }): unknown => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
};

export class QueryProductDto extends PaginationDto {
    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    CategoryId?: string;

    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    BrandId?: string;

    @ApiPropertyOptional({ description: 'Filter by active flag' })
    @IsOptional()
    @Transform(toBool)
    @IsBoolean()
    IsActive?: boolean;

    @ApiPropertyOptional({
        description: 'Only return products at or below their ReorderLevel',
    })
    @IsOptional()
    @Transform(toBool)
    @IsBoolean()
    lowStock?: boolean;

    @ApiPropertyOptional({ minimum: 0, description: 'Min price (inclusive)' })
    @IsOptional()
    @Transform(({ value }) => (value === '' || value === undefined ? undefined : Number(value)))
    @IsNumber()
    @Min(0)
    minPrice?: number;

    @ApiPropertyOptional({ minimum: 0, description: 'Max price (inclusive)' })
    @IsOptional()
    @Transform(({ value }) => (value === '' || value === undefined ? undefined : Number(value)))
    @IsNumber()
    @Min(0)
    maxPrice?: number;

    @ApiPropertyOptional({
        description: 'Include soft-deleted products in the result set',
        default: false,
    })
    @IsOptional()
    @Transform(toBool)
    @IsBoolean()
    includeDeleted?: boolean;

    @ApiPropertyOptional({ enum: SORTABLE, default: 'CreatedAt' })
    @IsOptional()
    @IsIn(SORTABLE as unknown as string[])
    override sortBy?: ProductSortField;

    @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    override sortOrder: 'asc' | 'desc' = 'desc';
}