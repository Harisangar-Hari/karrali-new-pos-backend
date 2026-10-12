import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsBoolean,
    IsOptional,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';

export class CreateBrandDto {
    @ApiProperty({ example: 'Coca-Cola', maxLength: 100 })
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    Name!: string;

    @ApiPropertyOptional({ example: 'Global soft-drink brand' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    Description?: string;

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    IsActive?: boolean;
}