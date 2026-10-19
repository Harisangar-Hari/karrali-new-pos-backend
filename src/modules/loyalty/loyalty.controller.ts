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
    ApiCookieAuth,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AdjustPointsDto } from './dto/adjust-points.dto';
import { QueryLoyaltyTransactionDto } from './dto/query-loyalty-transaction.dto';
import { LoyaltyService } from './loyalty.service';

@ApiTags('loyalty')
@ApiCookieAuth('cookie-auth')
@Controller('loyalty')
export class LoyaltyController {
    constructor(private readonly loyalty: LoyaltyService) {}

    @Get('config')
    @RequirePermissions('loyalty.view')
    @ApiOperation({
        summary: 'Current loyalty program configuration',
        description:
            'Read from Setting table (Loyalty.*). Editable via PUT /api/settings/Loyalty.X.',
    })
    @ApiOkResponse({ description: 'Loyalty config.' })
    getConfig() {
        return this.loyalty.getConfig();
    }

    @Get('customers/:customerId')
    @RequirePermissions('loyalty.view')
    @ApiOperation({ summary: 'Loyalty status for a customer' })
    @ApiOkResponse({ description: 'Points, tier, redeem value.' })
    @ApiNotFoundResponse({ description: 'Customer not found.' })
    getStatus(@Param('customerId', ParseUUIDPipe) customerId: string) {
        return this.loyalty.getStatus(customerId);
    }

    @Get('transactions')
    @RequirePermissions('loyalty.view')
    @ApiOperation({
        summary: 'List loyalty transactions (newest first)',
        description: 'Filters: CustomerId, Type, From, To.',
    })
    @ApiOkResponse({ description: 'Paginated transaction list.' })
    getLedger(@Query() query: QueryLoyaltyTransactionDto) {
        return this.loyalty.getLedger(query);
    }

    @Post('customers/:customerId/adjust')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('loyalty.adjust')
    @ApiOperation({
        summary: 'Manually adjust a customer\'s points',
        description:
            'Signed delta. Reason required. Writes an ADJUST loyalty transaction + audit row.',
    })
    @ApiOkResponse({ description: 'Updated loyalty status.' })
    @ApiNotFoundResponse({ description: 'Customer not found.' })
    @ApiBadRequestResponse({ description: 'Would drop below zero, or delta is zero.' })
    adjust(
        @Param('customerId', ParseUUIDPipe) customerId: string,
        @Body() dto: AdjustPointsDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.loyalty.adjust(customerId, dto, actorId);
    }
}