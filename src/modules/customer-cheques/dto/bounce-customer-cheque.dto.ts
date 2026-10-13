import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class BounceCustomerChequeDto {
    @ApiProperty({
        example: 'Insufficient funds',
        maxLength: 500,
    })
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    Reason!: string;

    @ApiPropertyOptional({ example: '2026-11-13T00:00:00.000Z' })
    @IsOptional()
    @IsDateString()
    BouncedAt?: string;

    @ApiPropertyOptional({ maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    Notes?: string;
}