import { Controller, Get, Query } from '@nestjs/common';
import {
    ApiCookieAuth,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditService } from './audit.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

@ApiTags('audit')
@ApiCookieAuth('cookie-auth')
@Controller('audit-logs')
export class AuditController {
    constructor(private readonly audit: AuditService) { }

    @Get()
    @RequirePermissions('audit.view')
    @ApiOperation({
        summary: 'List audit log entries (read-only, newest first)',
        description:
            'Filters: UserId, Action, Entity, EntityId, From, To, search. Paginated.',
    })
    @ApiOkResponse({ description: 'Paginated audit entries.' })
    list(@Query() query: QueryAuditLogDto) {
        return this.audit.list(query);
    }
}