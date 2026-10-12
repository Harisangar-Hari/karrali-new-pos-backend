import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * Audit logs are append-only and always sorted newest-first. Sort
 * params are intentionally not exposed — no other ordering makes
 * sense for an audit trail.
 */
export class QueryAuditLogDto extends PaginationDto {
    @ApiPropertyOptional({ format: 'uuid', description: 'Filter by actor' })
    @IsOptional()
    @IsUUID()
    UserId?: string;

    @ApiPropertyOptional({
        example: 'PRODUCT_UPDATED',
        description: 'Exact match on Action (SCREAMING_SNAKE_CASE)',
    })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    Action?: string;

    @ApiPropertyOptional({
        example: 'Product',
        description: 'Exact match on Entity (PascalCase model name)',
    })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    Entity?: string;

    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    EntityId?: string;

    @ApiPropertyOptional({
        description: 'Inclusive lower bound (ISO 8601)',
        example: '2026-01-01T00:00:00.000Z',
    })
    @IsOptional()
    @IsISO8601()
    From?: string;

    @ApiPropertyOptional({
        description: 'Inclusive upper bound (ISO 8601)',
        example: '2026-12-31T23:59:59.999Z',
    })
    @IsOptional()
    @IsISO8601()
    To?: string;

    @ApiPropertyOptional({
        description: 'Fuzzy match on Action / Entity',
    })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    override search?: string;

    /** Locked — audit lists are always newest-first. */
    @IsOptional()
    @IsIn(['CreatedAt'])
    override sortBy: 'CreatedAt' = 'CreatedAt';

    @IsOptional()
    @IsIn(['desc'])
    override sortOrder: 'desc' = 'desc';
}