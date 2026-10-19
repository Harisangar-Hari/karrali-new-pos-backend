//src/modules/cash-sessions/dto/close-session.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsNumber,
    IsOptional,
    IsString,
    MaxLength,
    Min,
} from 'class-validator';

export class CloseSessionDto {
    @ApiProperty({
        minimum: 0,
        example: 22300.0,
        description: 'Physical cash counted at shift end.',
    })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(0)
    CountedCash!: number;

    @ApiPropertyOptional({
        description:
            'Required when the counted amount differs from the expected amount. Explain the over/short.',
        maxLength: 500,
    })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    DiscrepancyReason?: string;

    @ApiPropertyOptional({ maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    Notes?: string;
}