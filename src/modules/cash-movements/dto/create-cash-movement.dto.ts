//src/modules/cash-movements/dto/create-cash-movement.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CashMovementType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    Min,
    MinLength,
} from 'class-validator';

export class CreateCashMovementDto {
    @ApiProperty({
        enum: CashMovementType,
        description:
            'CASH_IN — money into the drawer. CASH_OUT — money out of the drawer.',
    })
    @IsEnum(CashMovementType)
    Type!: CashMovementType;

    @ApiProperty({ minimum: 0.0001, example: 5000.0 })
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(0.0001)
    Amount!: number;

    @ApiProperty({
        example: 'Owner draw',
        maxLength: 500,
        description: 'Why the money moved. Required.',
    })
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    Reason!: string;

    @ApiPropertyOptional({
        format: 'uuid',
        description:
            'Set when this movement transfers between drawer and bank. ' +
            'CASH_IN + BankAccountId = withdrawal from bank into drawer. ' +
            'CASH_OUT + BankAccountId = deposit from drawer into bank.',
    })
    @IsOptional()
    @IsUUID()
    BankAccountId?: string;

    @ApiPropertyOptional({ maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    Notes?: string;
}