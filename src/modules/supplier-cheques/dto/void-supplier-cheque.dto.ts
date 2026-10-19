//src/modules/supplier-cheques/dto/void-supplier-cheque.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class VoidSupplierChequeDto {
    @ApiProperty({
        description: 'Why the cheque is being voided before clearing.',
        example: 'Written to wrong supplier — reissuing',
        maxLength: 500,
    })
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    Reason!: string;
}