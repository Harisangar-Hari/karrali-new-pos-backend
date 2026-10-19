//src/modules/quotations/dto/convert-quotation.dto.ts
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
import { SalePaymentDto } from '../../sales/dto/sale-payment.dto';

export class ConvertQuotationDto {
    @ApiProperty({ format: 'uuid' })
    @IsUUID()
    TerminalId!: string;

    @ApiProperty({
        type: [SalePaymentDto],
        description:
            'Payment splits for the resulting sale. Amounts must sum to the quotation total.',
    })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => SalePaymentDto)
    Payments!: SalePaymentDto[];

    @ApiPropertyOptional({
        description: 'Extra note appended to the created sale.',
        maxLength: 1000,
    })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    Notes?: string;
}