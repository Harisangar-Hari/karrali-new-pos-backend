import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const BCRYPT_ROUNDS = 12;
const SUPERADMIN_USERNAME = 'admin';

const USER_INCLUDE = {
    UserRoles: {
        include: {
            Role: {
                select: { Id: true, Name: true, IsSystem: true },
            },
        },
    },
} as const;

type UserRow = Prisma.UserGetPayload<{ include: typeof USER_INCLUDE }>;

@Injectable()
export class UsersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) {}

    // ---------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------

    async list(query: QueryUserDto): Promise<PaginatedResponse<UserRow>> {
        const where: Prisma.UserWhereInput = {};
        if (!query.includeDeleted) where.DeletedAt = null;
        if (query.IsActive !== undefined) where.IsActive = query.IsActive;
        if (query.RoleId) {
            where.UserRoles = { some: { RoleId: query.RoleId } };
        }

        if (query.search) {
            where.OR = [
                { Username: { contains: query.search, mode: 'insensitive' } },
                { FullName: { contains: query.search, mode: 'insensitive' } },
                { Email: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        const orderBy: Prisma.UserOrderByWithRelationInput = {
            [query.sortBy ?? 'Username']: query.sortOrder,
        };

        return paginate<UserRow>(
            this.prisma.user,
            { where, orderBy, include: USER_INCLUDE },
            query.page,
            query.limit,
        );
    }

    async findOne(id: string): Promise<UserRow> {
        const user = await this.prisma.user.findFirst({
            where: { Id: id, DeletedAt: null },
            include: USER_INCLUDE,
        });
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    // ---------------------------------------------------------------
    // Create
    // ---------------------------------------------------------------

    async create(dto: CreateUserDto, actorId: string): Promise<UserRow> {
        const username = dto.Username.toLowerCase().trim();

        return this.prisma.$transaction(async (tx) => {
            const dupe = await tx.user.findUnique({
                where: { Username: username },
                select: { Id: true },
            });
            if (dupe) {
                throw new ConflictException(
                    `Username "${username}" is already in use`,
                );
            }

            if (dto.Email) {
                const emailDupe = await tx.user.findUnique({
                    where: { Email: dto.Email },
                    select: { Id: true },
                });
                if (emailDupe) {
                    throw new ConflictException(
                        `Email "${dto.Email}" is already in use`,
                    );
                }
            }

            // Validate all role IDs exist and aren't soft-deleted
            const roles = await tx.role.findMany({
                where: { Id: { in: dto.RoleIds }, DeletedAt: null },
                select: { Id: true, Name: true },
            });
            if (roles.length !== dto.RoleIds.length) {
                const found = new Set(roles.map((r) => r.Id));
                const missing = dto.RoleIds.filter((id) => !found.has(id));
                throw new BadRequestException(
                    `Role(s) not found: ${missing.join(', ')}`,
                );
            }

            const passwordHash = await bcrypt.hash(dto.Password, BCRYPT_ROUNDS);

            const user = await tx.user.create({
                data: {
                    Username: username,
                    PasswordHash: passwordHash,
                    FullName: dto.FullName ?? null,
                    Email: dto.Email ?? null,
                    IsActive: dto.IsActive ?? true,
                    CreatedByUserId: actorId,
                    UpdatedByUserId: actorId,
                },
            });

            for (const role of roles) {
                await tx.userRole.create({
                    data: {
                        UserId: user.Id,
                        RoleId: role.Id,
                        CreatedByUserId: actorId,
                    },
                });
            }

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'USER_CREATED',
                    Entity: 'User',
                    EntityId: user.Id,
                    After: {
                        Id: user.Id,
                        Username: user.Username,
                        FullName: user.FullName,
                        Email: user.Email,
                        IsActive: user.IsActive,
                    },
                    Metadata: {
                        Roles: roles.map((r) => r.Name),
                    },
                },
                tx,
            );

            return tx.user.findUniqueOrThrow({
                where: { Id: user.Id },
                include: USER_INCLUDE,
            });
        });
    }

    // ---------------------------------------------------------------
    // Update (basic fields)
    // ---------------------------------------------------------------

    async update(
        id: string,
        dto: UpdateUserDto,
        actorId: string,
    ): Promise<UserRow> {
        return this.prisma.$transaction(async (tx) => {
            const current = await tx.user.findFirst({
                where: { Id: id, DeletedAt: null },
            });
            if (!current) throw new NotFoundException('User not found');

            if (dto.Email && dto.Email !== current.Email) {
                const emailDupe = await tx.user.findUnique({
                    where: { Email: dto.Email },
                    select: { Id: true },
                });
                if (emailDupe) {
                    throw new ConflictException(
                        `Email "${dto.Email}" is already in use`,
                    );
                }
            }

            // Guard: deactivating yourself
            const isSelf = id === actorId;
            if (isSelf && dto.IsActive === false) {
                throw new ForbiddenException(
                    'You cannot deactivate your own account.',
                );
            }

            // Guard: deactivating the superadmin
            if (
                current.Username === SUPERADMIN_USERNAME &&
                dto.IsActive === false
            ) {
                throw new ForbiddenException(
                    'The superadmin account cannot be deactivated.',
                );
            }

            // If flipping IsActive, bump SessionVersion to force logout.
            const bumpSessionVersion =
                dto.IsActive !== undefined && dto.IsActive !== current.IsActive;

            const updated = await tx.user.update({
                where: { Id: id },
                data: {
                    FullName: dto.FullName,
                    Email: dto.Email,
                    IsActive: dto.IsActive,
                    SessionVersion: bumpSessionVersion
                        ? { increment: 1 }
                        : undefined,
                    UpdatedByUserId: actorId,
                },
                include: USER_INCLUDE,
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'USER_UPDATED',
                    Entity: 'User',
                    EntityId: id,
                    Before: {
                        FullName: current.FullName,
                        Email: current.Email,
                        IsActive: current.IsActive,
                    },
                    After: {
                        FullName: updated.FullName,
                        Email: updated.Email,
                        IsActive: updated.IsActive,
                    },
                    Metadata: bumpSessionVersion
                        ? { SessionsInvalidated: true }
                        : undefined,
                },
                tx,
            );

            return updated;
        });
    }

    // ---------------------------------------------------------------
    // Assign roles (replaces set)
    // ---------------------------------------------------------------

    async assignRoles(
        id: string,
        dto: AssignRolesDto,
        actorId: string,
    ): Promise<UserRow> {
        return this.prisma.$transaction(async (tx) => {
            const user = await tx.user.findFirst({
                where: { Id: id, DeletedAt: null },
                include: USER_INCLUDE,
            });
            if (!user) throw new NotFoundException('User not found');

            // Validate all role IDs
            const roles = await tx.role.findMany({
                where: { Id: { in: dto.RoleIds }, DeletedAt: null },
                select: { Id: true, Name: true },
            });
            if (roles.length !== dto.RoleIds.length) {
                const found = new Set(roles.map((r) => r.Id));
                const missing = dto.RoleIds.filter((id) => !found.has(id));
                throw new BadRequestException(
                    `Role(s) not found: ${missing.join(', ')}`,
                );
            }

            const currentRoleNames = user.UserRoles.map((ur) => ur.Role.Name);
            const wasAdmin = currentRoleNames.includes('ADMIN');
            const willBeAdmin = roles.some((r) => r.Name === 'ADMIN');

            // Guard: self-removing ADMIN
            if (
                id === actorId &&
                wasAdmin &&
                !willBeAdmin
            ) {
                throw new ForbiddenException(
                    'You cannot remove your own ADMIN role.',
                );
            }

            // Guard: removing ADMIN from the last remaining admin
            if (wasAdmin && !willBeAdmin) {
                const adminRole = await tx.role.findUnique({
                    where: { Name: 'ADMIN' },
                    select: { Id: true },
                });
                if (adminRole) {
                    const otherAdmins = await tx.userRole.count({
                        where: {
                            RoleId: adminRole.Id,
                            NOT: { UserId: id },
                            User: { DeletedAt: null, IsActive: true },
                        },
                    });
                    if (otherAdmins === 0) {
                        throw new ForbiddenException(
                            'Cannot remove the ADMIN role from the last remaining admin.',
                        );
                    }
                }
            }

            // Replace the set
            await tx.userRole.deleteMany({ where: { UserId: id } });
            for (const role of roles) {
                await tx.userRole.create({
                    data: {
                        UserId: id,
                        RoleId: role.Id,
                        CreatedByUserId: actorId,
                    },
                });
            }

            // Roles changed → force re-login so JWT picks up new perms
            await tx.user.update({
                where: { Id: id },
                data: {
                    SessionVersion: { increment: 1 },
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'USER_ROLES_ASSIGNED',
                    Entity: 'User',
                    EntityId: id,
                    Before: { Roles: currentRoleNames },
                    After: { Roles: roles.map((r) => r.Name) },
                    Metadata: { SessionsInvalidated: true },
                },
                tx,
            );

            return tx.user.findUniqueOrThrow({
                where: { Id: id },
                include: USER_INCLUDE,
            });
        });
    }

    // ---------------------------------------------------------------
    // Password — self-service
    // ---------------------------------------------------------------

    async changeOwnPassword(
        userId: string,
        dto: ChangePasswordDto,
    ): Promise<{ ok: true }> {
        return this.prisma.$transaction(async (tx) => {
            const user = await tx.user.findFirst({
                where: { Id: userId, DeletedAt: null },
            });
            if (!user) throw new NotFoundException('User not found');

            const ok = await bcrypt.compare(dto.OldPassword, user.PasswordHash);
            if (!ok) {
                // Audit before throwing — this is a security event
                await this.audit.log(
                    {
                        UserId: userId,
                        Action: 'USER_PASSWORD_CHANGE_FAILED',
                        Entity: 'User',
                        EntityId: userId,
                        Metadata: { Reason: 'wrong_old_password' },
                    },
                    tx,
                );
                throw new BadRequestException('Current password is incorrect');
            }

            const newHash = await bcrypt.hash(dto.NewPassword, BCRYPT_ROUNDS);

            await tx.user.update({
                where: { Id: userId },
                data: {
                    PasswordHash: newHash,
                    SessionVersion: { increment: 1 },
                    UpdatedByUserId: userId,
                },
            });

            await this.audit.log(
                {
                    UserId: userId,
                    Action: 'USER_PASSWORD_CHANGED',
                    Entity: 'User',
                    EntityId: userId,
                    Metadata: { SessionsInvalidated: true },
                },
                tx,
            );

            return { ok: true };
        });
    }

    // ---------------------------------------------------------------
    // Password — admin reset
    // ---------------------------------------------------------------

    async resetPassword(
        id: string,
        dto: ResetPasswordDto,
        actorId: string,
    ): Promise<{ ok: true }> {
        return this.prisma.$transaction(async (tx) => {
            const user = await tx.user.findFirst({
                where: { Id: id, DeletedAt: null },
            });
            if (!user) throw new NotFoundException('User not found');

            const newHash = await bcrypt.hash(dto.NewPassword, BCRYPT_ROUNDS);

            await tx.user.update({
                where: { Id: id },
                data: {
                    PasswordHash: newHash,
                    SessionVersion: { increment: 1 },
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'USER_PASSWORD_RESET',
                    Entity: 'User',
                    EntityId: id,
                    Metadata: {
                        TargetUsername: user.Username,
                        SessionsInvalidated: true,
                    },
                },
                tx,
            );

            return { ok: true };
        });
    }

    // ---------------------------------------------------------------
    // Soft delete
    // ---------------------------------------------------------------

    async remove(id: string, actorId: string): Promise<{ ok: true }> {
        return this.prisma.$transaction(async (tx) => {
            const user = await tx.user.findFirst({
                where: { Id: id, DeletedAt: null },
                include: USER_INCLUDE,
            });
            if (!user) throw new NotFoundException('User not found');

            if (id === actorId) {
                throw new ForbiddenException(
                    'You cannot delete your own account.',
                );
            }

            if (user.Username === SUPERADMIN_USERNAME) {
                throw new ForbiddenException(
                    'The superadmin account cannot be deleted.',
                );
            }

            // Guard: last remaining admin
            const isAdmin = user.UserRoles.some((ur) => ur.Role.Name === 'ADMIN');
            if (isAdmin) {
                const adminRole = await tx.role.findUnique({
                    where: { Name: 'ADMIN' },
                    select: { Id: true },
                });
                if (adminRole) {
                    const otherAdmins = await tx.userRole.count({
                        where: {
                            RoleId: adminRole.Id,
                            NOT: { UserId: id },
                            User: { DeletedAt: null, IsActive: true },
                        },
                    });
                    if (otherAdmins === 0) {
                        throw new ForbiddenException(
                            'Cannot delete the last remaining admin.',
                        );
                    }
                }
            }

            await tx.user.update({
                where: { Id: id },
                data: {
                    DeletedAt: new Date(),
                    IsActive: false,
                    SessionVersion: { increment: 1 },
                    UpdatedByUserId: actorId,
                },
            });

            // Revoke all active sessions for this user
            await tx.session.updateMany({
                where: { UserId: id, RevokedAt: null },
                data: { RevokedAt: new Date() },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'USER_DELETED',
                    Entity: 'User',
                    EntityId: id,
                    Before: {
                        Username: user.Username,
                        FullName: user.FullName,
                        Email: user.Email,
                        Roles: user.UserRoles.map((ur) => ur.Role.Name),
                    },
                },
                tx,
            );

            return { ok: true };
        });
    }

    // ---------------------------------------------------------------
    // Roles list (for the user form dropdown)
    // ---------------------------------------------------------------

    async listRoles(): Promise<
        { Id: string; Name: string; Description: string | null; IsSystem: boolean }[]
    > {
        return this.prisma.role.findMany({
            where: { DeletedAt: null },
            select: {
                Id: true,
                Name: true,
                Description: true,
                IsSystem: true,
            },
            orderBy: { Name: 'asc' },
        });
    }
}