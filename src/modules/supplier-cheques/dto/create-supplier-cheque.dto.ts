import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsDateString,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    Min,
    MinLength,
} from 'class-validator';

export class CreateSupplierChequeDto {
    @ApiProperty({
        format: 'uuid',
        description: 'Purchase (AP invoice) this cheque pays against.',
    })
    @IsUUID()
    PurchaseId!: string;

    @ApiProperty({
        example: '000123',
        description: 'Physical cheque number (printed on the cheque).',
        maxLength: 32,
    })
    @IsString()
    @MinLength(1)
    @MaxLength(32)
    ChequeNumber!: string;

    @ApiPropertyOptional({
        example: 'Commercial Bank',
        description: 'Our bank. Phase 5 will link to a BankAccount record.',
        maxLength: 100,
    })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    BankName?: string;

    @ApiProperty({ minimum: 0.0001, example: 2500.0 })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(0.0001)
    Amount!: number;

    @ApiProperty({
        example: '2026-10-12T00:00:00.000Z',
        description: 'Date the cheque was written.',
    })
    @IsDateString()
    IssueDate!: string;

    @ApiProperty({
        example: '2026-11-11T00:00:00.000Z',
        description: 'Date to present for payment (cheque calendar uses this).',
    })
    @IsDateString()
    DueDate!: string;

    @ApiPropertyOptional({ maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    Notes?: string;
}