//src/modules/users/dto/change-password.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

const PASSWORD_RULE =
    /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]*$/;

export class ChangePasswordDto {
    @ApiProperty({ description: 'Current password (self-service only).' })
    @IsString()
    @MinLength(1)
    OldPassword!: string;

    @ApiProperty({
        example: 'NewStrongPass456',
        description: 'Min 8 chars, letter + digit.',
    })
    @IsString()
    @MinLength(8)
    @MaxLength(100)
    @Matches(PASSWORD_RULE, {
        message:
            'New password must contain at least one letter and one digit, min 8 characters',
    })
    NewPassword!: string;
}