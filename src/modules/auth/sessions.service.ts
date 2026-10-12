import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class SessionsService {
    constructor(private readonly prisma: PrismaService) { }

    private hash(secret: string): string {
        return createHash('sha256').update(secret).digest('hex');
    }

    async create(params: {
        UserId: string;
        UserAgent?: string;
        Ip?: string;
        TtlSeconds: number;
    }): Promise<{ sessionId: string; refreshToken: string }> {
        const sessionId = randomUUID();
        const secret = randomBytes(32).toString('hex');
        const refreshToken = `${sessionId}.${secret}`;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + params.TtlSeconds * 1000);

        await this.prisma.session.create({
            data: {
                Id: sessionId,
                UserId: params.UserId,
                RefreshTokenHash: this.hash(secret),
                UserAgent: params.UserAgent ?? null,
                Ip: params.Ip ?? null,
                ExpiresAt: expiresAt,
                LastUsedAt: now,
            },
        });

        return { sessionId, refreshToken };
    }

    async verify(refreshToken: string) {
        const [sessionId, secret] = refreshToken.split('.');
        if (!sessionId || !secret) {
            throw new UnauthorizedException('Malformed refresh token');
        }

        const session = await this.prisma.session.findUnique({
            where: { Id: sessionId },
            include: {
                User: {
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
                },
            },
        });

        if (!session) throw new UnauthorizedException('Session not found');
        if (session.RevokedAt) throw new UnauthorizedException('Session revoked');
        if (session.ExpiresAt < new Date())
            throw new UnauthorizedException('Session expired');
        if (session.RefreshTokenHash !== this.hash(secret))
            throw new UnauthorizedException('Invalid refresh token');
        if (!session.User.IsActive || session.User.DeletedAt)
            throw new UnauthorizedException('User inactive');

        return session;
    }

    async rotate(sessionId: string, TtlSeconds: number): Promise<string> {
        const secret = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + TtlSeconds * 1000);

        await this.prisma.session.update({
            where: { Id: sessionId },
            data: {
                RefreshTokenHash: this.hash(secret),
                ExpiresAt: expiresAt,
                LastUsedAt: new Date(),
            },
        });

        return `${sessionId}.${secret}`;
    }

    async revoke(sessionId: string): Promise<void> {
        await this.prisma.session.updateMany({
            where: { Id: sessionId, RevokedAt: null },
            data: { RevokedAt: new Date() },
        });
    }

    async revokeAllForUser(userId: string): Promise<void> {
        await this.prisma.session.updateMany({
            where: { UserId: userId, RevokedAt: null },
            data: { RevokedAt: new Date() },
        });
    }
}