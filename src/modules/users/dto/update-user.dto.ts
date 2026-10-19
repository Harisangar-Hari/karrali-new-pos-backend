//src/modules/users/dto/update-user.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsBoolean,
    IsEmail,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator';

/**
 * Username and password are NOT editable here.
 * Username is immutable after creation; password changes go through
 * change-password / reset-password endpoints.
 */
export class UpdateUserDto {
    @ApiPropertyOptional({ example: 'Kasun Perera', maxLength: 200 })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    FullName?: string;

    @ApiPropertyOptional({ example: 'kasun@example.com', maxLength: 200 })
    @IsOptional()
    @IsEmail()
    @MaxLength(200)
    Email?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    IsActive?: boolean;
}