//src/modules/cash-sessions/dto/open-session.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    Min,
} from 'class-validator';

export class OpenSessionDto {
    @ApiProperty({
        format: 'uuid',
        description: 'Terminal this drawer belongs to.',
    })
    @IsUUID()
    TerminalId!: string;

    @ApiProperty({
        minimum: 0,
        example: 5000.0,
        description: 'Physical cash counted at shift start.',
    })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(0)
    StartingCash!: number;

    @ApiPropertyOptional({ maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    Notes?: string;
}