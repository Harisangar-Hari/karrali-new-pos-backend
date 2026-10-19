//src/modules/suppliers/dto/create-supplier.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    IsBoolean,
    IsEmail,
    IsOptional,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';

const emptyToNull = ({ value }: { value: unknown }): unknown => {
    if (typeof value === 'string' && value.trim() === '') return null;
    return value;
};

export class CreateSupplierDto {
    @ApiProperty({ example: 'Ceylon Beverages (Pvt) Ltd', maxLength: 200 })
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    Name!: string;

    @ApiPropertyOptional({ example: '0112345678', maxLength: 32 })
    @IsOptional()
    @Transform(emptyToNull)
    @IsString()
    @MaxLength(32)
    Phone?: string | null;

    @ApiPropertyOptional({ example: 'orders@ceylonbev.lk', maxLength: 200 })
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

    @ApiPropertyOptional({ example: 'VAT-9876543', maxLength: 64 })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    TaxNumber?: string;

    @ApiPropertyOptional({ example: 'Net 30', maxLength: 100 })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    PaymentTerms?: string;

    @ApiPropertyOptional({ example: 'Commercial Bank', maxLength: 100 })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    BankName?: string;

    @ApiPropertyOptional({ example: '8001234567', maxLength: 50 })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    BankAccountNo?: string;

    @ApiPropertyOptional({ example: 'Colombo Main', maxLength: 100 })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    BankBranch?: string;

    @ApiPropertyOptional({ example: 'CCEYLKLX', maxLength: 20 })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    BankSwift?: string;

    @ApiPropertyOptional({ maxLength: 2000 })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    Notes?: string;

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    IsActive?: boolean;
}