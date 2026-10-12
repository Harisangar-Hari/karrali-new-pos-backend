import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
    @ApiProperty({
        example: 'admin',
        description: 'Username (letters, digits, _ . -)',
        minLength: 3,
        maxLength: 50,
    })
    @IsString()
    @MinLength(3)
    @MaxLength(50)
    @Matches(/^[a-zA-Z0-9_.-]+$/, {
        message: 'username may only contain letters, digits, _ . -',
    })
    username!: string;

    @ApiProperty({
        example: 'Admin@12345',
        description: 'Password',
        minLength: 6,
        maxLength: 200,
    })
    @IsString()
    @MinLength(6)
    @MaxLength(200)
    password!: string;
}