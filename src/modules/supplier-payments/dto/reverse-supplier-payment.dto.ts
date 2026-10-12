import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ReverseSupplierPaymentDto {
    @ApiProperty({
        description:
            'Reason for reversing this payment. Required — stored in the audit log.',
        maxLength: 500,
        example: 'Duplicate entry — original payment recorded twice',
    })
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    Reason!: string;
}