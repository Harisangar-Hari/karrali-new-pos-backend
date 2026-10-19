//src/modules/sale-returns/dto/create-sale-return.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SaleReturnRefundMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsEnum,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    ValidateNested,
} from 'class-validator';
import { SaleReturnItemDto } from './sale-return-item.dto';

export class CreateSaleReturnDto {
    @ApiProperty({ format: 'uuid' })
    @IsUUID()
    SaleId!: string;

    @ApiProperty({
        enum: SaleReturnRefundMethod,
        description:
            'CASH — refund from the drawer (writes a negative CashLedger entry). CREDIT — reduce what the customer owes (may go negative = store credit).',
    })
    @IsEnum(SaleReturnRefundMethod)
    RefundMethod!: SaleReturnRefundMethod;

    @ApiPropertyOptional({
        description:
            'Required when RefundMethod=CREDIT. Customer balance is credited by the refund amount.',
        format: 'uuid',
    })
    @IsOptional()
    @IsUUID()
    CustomerId?: string;

    @ApiPropertyOptional({ maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    Notes?: string;

    @ApiProperty({ type: [SaleReturnItemDto] })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => SaleReturnItemDto)
    Items!: SaleReturnItemDto[];
}