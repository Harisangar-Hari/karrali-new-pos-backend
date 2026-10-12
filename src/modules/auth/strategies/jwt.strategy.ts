import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ACCESS_COOKIE } from '../../../common/cookie.service';
import { AppConfig } from '../../../config/configuration';
import { PrismaService } from '../../../database/prisma/prisma.service';

export type JwtUser = {
    userId: string;
    username: string;
    roles: string[];
    permissions: string[];
    sessionVersion: number;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(
        config: ConfigService<AppConfig, true>,
        private readonly prisma: PrismaService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                (req: Request) => req?.cookies?.[ACCESS_COOKIE] ?? null,
                ExtractJwt.fromAuthHeaderAsBearerToken(),
            ]),
            ignoreExpiration: false,
            secretOrKey: config.get('jwt.accessSecret', { infer: true }),
        });
    }

    async validate(payload: {
        sub: string;
        username: string;
        sv: number;
        roles?: string[];
        perms?: string[];
    }): Promise<JwtUser> {
        const user = await this.prisma.user.findUnique({
            where: { Id: payload.sub },
            select: {
                Id: true,
                Username: true,
                IsActive: true,
                DeletedAt: true,
                SessionVersion: true,
            },
        });

        if (!user || user.DeletedAt || !user.IsActive) {
            throw new UnauthorizedException('User inactive');
        }
        if (user.SessionVersion !== payload.sv) {
            throw new UnauthorizedException('Session invalidated');
        }

        return {
            userId: user.Id,
            username: user.Username,
            roles: payload.roles ?? [],
            permissions: payload.perms ?? [],
            sessionVersion: user.SessionVersion,
        };
    }
}