import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    ValidateNested,
} from 'class-validator';
import { SaleItemDto } from './sale-item.dto';
import { SalePaymentDto } from './sale-payment.dto';

export class CreateSaleDto {
    @ApiProperty({ format: 'uuid' })
    @IsUUID()
    TerminalId!: string;

    @ApiPropertyOptional({
        format: 'uuid',
        description:
            'Customer. Required if any payment has Method=CREDIT. Null = walk-in.',
    })
    @IsOptional()
    @IsUUID()
    CustomerId?: string;

    @ApiPropertyOptional({ maxLength: 2000 })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    Notes?: string;

    @ApiProperty({ type: [SaleItemDto] })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => SaleItemDto)
    Items!: SaleItemDto[];

    @ApiProperty({
        type: [SalePaymentDto],
        description:
            'Payment split. Amounts must sum exactly to TotalAmount. Mix CASH / CARD / CREDIT / CHEQUE freely.',
    })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => SalePaymentDto)
    Payments!: SalePaymentDto[];
}