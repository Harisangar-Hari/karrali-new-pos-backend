//src/modules/settings/dto/upsert-setting.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDefined, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Value is untyped JSON — settings vary from scalars (`"LKR"`) to
 * structured objects (`{ "LowStockThreshold": 5, "NotifyEmail": "..." }`).
 * Validation of shape is the caller's responsibility per key; this
 * DTO only guarantees a value is present.
 */
export class UpsertSettingDto {
    @ApiProperty({
        description:
            'Arbitrary JSON value. Primitives, arrays, and objects are all valid.',
        example: { Currency: 'LKR', TaxEnabled: true },
    })
    @IsDefined()
    Value!: unknown;

    @ApiPropertyOptional({
        description: 'Human-readable description of what this setting controls',
        maxLength: 500,
    })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    Description?: string;
}