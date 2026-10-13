import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { DateRangeDto } from './date-range.dto';

const toBool = ({ value }: { value: unknown }): unknown => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
};

export class ArAgingQueryDto extends DateRangeDto {
    @ApiPropertyOptional({
        format: 'uuid',
        description: 'Scope to one customer.',
    })
    @IsOptional()
    @IsUUID()
    CustomerId?: string;

    @ApiPropertyOptional({
        default: false,
        description: 'Include customers with zero or negative balance (store credit).',
    })
    @IsOptional()
    @Transform(toBool)
    @IsBoolean()
    IncludeZeroBalance?: boolean;
}