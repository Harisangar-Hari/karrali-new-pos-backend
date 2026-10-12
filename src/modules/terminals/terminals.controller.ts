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
    ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CreateTerminalDto } from './dto/create-terminal.dto';
import { QueryTerminalDto } from './dto/query-terminal.dto';
import { UpdateTerminalDto } from './dto/update-terminal.dto';
import { TerminalsService } from './terminals.service';

@ApiTags('terminals')
@ApiCookieAuth('cookie-auth')
@Controller('terminals')
export class TerminalsController {
    constructor(private readonly terminals: TerminalsService) { }

    @Get()
    @RequirePermissions('terminals.view')
    @ApiOperation({ summary: 'List terminals (paginated)' })
    @ApiOkResponse({ description: 'Paginated terminal list with warehouse.' })
    list(@Query() query: QueryTerminalDto) {
        return this.terminals.list(query);
    }

    @Get(':id')
    @RequirePermissions('terminals.view')
    @ApiOperation({ summary: 'Get one terminal' })
    @ApiOkResponse({ description: 'Terminal detail with warehouse.' })
    @ApiNotFoundResponse({ description: 'Terminal not found.' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.terminals.findOne(id);
    }

    @Post()
    @RequirePermissions('terminals.manage')
    @ApiOperation({ summary: 'Create a terminal' })
    @ApiCreatedResponse({ description: 'Terminal created.' })
    @ApiBadRequestResponse({ description: 'Warehouse invalid or inactive.' })
    @ApiConflictResponse({ description: 'Code already in use.' })
    create(
        @Body() dto: CreateTerminalDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.terminals.create(dto, actorId);
    }

    @Patch(':id')
    @RequirePermissions('terminals.manage')
    @ApiOperation({ summary: 'Update a terminal' })
    @ApiOkResponse({ description: 'Terminal updated.' })
    @ApiNotFoundResponse({ description: 'Terminal not found.' })
    @ApiBadRequestResponse({ description: 'Warehouse invalid or inactive.' })
    @ApiConflictResponse({ description: 'Code conflict.' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateTerminalDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.terminals.update(id, dto, actorId);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('terminals.manage')
    @ApiOperation({ summary: 'Soft-delete a terminal' })
    @ApiOkResponse({ description: 'Terminal soft-deleted.' })
    @ApiNotFoundResponse({ description: 'Terminal not found.' })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.terminals.remove(id, actorId);
    }
}