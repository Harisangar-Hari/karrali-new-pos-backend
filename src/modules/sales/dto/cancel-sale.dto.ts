import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CancelSaleDto {
    @ApiProperty({
        description: 'Reason for cancellation. Required — recorded on the sale and in the audit log.',
        maxLength: 500,
    })
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    Reason!: string;
}