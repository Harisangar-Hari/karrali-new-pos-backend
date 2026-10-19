//src/modules/credit-payments/dto/reverse-credit-payment.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ReverseCreditPaymentDto {
    @ApiProperty({
        example: 'Cashier entered wrong amount',
        maxLength: 500,
    })
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    Reason!: string;
}