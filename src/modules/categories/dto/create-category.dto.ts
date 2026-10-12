import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsBoolean,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    MinLength,
} from 'class-validator';

export class CreateCategoryDto {
    @ApiProperty({ example: 'Beverages', maxLength: 100 })
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    Name!: string;

    @ApiPropertyOptional({ example: 'Soft drinks, juices, water' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    Description?: string;

    @ApiPropertyOptional({
        format: 'uuid',
        description: 'Parent category. Omit or null for a root category.',
        nullable: true,
    })
    @IsOptional()
    @IsUUID()
    ParentId?: string | null;

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    IsActive?: boolean;
}