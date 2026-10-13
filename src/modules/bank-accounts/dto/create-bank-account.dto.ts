import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsBoolean,
    IsOptional,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';

export class CreateBankAccountDto {
    @ApiProperty({ example: 'Main Operating Account', maxLength: 100 })
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    Name!: string;

    @ApiProperty({ example: 'Commercial Bank', maxLength: 100 })
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    BankName!: string;

    @ApiProperty({ example: '8001234567', maxLength: 50 })
    @IsString()
    @MinLength(1)
    @MaxLength(50)
    AccountNumber!: string;

    @ApiPropertyOptional({ example: 'Colombo Main', maxLength: 100 })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    Branch?: string;

    @ApiPropertyOptional({ example: 'CCEYLKLX', maxLength: 20 })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    Swift?: string;

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    IsDefault?: boolean;

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    IsActive?: boolean;
}