//src/modules/expenses/dto/query-expense.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ExpensePaymentMethod } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const SORTABLE = ['PaidAt', 'Amount', 'CreatedAt'] as const;
export type ExpenseSortField = (typeof SORTABLE)[number];

export class QueryExpenseDto extends PaginationDto {
    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    CategoryId?: string;

    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    BankAccountId?: string;

    @ApiPropertyOptional({ enum: ExpensePaymentMethod })
    @IsOptional()
    @IsEnum(ExpensePaymentMethod)
    Method?: ExpensePaymentMethod;

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
    override sortBy?: ExpenseSortField;

    @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    override sortOrder: 'asc' | 'desc' = 'desc';
}