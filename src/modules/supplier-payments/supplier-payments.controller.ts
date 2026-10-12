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
import { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto';
import { QuerySupplierPaymentDto } from './dto/query-supplier-payment.dto';
import { ReverseSupplierPaymentDto } from './dto/reverse-supplier-payment.dto';
import { SupplierPaymentsService } from './supplier-payments.service';

@ApiTags('supplier-payments')
@ApiCookieAuth('cookie-auth')
@Controller('supplier-payments')
export class SupplierPaymentsController {
    constructor(private readonly payments: SupplierPaymentsService) {}

    @Get()
    @RequirePermissions('supplier_payments.view')
    @ApiOperation({ summary: 'List supplier payments (paginated)' })
    @ApiOkResponse({ description: 'Paginated payment list.' })
    list(@Query() query: QuerySupplierPaymentDto) {
        return this.payments.list(query);
    }

    @Get(':id')
    @RequirePermissions('supplier_payments.view')
    @ApiOperation({ summary: 'Get one supplier payment' })
    @ApiOkResponse({ description: 'Payment detail.' })
    @ApiNotFoundResponse({ description: 'Payment not found.' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.payments.findOne(id);
    }

    @Post()
    @RequirePermissions('supplier_payments.create')
    @ApiOperation({
        summary: 'Record a cash or bank-transfer payment',
        description:
            'Applies against a single purchase. Bumps Purchase.PaidAmount atomically.',
    })
    @ApiCreatedResponse({ description: 'Payment recorded.' })
    @ApiBadRequestResponse({
        description: 'CHEQUE method, amount exceeds remaining, or supplier inactive.',
    })
    @ApiNotFoundResponse({ description: 'Purchase not found.' })
    @ApiConflictResponse({ description: 'Purchase is CANCELLED.' })
    create(
        @Body() dto: CreateSupplierPaymentDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.payments.create(dto, actorId);
    }

    @Post(':id/reverse')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('supplier_payments.reverse')
    @ApiOperation({
        summary: 'Reverse a supplier payment',
        description:
            'Deletes the payment and rolls back Purchase.PaidAmount. Cheque-method payments cannot be reversed here.',
    })
    @ApiOkResponse({ description: 'Payment reversed.' })
    @ApiNotFoundResponse({ description: 'Payment not found.' })
    @ApiConflictResponse({ description: 'Cannot reverse a cheque-method payment.' })
    reverse(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ReverseSupplierPaymentDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.payments.reverse(id, dto, actorId);
    }
}