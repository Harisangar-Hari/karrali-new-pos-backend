//src/modules/loyalty/dto/adjust-points.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsInt,
    IsString,
    MaxLength,
    MinLength,
    NotEquals,
} from 'class-validator';

export class AdjustPointsDto {
    @ApiProperty({
        example: -200,
        description:
            'Signed delta. Positive credits points, negative debits. Cannot be zero.',
    })
    @Type(() => Number)
    @IsInt()
    @NotEquals(0)
    Points!: number;

    @ApiProperty({
        example: 'Goodwill for delayed delivery',
        maxLength: 500,
    })
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    Reason!: string;
}