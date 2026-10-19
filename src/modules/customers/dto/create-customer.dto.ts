//src/modules/customers/dto/create-customer.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
    IsBoolean,
    IsEmail,
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    MaxLength,
    Min,
    MinLength,
} from 'class-validator';

const emptyToNull = ({ value }: { value: unknown }): unknown => {
    if (typeof value === 'string' && value.trim() === '') return null;
    return value;
};

export class CreateCustomerDto {
    @ApiProperty({ example: 'Nimal Perera', maxLength: 200 })
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    Name!: string;

    @ApiPropertyOptional({ enum: CustomerType, default: CustomerType.RETAIL })
    @IsOptional()
    @IsEnum(CustomerType)
    Type?: CustomerType;

    @ApiPropertyOptional({ example: '0771234567', maxLength: 32 })
    @IsOptional()
    @Transform(emptyToNull)
    @IsString()
    @MaxLength(32)
    Phone?: string | null;

    @ApiPropertyOptional({ example: 'nimal@example.com', maxLength: 200 })
    @IsOptional()
    @Transform(emptyToNull)
    @IsEmail()
    @MaxLength(200)
    Email?: string | null;

    @ApiPropertyOptional({ maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    Address?: string;

    @ApiPropertyOptional({ example: 'VAT-1234567', maxLength: 64 })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    TaxNumber?: string;

    @ApiPropertyOptional({
        default: 0,
        minimum: 0,
        description:
            'Maximum outstanding balance. 0 means cash-only (no credit).',
    })
    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(0)
    CreditLimit?: number;

    @ApiPropertyOptional({ example: 'Net 30', maxLength: 100 })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    PaymentTerms?: string;

    @ApiPropertyOptional({ maxLength: 2000 })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    Notes?: string;

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    IsActive?: boolean;

    @ApiPropertyOptional({
        default: 0,
        description:
            'Opening balance (positive = customer owes us). If non-zero, writes an OPENING ledger entry.',
        example: 0,
    })
    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 4 })
    OpeningBalance?: number;
}