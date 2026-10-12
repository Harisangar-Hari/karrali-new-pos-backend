import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsDateString,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    ValidateNested,
} from 'class-validator';
import { PurchaseItemDto } from './purchase-item.dto';

export class CreatePurchaseDto {
    @ApiProperty({ format: 'uuid' })
    @IsUUID()
    SupplierId!: string;

    @ApiPropertyOptional({
        description: "Supplier's own invoice number (for reconciliation)",
        maxLength: 100,
    })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    SupplierInvoiceNo?: string;

    @ApiProperty({
        description: 'Invoice date (ISO 8601)',
        example: '2026-10-12T00:00:00.000Z',
    })
    @IsDateString()
    InvoiceDate!: string;

    @ApiPropertyOptional({
        description: 'Payment due date (ISO 8601). Optional but recommended — drives AP aging.',
        example: '2026-11-11T00:00:00.000Z',
    })
    @IsOptional()
    @IsDateString()
    DueDate?: string;

    @ApiProperty({
        format: 'uuid',
        description: 'Which warehouse receives this stock',
    })
    @IsUUID()
    WarehouseId!: string;

    @ApiPropertyOptional({ maxLength: 2000 })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    Notes?: string;

    @ApiProperty({ type: [PurchaseItemDto] })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => PurchaseItemDto)
    Items!: PurchaseItemDto[];
}