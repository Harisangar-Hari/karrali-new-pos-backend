import {
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiCookieAuth,
    ApiCreatedResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { QueryStockMovementDto } from './dto/query-stock-movement.dto';
import { StockService } from './stock.service';

@ApiTags('stock')
@ApiCookieAuth('cookie-auth')
@Controller('stock')
export class StockController {
    constructor(private readonly stock: StockService) {}

    @Get('product/:productId')
    @RequirePermissions('stock.view')
    @ApiOperation({ summary: 'Current stock for a product, per warehouse' })
    @ApiOkResponse({ description: 'Per-warehouse quantities + total.' })
    @ApiNotFoundResponse({ description: 'Product not found.' })
    getProductStock(
        @Param('productId', ParseUUIDPipe) productId: string,
    ) {
        return this.stock.getProductStock(productId);
    }

    @Get('ledger')
    @RequirePermissions('stock.view')
    @ApiOperation({
        summary: 'Paginated stock movement ledger',
        description: 'Filters: ProductId, WarehouseId, Type.',
    })
    @ApiOkResponse({ description: 'Paginated ledger rows.' })
    getLedger(@Query() query: QueryStockMovementDto) {
        return this.stock.getLedger(query);
    }

    @Post('adjust')
    @RequirePermissions('stock.adjust')
    @ApiOperation({
        summary: 'Manual stock adjustment',
        description: 'Only OPENING and ADJUSTMENT types are accepted.',
    })
    @ApiCreatedResponse({ description: 'Adjustment applied — movement returned.' })
    @ApiBadRequestResponse({
        description:
            'Non-manual type, sign mismatch, or resulting qty would be negative.',
    })
    adjust(
        @Body() dto: AdjustStockDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.stock.manualAdjust(dto, actorId);
    }
}