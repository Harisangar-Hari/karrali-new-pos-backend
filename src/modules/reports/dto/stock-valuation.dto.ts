import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const SORTABLE = ['Name', 'Qty', 'Value'] as const;
export type StockValuationSortField = (typeof SORTABLE)[number];

const toBool = ({ value }: { value: unknown }): unknown => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
};

export class StockValuationQueryDto extends PaginationDto {
    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    WarehouseId?: string;

    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    CategoryId?: string;

    @ApiPropertyOptional({
        default: false,
        description: 'Only include products with non-zero quantity.',
    })
    @IsOptional()
    @Transform(toBool)
    @IsBoolean()
    InStockOnly?: boolean;

    @ApiPropertyOptional({ enum: SORTABLE, default: 'Value' })
    @IsOptional()
    @IsIn(SORTABLE as unknown as string[])
    override sortBy?: StockValuationSortField;

    @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    override sortOrder: 'asc' | 'desc' = 'desc';
}