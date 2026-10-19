//src/modules/sales/dto/create-sale.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    Min,
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

     @ApiPropertyOptional({
        minimum: 0,
        description:
            'Loyalty points to redeem on this sale. Requires CustomerId. Validated against balance, MinRedeem, and MaxRedeemPercent caps.',
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    RedeemPoints?: number;
}