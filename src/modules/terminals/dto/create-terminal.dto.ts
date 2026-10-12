import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsBoolean,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    MinLength,
} from 'class-validator';

export class CreateTerminalDto {
    @ApiProperty({ example: 'Main Terminal', maxLength: 100 })
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    Name!: string;

    @ApiProperty({ example: 'MAIN-01', maxLength: 20 })
    @IsString()
    @MinLength(1)
    @MaxLength(20)
    Code!: string;

    @ApiProperty({
        description: 'Warehouse this terminal is bound to (must be active, not deleted)',
        format: 'uuid',
    })
    @IsUUID()
    WarehouseId!: string;

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    IsActive?: boolean;
}