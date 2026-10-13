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
import { CreditPaymentsService } from './credit-payments.service';
import { CreateCreditPaymentDto } from './dto/create-credit-payment.dto';
import { QueryCreditPaymentDto } from './dto/query-credit-payment.dto';
import { ReverseCreditPaymentDto } from './dto/reverse-credit-payment.dto';

@ApiTags('credit-payments')
@ApiCookieAuth('cookie-auth')
@Controller('credit-payments')
export class CreditPaymentsController {
    constructor(private readonly payments: CreditPaymentsService) { }

    @Get()
    @RequirePermissions('credit_payments.view')
    @ApiOperation({ summary: 'List credit payments (paginated)' })
    @ApiOkResponse({ description: 'Paginated credit payment list.' })
    list(@Query() query: QueryCreditPaymentDto) {
        return this.payments.list(query);
    }

    @Get(':id')
    @RequirePermissions('credit_payments.view')
    @ApiOperation({ summary: 'Get one credit payment' })
    @ApiOkResponse({ description: 'Credit payment detail.' })
    @ApiNotFoundResponse({ description: 'Payment not found.' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.payments.findOne(id);
    }

    @Post()
    @RequirePermissions('credit_payments.create')
    @ApiOperation({
        summary: 'Record a credit payment',
        description:
            'CASH — writes to CashLedger and drops the customer balance. CHEQUE — creates a PENDING CustomerCheque (balance drops now; bounces revert it).',
    })
    @ApiCreatedResponse({ description: 'Credit payment recorded.' })
    @ApiBadRequestResponse({ description: 'Customer invalid or missing.' })
    create(
        @Body() dto: CreateCreditPaymentDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.payments.create(dto, actorId);
    }

    @Post(':id/reverse')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('credit_payments.reverse')
    @ApiOperation({
        summary: 'Reverse a cash credit payment',
        description:
            'Balance goes back up, drawer goes back down. Cheque-method payments cannot be reversed here — bounce or void the cheque instead.',
    })
    @ApiOkResponse({ description: 'Payment reversed.' })
    @ApiNotFoundResponse({ description: 'Payment not found.' })
    @ApiConflictResponse({
        description: 'Already reversed, or not a CASH payment.',
    })
    reverse(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ReverseCreditPaymentDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.payments.reverse(id, dto, actorId);
    }
}