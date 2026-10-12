import { ApiPropertyOptional } from '@nestjs/swagger';
import { StockMovementType } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryStockMovementDto extends PaginationDto {
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
}