import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreditPaymentMethod } from '@prisma/client';
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
    ValidateIf,
} from 'class-validator';

export class CreateCreditPaymentDto {
    @ApiProperty({ format: 'uuid' })
    @IsUUID()
    CustomerId!: string;

    @ApiProperty({
        enum: CreditPaymentMethod,
        description:
            'CASH — drawer gains cash, customer balance drops immediately. CHEQUE — creates a PENDING CustomerCheque; balance drops now, will reverse if the cheque bounces.',
    })
    @IsEnum(CreditPaymentMethod)
    Method!: CreditPaymentMethod;

    @ApiProperty({ minimum: 0.0001, example: 3000.0 })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(0.0001)
    Amount!: number;

    @ApiPropertyOptional({ example: '2026-10-13T10:30:00.000Z' })
    @IsOptional()
    @IsDateString()
    PaidAt?: string;

    // ---------------------------------------------------------------
    // Cheque-only fields. Required when Method = CHEQUE.
    // ---------------------------------------------------------------

    @ApiPropertyOptional({ example: '000789' })
    @ValidateIf((o) => o.Method === CreditPaymentMethod.CHEQUE)
    @IsString()
    @MinLength(1)
    @MaxLength(32)
    ChequeNumber?: string;

    @ApiPropertyOptional({ example: 'Commercial Bank' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    BankName?: string;

    @ApiPropertyOptional({ example: 'Colombo Main' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    BankBranch?: string;

    @ApiPropertyOptional({ example: '2026-10-13T00:00:00.000Z' })
    @ValidateIf((o) => o.Method === CreditPaymentMethod.CHEQUE)
    @IsDateString()
    ChequeIssueDate?: string;

    @ApiPropertyOptional({ example: '2026-11-13T00:00:00.000Z' })
    @ValidateIf((o) => o.Method === CreditPaymentMethod.CHEQUE)
    @IsDateString()
    ChequeDueDate?: string;

    @ApiPropertyOptional({ maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    Notes?: string;
}