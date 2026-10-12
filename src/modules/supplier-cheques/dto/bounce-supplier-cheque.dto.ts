import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class BounceSupplierChequeDto {
    @ApiProperty({
        description: 'Why the cheque bounced (insufficient funds, signature mismatch, etc.).',
        example: 'Insufficient funds',
        maxLength: 500,
    })
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    Reason!: string;

    @ApiPropertyOptional({
        description: 'Date the bank returned the cheque. Defaults to now.',
    })
    @IsOptional()
    @IsDateString()
    BouncedAt?: string;

    @ApiPropertyOptional({ maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    Notes?: string;
}