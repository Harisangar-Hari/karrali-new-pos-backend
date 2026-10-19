import {
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    ServiceUnavailableException,
} from '@nestjs/common';
import {
    ApiOkResponse,
    ApiOperation,
    ApiServiceUnavailableResponse,
    ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../database/prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Liveness probe. Returns 200 as long as the process is running.
     * Does NOT touch the database — a slow DB should not mark the app
     * as dead and trigger a container restart.
     */
    @Public()
    @Get()
    @ApiOperation({
        summary: 'Liveness probe',
        description:
            'Returns 200 if the process is running. No DB check. Use for container restart decisions.',
    })
    @ApiOkResponse({ description: 'Service is alive.' })
    liveness() {
        return {
            status: 'ok',
            uptime: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Readiness probe. Pings the database. Returns 503 if the DB is
     * unreachable — the load balancer should stop sending traffic.
     */
    @Public()
    @Get('ready')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Readiness probe',
        description:
            'Pings the database. Returns 200 when ready, 503 when the DB is unreachable.',
    })
    @ApiOkResponse({ description: 'Service is ready.' })
    @ApiServiceUnavailableResponse({ description: 'Database unreachable.' })
    async readiness() {
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            return {
                status: 'ok',
                db: 'connected',
                timestamp: new Date().toISOString(),
            };
        } catch {
            // Never leak the raw DB error — just signal unreadiness.
            throw new ServiceUnavailableException({
                status: 'unavailable',
                db: 'unreachable',
                timestamp: new Date().toISOString(),
            });
        }
    }
}