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
import { CashSessionsService } from './cash-sessions.service';
import { CloseSessionDto } from './dto/close-session.dto';
import { OpenSessionDto } from './dto/open-session.dto';
import { QueryCashLedgerDto } from './dto/query-cash-ledger.dto';
import { QueryCashSessionDto } from './dto/query-cash-session.dto';

@ApiTags('cash-sessions')
@ApiCookieAuth('cookie-auth')
@Controller('cash-sessions')
export class CashSessionsController {
    constructor(private readonly sessions: CashSessionsService) {}

    @Get()
    @RequirePermissions('cash_sessions.view')
    @ApiOperation({ summary: 'List cash sessions (paginated)' })
    @ApiOkResponse({ description: 'Paginated session list.' })
    list(@Query() query: QueryCashSessionDto) {
        return this.sessions.list(query);
    }

    @Get('me')
    @RequirePermissions('cash_sessions.view')
    @ApiOperation({
        summary: "Get the logged-in cashier's open session",
        description:
            'Returns null if none. POS clients call this on load to decide whether to prompt "Open drawer".',
    })
    @ApiOkResponse({ description: 'Open session or null.' })
    getMine(@CurrentUser('userId') userId: string) {
        return this.sessions.getMyOpenSession(userId);
    }

    @Get('ledger')
    @RequirePermissions('cash_ledger.view')
    @ApiOperation({
        summary: 'List cash ledger entries (newest first)',
        description: 'Filter by CashSessionId, Type, From, To.',
    })
    @ApiOkResponse({ description: 'Paginated ledger entries.' })
    getLedger(@Query() query: QueryCashLedgerDto) {
        return this.sessions.getLedger(query);
    }

    @Get(':id')
    @RequirePermissions('cash_sessions.view')
    @ApiOperation({ summary: 'Get one cash session' })
    @ApiOkResponse({ description: 'Session detail.' })
    @ApiNotFoundResponse({ description: 'Session not found.' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.sessions.findOne(id);
    }

    @Get(':id/expected-cash')
    @RequirePermissions('cash_sessions.view')
    @ApiOperation({
        summary: 'Live expected cash for a session',
        description:
            'StartingCash + sum of ledger entries (attached + in-window orphans). Use for live "X in drawer" display.',
    })
    @ApiOkResponse({ description: 'Expected cash snapshot.' })
    @ApiNotFoundResponse({ description: 'Session not found.' })
    getExpectedCash(@Param('id', ParseUUIDPipe) id: string) {
        return this.sessions.getExpectedCash(id);
    }

    @Post('open')
    @RequirePermissions('cash_sessions.open')
    @ApiOperation({
        summary: 'Open a cash session',
        description:
            'Starts a shift. Blocked if the logged-in cashier already has an open session.',
    })
    @ApiCreatedResponse({ description: 'Session opened.' })
    @ApiBadRequestResponse({ description: 'Terminal invalid or inactive.' })
    @ApiConflictResponse({ description: 'Cashier already has an open session.' })
    open(
        @Body() dto: OpenSessionDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.sessions.open(dto, actorId);
    }

    @Post(':id/close')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('cash_sessions.close')
    @ApiOperation({
        summary: 'Close a cash session',
        description:
            'Attaches orphan ledger entries, computes ExpectedCash, compares to CountedCash. DiscrepancyReason required if they differ.',
    })
    @ApiOkResponse({ description: 'Session closed.' })
    @ApiNotFoundResponse({ description: 'Session not found.' })
    @ApiConflictResponse({ description: 'Session already closed.' })
    @ApiForbiddenResponse({
        description: 'Not your session and missing cash_sessions.close.',
    })
    @ApiBadRequestResponse({ description: 'Discrepancy without reason.' })
    close(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: CloseSessionDto,
        @CurrentUser() user: JwtUser,
    ) {
        const canCloseOthers = user.permissions.includes('cash_sessions.close');
        return this.sessions.close(id, dto, user.userId, canCloseOthers);
    }
}