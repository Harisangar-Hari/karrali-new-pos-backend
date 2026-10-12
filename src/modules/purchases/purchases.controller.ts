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
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CancelPurchaseDto } from './dto/cancel-purchase.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { QueryPurchaseDto } from './dto/query-purchase.dto';
import { PurchasesService } from './purchases.service';

@ApiTags('purchases')
@ApiCookieAuth('cookie-auth')
@Controller('purchases')
export class PurchasesController {
    constructor(private readonly purchases: PurchasesService) { }

    @Get()
    @RequirePermissions('purchases.view')
    @ApiOperation({ summary: 'List purchases (paginated)' })
    @ApiOkResponse({ description: 'Paginated purchase list.' })
    list(@Query() query: QueryPurchaseDto) {
        return this.purchases.list(query);
    }

    @Get(':id')
    @RequirePermissions('purchases.view')
    @ApiOperation({ summary: 'Get one purchase with items, payments, cheques' })
    @ApiOkResponse({ description: 'Purchase detail.' })
    @ApiNotFoundResponse({ description: 'Purchase not found.' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.purchases.findOne(id);
    }

    @Post()
    @RequirePermissions('purchases.create')
    @ApiOperation({
        summary: 'Create a purchase',
        description:
            'Posts the invoice, creates line items, and writes PURCHASE stock movements — all in one transaction. Code (PUR-xxxxx) is auto-generated.',
    })
    @ApiCreatedResponse({ description: 'Purchase created and posted.' })
    @ApiBadRequestResponse({
        description: 'Supplier / warehouse / product invalid or inactive.',
    })
    create(
        @Body() dto: CreatePurchaseDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.purchases.create(dto, actorId);
    }

    @Post(':id/cancel')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('purchases.cancel')
    @ApiOperation({
        summary: 'Cancel a purchase',
        description:
            'Reverses stock via PURCHASE_RETURN movements. Blocked if any payment or active cheque exists.',
    })
    @ApiOkResponse({ description: 'Purchase cancelled.' })
    @ApiNotFoundResponse({ description: 'Purchase not found.' })
    @ApiConflictResponse({
        description: 'Already cancelled, has payments, has active cheques, or stock already consumed.',
    })
    cancel(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: CancelPurchaseDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.purchases.cancel(id, dto, actorId);
    }
}