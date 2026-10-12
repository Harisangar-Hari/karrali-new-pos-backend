import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * No pagination — settings are a small, fixed set and callers
 * typically want the whole bag at once (e.g. bootstrap a POS terminal).
 * `search` is provided for admin UIs that need to filter a long list.
 */
export class QuerySettingDto {
    @ApiPropertyOptional({
        description: 'Case-insensitive contains on Key and Description',
    })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    search?: string;
}