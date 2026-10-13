import { ApiPropertyOptional } from '@nestjs/swagger';
import { StockMovementType } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { DateRangeDto } from './date-range.dto';

export class InventoryMovementQueryDto extends PaginationDto {
    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    ProductId?: string;

    @ApiPropertyOptional({ format: 'uuid' })
    @IsOptional()
    @IsUUID()
    WarehouseId?: string;

    @ApiPropertyOptional({ enum: StockMovementType })
    @IsOptional()
    @IsEnum(StockMovementType)
    Type?: StockMovementType;

    @ApiPropertyOptional({ description: 'CreatedAt >= (ISO 8601)' })
    @IsOptional()
    From?: string;

    @ApiPropertyOptional({ description: 'CreatedAt <= (ISO 8601)' })
    @IsOptional()
    To?: string;
}