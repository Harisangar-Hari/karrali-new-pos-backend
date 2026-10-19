//src/modules/users/dto/create-user.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsEmail,
    IsOptional,
    IsString,
    IsUUID,
    Matches,
    MaxLength,
    MinLength,
} from 'class-validator';

const PASSWORD_RULE =
    /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]*$/;

export class CreateUserDto {
    @ApiProperty({ example: 'kasun', maxLength: 50 })
    @IsString()
    @MinLength(3)
    @MaxLength(50)
    @Matches(/^[a-zA-Z0-9._-]+$/, {
        message:
            'Username may contain letters, numbers, dot, underscore, and hyphen only',
    })
    Username!: string;

    @ApiProperty({
        example: 'StrongPass123',
        description: 'Min 8 chars, must contain at least one letter and one digit.',
    })
    @IsString()
    @MinLength(8)
    @MaxLength(100)
    @Matches(PASSWORD_RULE, {
        message:
            'Password must contain at least one letter and one digit, min 8 characters',
    })
    Password!: string;

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

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    IsActive?: boolean;

    @ApiProperty({
        type: [String],
        description: 'Role IDs to assign. At least one required.',
        example: ['<role uuid>'],
    })
    @IsArray()
    @ArrayMinSize(1)
    @IsUUID(undefined, { each: true })
    RoleIds!: string[];
}