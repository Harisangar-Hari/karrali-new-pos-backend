import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export type SortOrder = 'asc' | 'desc';

/**
 * Base DTO for any list endpoint. Modules extend this to add their own
 * filters (e.g. `IsActive`, `CategoryId`).
 *
 * `search` and `sortBy` are intentionally loose strings — each service
 * decides which fields they map to (whitelist per module to avoid
 * Prisma errors on unknown fields).
 */
export class PaginationDto {
    @ApiPropertyOptional({ default: DEFAULT_PAGE, minimum: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page: number = DEFAULT_PAGE;

    @ApiPropertyOptional({
        default: DEFAULT_LIMIT,
        minimum: 1,
        maximum: MAX_LIMIT,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(MAX_LIMIT)
    limit: number = DEFAULT_LIMIT;

    @ApiPropertyOptional({ description: 'Free-text search (module-defined fields)' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ description: 'Field to sort by (module-whitelisted)' })
    @IsOptional()
    @IsString()
    sortBy?: string;

    @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    sortOrder: SortOrder = 'desc';

    /** Convenience getter — `(page - 1) * limit`. */
    get skip(): number {
        return (this.page - 1) * this.limit;
    }
}

export interface PageMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

export interface PaginatedResponse<T> {
    data: T[];
    meta: PageMeta;
}