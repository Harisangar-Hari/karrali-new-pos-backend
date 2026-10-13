import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SalePaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
    IsDateString,
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    MaxLength,
    Min,
    MinLength,
    ValidateIf,
} from 'class-validator';

export class SalePaymentDto {
    @ApiProperty({ enum: SalePaymentMethod })
    @IsEnum(SalePaymentMethod)
    Method!: SalePaymentMethod;

    @ApiProperty({ minimum: 0.0001, example: 500.0 })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(0.0001)
    Amount!: number;

    // ---------------------------------------------------------------
    // Cheque-only fields. Required when Method = CHEQUE, ignored otherwise.
    // ---------------------------------------------------------------

    @ApiPropertyOptional({ example: '000456' })
    @ValidateIf((o) => o.Method === SalePaymentMethod.CHEQUE)
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

    @ApiPropertyOptional({ example: '2026-10-12T00:00:00.000Z' })
    @ValidateIf((o) => o.Method === SalePaymentMethod.CHEQUE)
    @IsDateString()
    ChequeIssueDate?: string;

    @ApiPropertyOptional({
        example: '2026-11-11T00:00:00.000Z',
        description: 'When the cheque should be presented.',
    })
    @ValidateIf((o) => o.Method === SalePaymentMethod.CHEQUE)
    @IsDateString()
    ChequeDueDate?: string;

    @ApiPropertyOptional({ maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    Notes?: string;
}