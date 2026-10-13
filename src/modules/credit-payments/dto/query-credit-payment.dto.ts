import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreditPaymentMethod } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
    IsBoolean,
    IsDateString,
    IsEnum,
    IsIn,
    IsOptional,
    IsUUID,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const SORTABLE = ['PaidAt', 'Amount', 'CreatedAt'] as const;
export type CreditPaymentSortField = (typeof SORTABLE)[number];

const toBool = ({ value }: { value: unknown }): unknown => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
};

export class QueryCreditPaymentDto extends PaginationDto {
    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    CustomerId?: string;

    @ApiPropertyOptional({ enum: CreditPaymentMethod })
    @IsOptional()
    @IsEnum(CreditPaymentMethod)
    Method?: CreditPaymentMethod;

    @ApiPropertyOptional({
        description: 'Only return non-reversed payments',
        default: false,
    })
    @IsOptional()
    @Transform(toBool)
    @IsBoolean()
    excludeReversed?: boolean;

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
    override sortBy?: CreditPaymentSortField;

    @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    override sortOrder: 'asc' | 'desc' = 'desc';
}