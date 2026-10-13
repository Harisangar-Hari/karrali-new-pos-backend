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
    ApiCookieAuth,
    ApiCreatedResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { QueryExpenseDto } from './dto/query-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesService } from './expenses.service';

@ApiTags('expenses')
@ApiCookieAuth('cookie-auth')
@Controller('expenses')
export class ExpensesController {
    constructor(private readonly expenses: ExpensesService) {}

    @Get()
    @RequirePermissions('expenses.view')
    @ApiOperation({
        summary: 'List expenses (paginated)',
        description: 'Filters: CategoryId, BankAccountId, Method, From, To, search.',
    })
    @ApiOkResponse({ description: 'Paginated expense list.' })
    list(@Query() query: QueryExpenseDto) {
        return this.expenses.list(query);
    }

    @Get(':id')
    @RequirePermissions('expenses.view')
    @ApiOperation({ summary: 'Get one expense' })
    @ApiOkResponse({ description: 'Expense detail.' })
    @ApiNotFoundResponse({ description: 'Expense not found.' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.expenses.findOne(id);
    }

    @Post()
    @RequirePermissions('expenses.create')
    @ApiOperation({
        summary: 'Record an expense',
        description:
            'CASH writes a negative CashLedger entry. BANK requires a BankAccountId and writes no cash ledger row.',
    })
    @ApiCreatedResponse({ description: 'Expense recorded.' })
    @ApiBadRequestResponse({
        description:
            'Category invalid/inactive, BANK without account, or CASH with account.',
    })
    create(
        @Body() dto: CreateExpenseDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.expenses.create(dto, actorId);
    }

    @Patch(':id')
    @RequirePermissions('expenses.update')
    @ApiOperation({
        summary: 'Update non-financial fields',
        description:
            'Only Description, Payee, and Notes are editable. Financial fields are frozen — delete and re-enter to correct.',
    })
    @ApiOkResponse({ description: 'Expense updated.' })
    @ApiNotFoundResponse({ description: 'Expense not found.' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateExpenseDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.expenses.update(id, dto, actorId);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('expenses.delete')
    @ApiOperation({
        summary: 'Soft-delete an expense',
        description:
            'If Method=CASH, writes a positive EXPENSE_REVERSED CashLedger entry (drawer gets money back). BANK expenses have no cash effect to reverse.',
    })
    @ApiOkResponse({ description: 'Expense deleted, cash effect reversed if applicable.' })
    @ApiNotFoundResponse({ description: 'Expense not found.' })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.expenses.remove(id, actorId);
    }
}