import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

/**
 * Opening stock only applies on create. Once a product exists, stock
 * changes go through the (future) stock adjustment endpoints.
 */
export class UpdateProductDto extends PartialType(
    OmitType(CreateProductDto, ['InitialQty', 'InitialWarehouseId'] as const),
) { }