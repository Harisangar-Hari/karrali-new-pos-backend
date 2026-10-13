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
    ApiConflictResponse,
    ApiCookieAuth,
    ApiCreatedResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CreateSaleReturnDto } from './dto/create-sale-return.dto';
import { QuerySaleReturnDto } from './dto/query-sale-return.dto';
import { SaleReturnsService } from './sale-returns.service';

@ApiTags('sale-returns')
@ApiCookieAuth('cookie-auth')
@Controller('sale-returns')
export class SaleReturnsController {
    constructor(private readonly saleReturns: SaleReturnsService) {}

    @Get()
    @RequirePermissions('sale_returns.view')
    @ApiOperation({ summary: 'List sale returns (paginated)' })
    @ApiOkResponse({ description: 'Paginated return list.' })
    list(@Query() query: QuerySaleReturnDto) {
        return this.saleReturns.list(query);
    }

    @Get(':id')
    @RequirePermissions('sale_returns.view')
    @ApiOperation({ summary: 'Get one sale return with items' })
    @ApiOkResponse({ description: 'Return detail.' })
    @ApiNotFoundResponse({ description: 'Return not found.' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.saleReturns.findOne(id);
    }

    @Post()
    @RequirePermissions('sale_returns.create')
    @ApiOperation({
        summary: 'Create a sale return (full or partial)',
        description:
            'Refund is proportional to the original SaleItem snapshot. CASH writes a negative CashLedger entry; CREDIT reduces the customer balance. Sale status auto-transitions COMPLETED → PARTIALLY_RETURNED → FULLY_RETURNED.',
    })
    @ApiCreatedResponse({ description: 'Return recorded.' })
    @ApiBadRequestResponse({
        description:
            'Qty exceeds remaining, refund exceeds remaining refundable, or CREDIT without customer.',
    })
    @ApiNotFoundResponse({ description: 'Sale not found.' })
    @ApiConflictResponse({
        description: 'Sale is CANCELLED or already FULLY_RETURNED.',
    })
    create(
        @Body() dto: CreateSaleReturnDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.saleReturns.create(dto, actorId);
    }
}