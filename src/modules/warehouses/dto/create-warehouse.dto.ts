//src/modules/warehouses/dto/create-warehouse.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsBoolean,
    IsOptional,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';

export class CreateWarehouseDto {
    @ApiProperty({ example: 'Main Warehouse', maxLength: 100 })
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    Name!: string;

    @ApiProperty({ example: 'MAIN', maxLength: 20 })
    @IsString()
    @MinLength(1)
    @MaxLength(20)
    Code!: string;

    @ApiPropertyOptional({ example: '12 Industrial Rd, Colombo' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    Address?: string;

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    IsActive?: boolean;

    @ApiPropertyOptional({
        default: false,
        description:
            'Only one warehouse may be default. Setting true demotes the current default in the same transaction.',
    })
    @IsOptional()
    @IsBoolean()
    IsDefault?: boolean;
}