//src/modules/cash-movements/dto/delete-cash-movement.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class DeleteCashMovementDto {
    @ApiProperty({
        example: 'Entered twice by mistake',
        maxLength: 500,
        description: 'Why the movement is being deleted. Required.',
    })
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    Reason!: string;
}