//src/modules/users/dto/query-user.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const SORTABLE = ['Username', 'FullName', 'CreatedAt', 'LastLogin'] as const;
export type UserSortField = (typeof SORTABLE)[number];

const toBool = ({ value }: { value: unknown }): unknown => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
};

export class QueryUserDto extends PaginationDto {
    @ApiPropertyOptional()
    @IsOptional()
    @Transform(toBool)
    @IsBoolean()
    IsActive?: boolean;

    @ApiPropertyOptional({ format: 'uuid', description: 'Filter by role' })
    @IsOptional()
    @IsUUID()
    RoleId?: string;

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @Transform(toBool)
    @IsBoolean()
    includeDeleted?: boolean;

    @ApiPropertyOptional({ enum: SORTABLE, default: 'Username' })
    @IsOptional()
    @IsIn(SORTABLE as unknown as string[])
    override sortBy?: UserSortField;

    @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    override sortOrder: 'asc' | 'desc' = 'asc';
}