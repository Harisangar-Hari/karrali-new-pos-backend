import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
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
    ApiForbiddenResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { JwtUser } from '../auth/strategies/jwt.strategy';
import { CancelSaleDto } from './dto/cancel-sale.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { QuerySaleDto } from './dto/query-sale.dto';
import { SalesService } from './sales.service';

@ApiTags('sales')
@ApiCookieAuth('cookie-auth')
@Controller('sales')
export class SalesController {
    constructor(private readonly sales: SalesService) {}

    @Get()
    @RequirePermissions('sales.view')
    @ApiOperation({ summary: 'List sales (paginated)' })
    @ApiOkResponse({ description: 'Paginated sale list.' })
    list(@Query() query: QuerySaleDto) {
        return this.sales.list(query);
    }

    @Get(':id')
    @RequirePermissions('sales.view')
    @ApiOperation({ summary: 'Get one sale with items, payments, cheques' })
    @ApiOkResponse({ description: 'Sale detail.' })
    @ApiNotFoundResponse({ description: 'Sale not found.' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.sales.findOne(id);
    }

    @Post()
    @RequirePermissions('sales.create')
    @ApiOperation({
        summary: 'Checkout — record a sale',
        description:
            'Supports split payments (cash / card / credit / cheque). Payment total must equal sale total. Credit requires CustomerId; cheque creates a CustomerCheque inline. Line discounts require sales.discount permission.',
    })
    @ApiCreatedResponse({ description: 'Sale completed.' })
    @ApiBadRequestResponse({
        description:
            'Payment total mismatch, missing customer for credit, credit limit exceeded, or bad product/terminal.',
    })
    @ApiForbiddenResponse({ description: 'Discount permission missing.' })
    create(
        @Body() dto: CreateSaleDto,
        @CurrentUser() user: JwtUser,
    ) {
        return this.sales.create(dto, user.userId, {
            hasDiscountPermission: user.permissions.includes('sales.discount'),
        });
    }

    @Post(':id/cancel')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('sales.void')
    @ApiOperation({
        summary: 'Cancel a completed sale',
        description:
            'Reverses stock, cash, and credit. Card portion is not reversed (bank handles). Blocked if any cheque (pending or cleared) is attached — use returns for cleared cheques.',
    })
    @ApiOkResponse({ description: 'Sale cancelled.' })
    @ApiNotFoundResponse({ description: 'Sale not found.' })
    @ApiConflictResponse({
        description: 'Not COMPLETED, or has attached cheques.',
    })
    cancel(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: CancelSaleDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.sales.cancel(id, dto, actorId);
    }
}