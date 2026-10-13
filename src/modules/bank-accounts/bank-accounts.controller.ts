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
import { BankAccountsService } from './bank-accounts.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { QueryBankAccountDto } from './dto/query-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';

@ApiTags('bank-accounts')
@ApiCookieAuth('cookie-auth')
@Controller('bank-accounts')
export class BankAccountsController {
    constructor(private readonly accounts: BankAccountsService) {}

    @Get()
    @RequirePermissions('bank_accounts.view')
    @ApiOperation({ summary: 'List bank accounts' })
    @ApiOkResponse({ description: 'Paginated account list.' })
    list(@Query() query: QueryBankAccountDto) {
        return this.accounts.list(query);
    }

    @Get(':id')
    @RequirePermissions('bank_accounts.view')
    @ApiOperation({ summary: 'Get one bank account' })
    @ApiNotFoundResponse({ description: 'Account not found.' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.accounts.findOne(id);
    }

    @Post()
    @RequirePermissions('bank_accounts.manage')
    @ApiOperation({ summary: 'Create a bank account' })
    @ApiCreatedResponse({ description: 'Account created.' })
    @ApiConflictResponse({ description: 'Account number in use.' })
    create(
        @Body() dto: CreateBankAccountDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.accounts.create(dto, actorId);
    }

    @Patch(':id')
    @RequirePermissions('bank_accounts.manage')
    @ApiOperation({ summary: 'Update a bank account' })
    @ApiOkResponse({ description: 'Account updated.' })
    @ApiNotFoundResponse({ description: 'Account not found.' })
    @ApiConflictResponse({ description: 'Account number conflict, or unsetting only default.' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateBankAccountDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.accounts.update(id, dto, actorId);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('bank_accounts.manage')
    @ApiOperation({ summary: 'Soft-delete a bank account' })
    @ApiOkResponse({ description: 'Account soft-deleted.' })
    @ApiNotFoundResponse({ description: 'Account not found.' })
    @ApiConflictResponse({ description: 'Default, or referenced by expenses/movements.' })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.accounts.remove(id, actorId);
    }
}