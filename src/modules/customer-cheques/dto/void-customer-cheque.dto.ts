import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class VoidCustomerChequeDto {
    @ApiProperty({
        example: 'Wrong amount — reissuing',
        maxLength: 500,
    })
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    Reason!: string;
}