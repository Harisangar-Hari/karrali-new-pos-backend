import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateCustomerChequeDto } from './create-customer-cheque.dto';

export class BulkCreateCustomerChequeDto {
    @ApiProperty({
        type: [CreateCustomerChequeDto],
        description:
            'Batch of cheques. All are validated and created atomically — if one fails, none are written.',
    })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => CreateCustomerChequeDto)
    Cheques!: CreateCustomerChequeDto[];
}