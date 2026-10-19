//src/modules/supplier-payments/dto/create-supplier-payment.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupplierPaymentMethod } from '@prisma/client';
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
} from 'class-validator';

export class CreateSupplierPaymentDto {
    @ApiProperty({
        format: 'uuid',
        description:
            'Purchase (AP invoice) this payment settles. SupplierId is derived from the purchase — do not send it.',
    })
    @IsUUID()
    PurchaseId!: string;

    @ApiProperty({
        enum: [SupplierPaymentMethod.CASH, SupplierPaymentMethod.BANK_TRANSFER],
        description:
            'Only CASH and BANK_TRANSFER accepted here. CHEQUE payments are created by clearing a SupplierCheque.',
    })
    @IsEnum(SupplierPaymentMethod)
    Method!: SupplierPaymentMethod;

    @ApiProperty({ minimum: 0.0001, example: 1500.0 })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(0.0001)
    Amount!: number;

    @ApiPropertyOptional({
        description: 'Payment date (ISO 8601). Defaults to now if omitted.',
        example: '2026-10-12T14:30:00.000Z',
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