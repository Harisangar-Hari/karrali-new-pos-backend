import {
    Body,
    Controller,
    Delete,
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
    ApiCreatedResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CashMovementsService } from './cash-movements.service';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';
import { DeleteCashMovementDto } from './dto/delete-cash-movement.dto';
import { QueryCashMovementDto } from './dto/query-cash-movement.dto';

@ApiTags('cash-movements')
@ApiCookieAuth('cookie-auth')
@Controller('cash-movements')
export class CashMovementsController {
    constructor(private readonly movements: CashMovementsService) {}

    @Get()
    @RequirePermissions('cash_movements.view')
    @ApiOperation({
        summary: 'List manual cash in/out movements (paginated)',
        description: 'Filters: Type, BankAccountId, CashSessionId, From, To.',
    })
    @ApiOkResponse({ description: 'Paginated movement list.' })
    list(@Query() query: QueryCashMovementDto) {
        return this.movements.list(query);
    }

    @Get(':id')
    @RequirePermissions('cash_movements.view')
    @ApiOperation({ summary: 'Get one cash movement' })
    @ApiOkResponse({ description: 'Movement detail.' })
    @ApiNotFoundResponse({ description: 'Movement not found.' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.movements.findOne(id);
    }

    @Post()
    @RequirePermissions('cash_movements.create')
    @ApiOperation({
        summary: 'Record a manual cash in / cash out',
        description:
            'Writes a CashLedger entry with the correct sign. ' +
            'CASH_IN + BankAccountId = withdrawal from bank. ' +
            'CASH_OUT + BankAccountId = deposit to bank. ' +
            'Auto-links to the actor\'s open cash session if one exists.',
    })
    @ApiCreatedResponse({ description: 'Movement recorded.' })
    @ApiBadRequestResponse({ description: 'Bank account invalid/inactive.' })
    create(
        @Body() dto: CreateCashMovementDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.movements.create(dto, actorId);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('cash_movements.delete')
    @ApiOperation({
        summary: 'Delete a cash movement (reverses its ledger effect)',
        description:
            'Writes a new CashLedger entry with the opposite type and sign, then hard-deletes the movement. Audit row preserves the original.',
    })
    @ApiOkResponse({ description: 'Movement deleted and ledger reversed.' })
    @ApiNotFoundResponse({ description: 'Movement not found.' })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: DeleteCashMovementDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.movements.remove(id, dto, actorId);
    }
}