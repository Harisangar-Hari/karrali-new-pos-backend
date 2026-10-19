//src/modules/customer-cheques/dto/create-customer-cheque.dto.ts
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

export class CreateCustomerChequeDto {
    @ApiProperty({ format: 'uuid' })
    @IsUUID()
    CustomerId!: string;

    @ApiPropertyOptional({
        format: 'uuid',
        description:
            'Optional. Link to a specific sale invoice. Omit for general debt payment.',
    })
    @IsOptional()
    @IsUUID()
    SaleId?: string;

    @ApiProperty({ example: '000789', maxLength: 32 })
    @IsString()
    @MinLength(1)
    @MaxLength(32)
    ChequeNumber!: string;

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

    @ApiProperty({ minimum: 0.0001, example: 3000.0 })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(0.0001)
    Amount!: number;

    @ApiProperty({ example: '2026-10-13T00:00:00.000Z' })
    @IsDateString()
    IssueDate!: string;

    @ApiProperty({ example: '2026-11-13T00:00:00.000Z' })
    @IsDateString()
    DueDate!: string;

    @ApiPropertyOptional({ maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    Notes?: string;
}