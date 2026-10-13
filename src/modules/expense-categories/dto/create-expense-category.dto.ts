import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsBoolean,
    IsOptional,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';

export class CreateExpenseCategoryDto {
    @ApiProperty({ example: 'Utilities', maxLength: 100 })
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    Name!: string;

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    IsActive?: boolean;
}