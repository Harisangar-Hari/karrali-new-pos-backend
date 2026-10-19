//src/modules/bank-accounts/dto/query-bank-account.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const SORTABLE = ['Name', 'BankName', 'CreatedAt'] as const;
export type BankAccountSortField = (typeof SORTABLE)[number];

const toBool = ({ value }: { value: unknown }): unknown => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
};

export class QueryBankAccountDto extends PaginationDto {
    @ApiPropertyOptional()
    @IsOptional()
    @Transform(toBool)
    @IsBoolean()
    IsActive?: boolean;

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @Transform(toBool)
    @IsBoolean()
    includeDeleted?: boolean;

    @ApiPropertyOptional({ enum: SORTABLE, default: 'Name' })
    @IsOptional()
    @IsIn(SORTABLE as unknown as string[])
    override sortBy?: BankAccountSortField;

    @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    override sortOrder: 'asc' | 'desc' = 'asc';
}