//src/modules/categories/dto/query-category.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const SORTABLE = ['Name', 'IsActive', 'CreatedAt', 'UpdatedAt'] as const;
export type CategorySortField = (typeof SORTABLE)[number];

const toBool = ({ value }: { value: unknown }): unknown => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
};

export class QueryCategoryDto extends PaginationDto {
    @ApiPropertyOptional({
        format: 'uuid',
        description: 'Filter by parent. Send a UUID for children of that parent.',
    })
    @IsOptional()
    @IsUUID()
    ParentId?: string;

    @ApiPropertyOptional({
        description: 'When true, return only root categories (ParentId is null).',
    })
    @IsOptional()
    @Transform(toBool)
    @IsBoolean()
    rootOnly?: boolean;

    @ApiPropertyOptional({ description: 'Filter by active flag' })
    @IsOptional()
    @Transform(toBool)
    @IsBoolean()
    IsActive?: boolean;

    @ApiPropertyOptional({
        description: 'Include soft-deleted categories in the result set',
        default: false,
    })
    @IsOptional()
    @Transform(toBool)
    @IsBoolean()
    includeDeleted?: boolean;

    @ApiPropertyOptional({ enum: SORTABLE, default: 'Name' })
    @IsOptional()
    @IsIn(SORTABLE as unknown as string[])
    override sortBy?: CategorySortField;

    @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    override sortOrder: 'asc' | 'desc' = 'asc';
}