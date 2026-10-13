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
import { BounceCustomerChequeDto } from './dto/bounce-customer-cheque.dto';
import { BulkCreateCustomerChequeDto } from './dto/bulk-create-customer-cheque.dto';
import { ClearCustomerChequeDto } from './dto/clear-customer-cheque.dto';
import { CreateCustomerChequeDto } from './dto/create-customer-cheque.dto';
import { QueryCustomerChequeDto } from './dto/query-customer-cheque.dto';
import { VoidCustomerChequeDto } from './dto/void-customer-cheque.dto';
import { CustomerChequesService } from './customer-cheques.service';

@ApiTags('customer-cheques')
@ApiCookieAuth('cookie-auth')
@Controller('customer-cheques')
export class CustomerChequesController {
    constructor(private readonly cheques: CustomerChequesService) {}

    @Get()
    @RequirePermissions('customer_cheques.view')
    @ApiOperation({
        summary: 'List customer cheques (earliest-due first)',
        description:
            'Filters: CustomerId, SaleId, Status, dueAfter, dueBefore. Use dueBefore for the cheque-due calendar.',
    })
    @ApiOkResponse({ description: 'Paginated cheque list.' })
    list(@Query() query: QueryCustomerChequeDto) {
        return this.cheques.list(query);
    }

    @Get(':id')
    @RequirePermissions('customer_cheques.view')
    @ApiOperation({ summary: 'Get one customer cheque' })
    @ApiOkResponse({ description: 'Cheque detail.' })
    @ApiNotFoundResponse({ description: 'Cheque not found.' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.cheques.findOne(id);
    }

    @Post()
    @RequirePermissions('customer_cheques.create')
    @ApiOperation({
        summary: 'Record a single customer cheque',
        description:
            'Reduces the customer balance immediately (customer has "paid" with paper). If SaleId is given, it is linked to that invoice.',
    })
    @ApiCreatedResponse({ description: 'Cheque recorded.' })
    @ApiBadRequestResponse({ description: 'Customer or sale invalid.' })
    create(
        @Body() dto: CreateCustomerChequeDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.cheques.create(dto, actorId);
    }

    @Post('bulk')
    @RequirePermissions('customer_cheques.create')
    @ApiOperation({
        summary: 'Record a batch of customer cheques (atomic)',
        description:
            'All-or-nothing. If any entry is invalid, none are written. One audit entry with count.',
    })
    @ApiCreatedResponse({ description: 'Cheques recorded.' })
    @ApiBadRequestResponse({ description: 'Any entry invalid.' })
    bulkCreate(
        @Body() dto: BulkCreateCustomerChequeDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.cheques.bulkCreate(dto, actorId);
    }

    @Post(':id/clear')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('customer_cheques.clear')
    @ApiOperation({
        summary: 'Mark cheque as cleared',
        description: 'Status → CLEARED. No ledger effect (balance was applied at issue).',
    })
    @ApiOkResponse({ description: 'Cheque cleared.' })
    @ApiNotFoundResponse({ description: 'Cheque not found.' })
    @ApiConflictResponse({ description: 'Cheque is not PENDING.' })
    clear(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ClearCustomerChequeDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.cheques.clear(id, dto, actorId);
    }

    @Post(':id/bounce')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('customer_cheques.bounce')
    @ApiOperation({
        summary: 'Mark cheque as bounced',
        description:
            'Status → BOUNCED. Customer balance goes back up. If tied to a SalePayment or CreditPayment, that record is reversed.',
    })
    @ApiOkResponse({ description: 'Cheque bounced.' })
    @ApiNotFoundResponse({ description: 'Cheque not found.' })
    @ApiConflictResponse({ description: 'Cheque is not PENDING.' })
    bounce(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: BounceCustomerChequeDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.cheques.bounce(id, dto, actorId);
    }

    @Post(':id/void')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('customer_cheques.void')
    @ApiOperation({
        summary: 'Void a pending cheque',
        description:
            'Status → VOIDED. Same reversal as bounce but a distinct ledger type (CHEQUE_VOIDED) for audit clarity.',
    })
    @ApiOkResponse({ description: 'Cheque voided.' })
    @ApiNotFoundResponse({ description: 'Cheque not found.' })
    @ApiConflictResponse({ description: 'Cheque is not PENDING.' })
    void(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: VoidCustomerChequeDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.cheques.void(id, dto, actorId);
    }
}