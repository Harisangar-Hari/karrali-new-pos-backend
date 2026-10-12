import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseUUIDPipe,
    Patch,
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
    ApiQuery,
    ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CustomersService } from './customers.service';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { QueryLedgerDto } from './dto/query-ledger.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@ApiTags('customers')
@ApiCookieAuth('cookie-auth')
@Controller('customers')
export class CustomersController {
    constructor(private readonly customers: CustomersService) { }

    @Get()
    @RequirePermissions('customers.view')
    @ApiOperation({ summary: 'List customers (paginated)' })
    @ApiOkResponse({ description: 'Paginated customer list.' })
    list(@Query() query: QueryCustomerDto) {
        return this.customers.list(query);
    }

    @Get('lookup')
    @RequirePermissions('customers.view')
    @ApiOperation({
        summary: 'POS quick-lookup by Code or Phone',
        description: 'Returns the customer or 404 if not found.',
    })
    @ApiQuery({ name: 'by', enum: ['code', 'phone'] })
    @ApiQuery({ name: 'value', type: String })
    @ApiOkResponse({ description: 'Customer found.' })
    @ApiNotFoundResponse({ description: 'No matching customer.' })
    async lookup(
        @Query('by') by: 'code' | 'phone',
        @Query('value') value: string,
    ) {
        const found = await this.customers.lookup(by, value);
        if (!found) {
            // Nest: throw NotFoundException via service would be cleaner.
            // Returned as { found: false } so the frontend can branch.
            return { found: false };
        }
        return { found: true, customer: found };
    }

    @Get(':id')
    @RequirePermissions('customers.view')
    @ApiOperation({ summary: 'Get one customer' })
    @ApiOkResponse({ description: 'Customer detail.' })
    @ApiNotFoundResponse({ description: 'Customer not found.' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.customers.findOne(id);
    }

    @Get(':id/credit-status')
    @RequirePermissions('customers.view')
    @ApiOperation({ summary: 'Credit limit vs current balance' })
    @ApiOkResponse({ description: 'Credit status.' })
    @ApiNotFoundResponse({ description: 'Customer not found.' })
    getCreditStatus(@Param('id', ParseUUIDPipe) id: string) {
        return this.customers.getCreditStatus(id);
    }

    @Get(':id/ledger')
    @RequirePermissions('customers.view')
    @ApiOperation({ summary: 'Paginated customer ledger (newest first)' })
    @ApiOkResponse({ description: 'Paginated ledger entries.' })
    @ApiNotFoundResponse({ description: 'Customer not found.' })
    getLedger(
        @Param('id', ParseUUIDPipe) id: string,
        @Query() query: QueryLedgerDto,
    ) {
        return this.customers.getLedger(id, query);
    }

    @Post()
    @RequirePermissions('customers.create')
    @ApiOperation({ summary: 'Create a customer (Code is auto-generated)' })
    @ApiCreatedResponse({ description: 'Customer created.' })
    create(
        @Body() dto: CreateCustomerDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.customers.create(dto, actorId);
    }

    @Patch(':id')
    @RequirePermissions('customers.update')
    @ApiOperation({
        summary: 'Update a customer',
        description: 'Balance is not editable here — use adjust-balance.',
    })
    @ApiOkResponse({ description: 'Customer updated.' })
    @ApiNotFoundResponse({ description: 'Customer not found.' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateCustomerDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.customers.update(id, dto, actorId);
    }

    @Post(':id/adjust-balance')
    @RequirePermissions('customers.update')
    @ApiOperation({
        summary: 'Manual balance adjustment (writes an ADJUSTMENT ledger row)',
        description: 'Reason is required and recorded on the ledger and audit log.',
    })
    @ApiOkResponse({ description: 'Balance adjusted — customer returned.' })
    @ApiNotFoundResponse({ description: 'Customer not found.' })
    @ApiBadRequestResponse({ description: 'Amount is zero or Reason missing.' })
    adjustBalance(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: AdjustBalanceDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.customers.adjustBalance(id, dto, actorId);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('customers.delete')
    @ApiOperation({ summary: 'Soft-delete a customer' })
    @ApiOkResponse({ description: 'Customer soft-deleted.' })
    @ApiNotFoundResponse({ description: 'Customer not found.' })
    @ApiConflictResponse({
        description: 'Customer has an outstanding balance.',
    })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.customers.remove(id, actorId);
    }
}