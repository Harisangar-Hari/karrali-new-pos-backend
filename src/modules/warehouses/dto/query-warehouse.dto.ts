//src/modules/warehouses/dto/query-warehouse.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const SORTABLE = ['Name', 'Code', 'IsActive', 'CreatedAt', 'UpdatedAt'] as const;
export type WarehouseSortField = (typeof SORTABLE)[number];

/**
 * Query-string booleans arrive as strings. With `enableImplicitConversion`
 * on, `true`/`false` are usually coerced — but we make it explicit here so
 * undefined stays undefined (else `@IsOptional` never kicks in).
 */
const toBool = ({ value }: { value: unknown }): unknown => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
};

export class QueryWarehouseDto extends PaginationDto {
    @ApiPropertyOptional({ description: 'Filter by active flag' })
    @IsOptional()
    @Transform(toBool)
    @IsBoolean()
    IsActive?: boolean;

    @ApiPropertyOptional({
        description: 'Include soft-deleted warehouses in the result set',
        default: false,
    })
    @IsOptional()
    @Transform(toBool)
    @IsBoolean()
    includeDeleted?: boolean;

    @ApiPropertyOptional({ enum: SORTABLE, default: 'CreatedAt' })
    @IsOptional()
    @IsIn(SORTABLE as unknown as string[])
    override sortBy?: WarehouseSortField;
}