import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, MaxLength, NotEquals } from 'class-validator';

export class AdjustBalanceDto {
    @ApiProperty({
        description:
            'Signed amount. Positive increases what the customer owes; negative reduces it.',
        example: -1500.0,
    })
    @IsNumber({ maxDecimalPlaces: 4 })
    @NotEquals(0, { message: 'Amount must be non-zero' })
    Amount!: number;

    @ApiProperty({
        description:
            'Reason for the adjustment. Stored on the ledger row and in the audit log. Required — no silent balance changes.',
        maxLength: 500,
    })
    @IsString()
    @MaxLength(500)
    Reason!: string;
}