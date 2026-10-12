import {
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AppConfig } from '../../config/configuration';
import { parseDurationToSeconds } from '../../common/utils/duration.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SessionsService } from './sessions.service';
import { AuditService } from '../audit/audit.service';

type AccessPayload = {
    sub: string;
    username: string;
    sv: number;
    roles: string[];
    perms: string[];
};

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
        private readonly sessions: SessionsService,
        private readonly config: ConfigService<AppConfig, true>,
        private readonly audit: AuditService,
    ) { }

    private get accessTtlSec(): number {
        return parseDurationToSeconds(
            this.config.get('jwt.accessTtl', { infer: true }),
        );
    }

    private get refreshTtlSec(): number {
        return parseDurationToSeconds(
            this.config.get('jwt.refreshTtl', { infer: true }),
        );
    }

    async login(dto: LoginDto, ctx: { userAgent?: string; ip?: string }) {
        const user = await this.prisma.user.findUnique({
            where: { Username: dto.username },
            include: {
                UserRoles: {
                    include: {
                        Role: {
                            include: {
                                RolePermissions: { include: { Permission: true } },
                            },
                        },
                    },
                },
            },
        });

        if (!user || user.DeletedAt || !user.IsActive) {
            const reason = !user
                ? 'unknown_user'
                : user.DeletedAt
                    ? 'deleted'
                    : 'inactive';
            await this.audit.log({
                UserId: user?.Id ?? null,
                Action: 'LOGIN_FAILED',
                Entity: 'User',
                EntityId: user?.Id ?? null,
                Metadata: { Username: dto.username, Reason: reason },
                Ip: ctx.ip,
                UserAgent: ctx.userAgent,
            });
            throw new UnauthorizedException('Invalid credentials');
        }

        const ok = await bcrypt.compare(dto.password, user.PasswordHash);
        if (!ok) {
            await this.audit.log({
                UserId: user.Id,
                Action: 'LOGIN_FAILED',
                Entity: 'User',
                EntityId: user.Id,
                Metadata: { Username: dto.username, Reason: 'bad_password' },
                Ip: ctx.ip,
                UserAgent: ctx.userAgent,
            });
            throw new UnauthorizedException('Invalid credentials');
        }

        const roles = user.UserRoles.map((ur) => ur.Role.Name);
        const perms = Array.from(
            new Set(
                user.UserRoles.flatMap((ur) =>
                    ur.Role.RolePermissions.map((rp) => rp.Permission.Code),
                ),
            ),
        );

        const { sessionId, refreshToken } = await this.sessions.create({
            UserId: user.Id,
            UserAgent: ctx.userAgent,
            Ip: ctx.ip,
            TtlSeconds: this.refreshTtlSec,
        });

        const accessToken = await this.signAccess({
            sub: user.Id,
            username: user.Username,
            sv: user.SessionVersion,
            roles,
            perms,
        });

        await this.prisma.user.update({
            where: { Id: user.Id },
            data: { LastLogin: new Date() },
        });

        await this.audit.log({
            UserId: user.Id,
            Action: 'LOGIN_SUCCESS',
            Entity: 'User',
            EntityId: user.Id,
            Metadata: { SessionId: sessionId, Username: user.Username },
            Ip: ctx.ip,
            UserAgent: ctx.userAgent,
        });

        return {
            user: {
                Id: user.Id,
                Username: user.Username,
                FullName: user.FullName,
                Email: user.Email,
                Roles: roles,
                Permissions: perms,
            },
            accessToken,
            refreshToken,
            sessionId,
            accessTtlSec: this.accessTtlSec,
            refreshTtlSec: this.refreshTtlSec,
        };
    }

    async refresh(
        refreshToken: string,
        _ctx: { userAgent?: string; ip?: string },
    ) {
        const session = await this.sessions.verify(refreshToken);
        const newRefreshToken = await this.sessions.rotate(
            session.Id,
            this.refreshTtlSec,
        );

        const roles = session.User.UserRoles.map((ur) => ur.Role.Name);
        const perms = Array.from(
            new Set(
                session.User.UserRoles.flatMap((ur) =>
                    ur.Role.RolePermissions.map((rp) => rp.Permission.Code),
                ),
            ),
        );

        const accessToken = await this.signAccess({
            sub: session.User.Id,
            username: session.User.Username,
            sv: session.User.SessionVersion,
            roles,
            perms,
        });

        return {
            accessToken,
            refreshToken: newRefreshToken,
            accessTtlSec: this.accessTtlSec,
            refreshTtlSec: this.refreshTtlSec,
        };
    }

    async logout(sessionId: string | null): Promise<void> {
        if (!sessionId) return;

        const session = await this.prisma.session.findUnique({
            where: { Id: sessionId },
            select: { UserId: true },
        });

        await this.sessions.revoke(sessionId);

        if (session) {
            await this.audit.log({
                UserId: session.UserId,
                Action: 'LOGOUT',
                Entity: 'User',
                EntityId: session.UserId,
                Metadata: { SessionId: sessionId },
            });
        }
    }

    async me(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { Id: userId },
            include: {
                UserRoles: {
                    include: {
                        Role: {
                            include: {
                                RolePermissions: { include: { Permission: true } },
                            },
                        },
                    },
                },
            },
        });

        if (!user || user.DeletedAt || !user.IsActive) {
            throw new UnauthorizedException('User inactive');
        }

        const roles = user.UserRoles.map((ur) => ur.Role.Name);
        const perms = Array.from(
            new Set(
                user.UserRoles.flatMap((ur) =>
                    ur.Role.RolePermissions.map((rp) => rp.Permission.Code),
                ),
            ),
        );

        return {
            Id: user.Id,
            Username: user.Username,
            FullName: user.FullName,
            Email: user.Email,
            Roles: roles,
            Permissions: perms,
            LastLogin: user.LastLogin,
        };
    }

    private async signAccess(payload: AccessPayload): Promise<string> {
        return this.jwt.signAsync(payload, {
            secret: this.config.get('jwt.accessSecret', { infer: true }),
            expiresIn: this.config.get('jwt.accessTtl', { infer: true }),
        });
    }
}