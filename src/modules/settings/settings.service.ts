import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { Prisma, Setting } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { UpsertSettingDto } from './dto/upsert-setting.dto';
import { QuerySettingDto } from './dto/query-setting.dto';

@Injectable()
export class SettingsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) {}

    /**
     * All settings, ordered by Key. Optionally filtered by `search`.
     * Not paginated — the total row count is expected to stay small.
     */
    async list(query: QuerySettingDto): Promise<Setting[]> {
        const where: Prisma.SettingWhereInput = {};
        if (query.search) {
            where.OR = [
                { Key: { contains: query.search, mode: 'insensitive' } },
                { Description: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        return this.prisma.setting.findMany({
            where,
            orderBy: { Key: 'asc' },
        });
    }

    async findOne(key: string): Promise<Setting> {
        const setting = await this.prisma.setting.findUnique({
            where: { Key: key },
        });
        if (!setting) throw new NotFoundException(`Setting "${key}" not found`);
        return setting;
    }

    /**
     * Upsert — creates or replaces. HTTP PUT semantics (idempotent).
     * Writes one audit row: SETTING_UPDATED with before/after snapshots.
     * `Before` is null on first creation.
     */
    async upsert(
        key: string,
        dto: UpsertSettingDto,
        actorId: string,
    ): Promise<Setting> {
        return this.prisma.$transaction(async (tx) => {
            const before = await tx.setting.findUnique({
                where: { Key: key },
            });

            const after = await tx.setting.upsert({
                where: { Key: key },
                create: {
                    Key: key,
                    Value: dto.Value as Prisma.InputJsonValue,
                    Description: dto.Description ?? null,
                    UpdatedByUserId: actorId,
                },
                update: {
                    Value: dto.Value as Prisma.InputJsonValue,
                    Description: dto.Description ?? undefined,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: before ? 'SETTING_UPDATED' : 'SETTING_CREATED',
                    Entity: 'Setting',
                    EntityId: null, // Setting uses Key as PK, not UUID
                    Before: before ?? undefined,
                    After: after,
                    Metadata: { Key: key },
                },
                tx,
            );

            return after;
        });
    }

    /**
     * Hard delete. Setting has no DeletedAt column — settings are
     * configuration, not business records, so soft-delete doesn't
     * apply. Audit row preserves the removed value.
     */
    async remove(key: string, actorId: string): Promise<{ ok: true }> {
        const existing = await this.prisma.setting.findUnique({
            where: { Key: key },
        });
        if (!existing) {
            throw new NotFoundException(`Setting "${key}" not found`);
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.setting.delete({ where: { Key: key } });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'SETTING_DELETED',
                    Entity: 'Setting',
                    EntityId: null,
                    Before: existing,
                    Metadata: { Key: key },
                },
                tx,
            );
        });

        return { ok: true };
    }
}