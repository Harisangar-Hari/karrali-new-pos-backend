import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Put,
    Query,
} from '@nestjs/common';
import {
    ApiCookieAuth,
    ApiCreatedResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { QuerySettingDto } from './dto/query-setting.dto';
import { UpsertSettingDto } from './dto/upsert-setting.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiCookieAuth('cookie-auth')
@Controller('settings')
export class SettingsController {
    constructor(private readonly settings: SettingsService) {}

    @Get()
    @RequirePermissions('settings.view')
    @ApiOperation({
        summary: 'List all settings',
        description: 'Optional `search` filters Key and Description.',
    })
    @ApiOkResponse({ description: 'Array of settings, ordered by Key.' })
    list(@Query() query: QuerySettingDto) {
        return this.settings.list(query);
    }

    @Get(':key')
    @RequirePermissions('settings.view')
    @ApiOperation({ summary: 'Get one setting by key' })
    @ApiParam({ name: 'key', example: 'Company.Name' })
    @ApiOkResponse({ description: 'Setting value.' })
    @ApiNotFoundResponse({ description: 'Setting not found.' })
    findOne(@Param('key') key: string) {
        return this.settings.findOne(key);
    }

    @Put(':key')
    @RequirePermissions('settings.manage')
    @ApiOperation({
        summary: 'Create or replace a setting',
        description:
            'Idempotent upsert. Value is arbitrary JSON. Writes an audit row (SETTING_CREATED or SETTING_UPDATED).',
    })
    @ApiParam({ name: 'key', example: 'Company.Name' })
    @ApiCreatedResponse({ description: 'Setting upserted.' })
    upsert(
        @Param('key') key: string,
        @Body() dto: UpsertSettingDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.settings.upsert(key, dto, actorId);
    }

    @Delete(':key')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('settings.manage')
    @ApiOperation({
        summary: 'Hard-delete a setting',
        description: 'Audit row preserves the removed value.',
    })
    @ApiParam({ name: 'key', example: 'Company.Name' })
    @ApiOkResponse({ description: 'Setting deleted.' })
    @ApiNotFoundResponse({ description: 'Setting not found.' })
    remove(
        @Param('key') key: string,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.settings.remove(key, actorId);
    }
}