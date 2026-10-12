import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelPurchaseDto {
    @ApiPropertyOptional({
        description:
            'Reason for cancellation. Stored on the purchase Notes and in the audit log.',
        maxLength: 500,
    })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    Reason?: string;
}