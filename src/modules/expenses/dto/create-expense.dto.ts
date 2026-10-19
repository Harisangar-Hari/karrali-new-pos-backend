//src/modules/expenses/dto/create-expense.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExpensePaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
    IsDateString,
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    Min,
    MinLength,
} from 'class-validator';

export class CreateExpenseDto {
    @ApiProperty({ format: 'uuid' })
    @IsUUID()
    CategoryId!: string;

    @ApiProperty({ minimum: 0.0001, example: 15000.0 })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(0.0001)
    Amount!: number;

    @ApiProperty({
        enum: ExpensePaymentMethod,
        description:
            'CASH — drawer loses cash (writes negative CashLedger entry). BANK — no cash effect.',
    })
    @IsEnum(ExpensePaymentMethod)
    Method!: ExpensePaymentMethod;

    @ApiPropertyOptional({
        format: 'uuid',
        description: 'Required when Method = BANK. Ignored when Method = CASH.',
    })
    @IsOptional()
    @IsUUID()
    BankAccountId?: string;

    @ApiProperty({ example: 'October electricity bill', maxLength: 500 })
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    Description!: string;

    @ApiPropertyOptional({
        example: 'Ceylon Electricity Board',
        description: 'Free-text payee. Does not have to be a registered supplier.',
        maxLength: 200,
    })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    Payee?: string;

    @ApiPropertyOptional({
        description: 'Defaults to now.',
        example: '2026-10-13T10:30:00.000Z',
    })
    @IsOptional()
    @IsDateString()
    PaidAt?: string;

    @ApiPropertyOptional({ maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    Notes?: string;
}