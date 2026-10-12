import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
    Req,
    Res,
    UnauthorizedException,
} from '@nestjs/common';
import {
    ApiCookieAuth,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
    CookieService,
    REFRESH_COOKIE,
} from '../../common/cookie.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(
        private readonly auth: AuthService,
        private readonly cookies: CookieService,
    ) { }

    @Public()
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Login',
        description:
            'Authenticates a user and sets HttpOnly cookies: karrali_access (short-lived) and karrali_refresh (long-lived).',
    })
    @ApiOkResponse({ description: 'Login successful — cookies set.' })
    @ApiUnauthorizedResponse({ description: 'Invalid credentials.' })
    async login(
        @Body() dto: LoginDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const result = await this.auth.login(dto, {
            userAgent: req.headers['user-agent'],
            ip: req.ip,
        });

        this.cookies.setAccess(res, result.accessToken, result.accessTtlSec);
        this.cookies.setRefresh(res, result.refreshToken, result.refreshTtlSec);

        return {
            user: result.user,
            accessTtlSec: result.accessTtlSec,
        };
    }

    @Public()
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Rotate session',
        description:
            'Uses the karrali_refresh cookie to issue a new access + refresh pair. Old refresh token is invalidated.',
    })
    @ApiOkResponse({ description: 'Session rotated — new cookies set.' })
    @ApiUnauthorizedResponse({ description: 'Missing or invalid refresh token.' })
    async refresh(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const token = req.cookies?.[REFRESH_COOKIE];
        if (!token) throw new UnauthorizedException('No refresh token');

        const result = await this.auth.refresh(token, {
            userAgent: req.headers['user-agent'],
            ip: req.ip,
        });

        this.cookies.setAccess(res, result.accessToken, result.accessTtlSec);
        this.cookies.setRefresh(res, result.refreshToken, result.refreshTtlSec);

        return { ok: true, accessTtlSec: result.accessTtlSec };
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    @ApiCookieAuth('cookie-auth')
    @ApiOperation({
        summary: 'Logout',
        description: 'Revokes the current session and clears auth cookies.',
    })
    @ApiOkResponse({ description: 'Logged out.' })
    @ApiUnauthorizedResponse({ description: 'Not authenticated.' })
    async logout(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const refresh = req.cookies?.[REFRESH_COOKIE] as string | undefined;
        const sessionId = refresh ? refresh.split('.')[0] : null;
        await this.auth.logout(sessionId);
        this.cookies.clear(res);
        return { ok: true };
    }

    @Get('me')
    @ApiCookieAuth('cookie-auth')
    @ApiOperation({
        summary: 'Current user',
        description: 'Returns the authenticated user with roles and permissions.',
    })
    @ApiOkResponse({ description: 'User profile.' })
    @ApiUnauthorizedResponse({ description: 'Not authenticated.' })
    async me(@CurrentUser('userId') userId: string) {
        return this.auth.me(userId);
    }
}