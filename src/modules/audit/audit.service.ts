import { Injectable } from '@nestjs/common';
import { AuditLog, Prisma } from '@prisma/client';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

/** Placeholder written in place of sensitive values. */
const REDACTED = '[REDACTED]';

/**
 * Keys that must never appear in a Before/After/Metadata snapshot.
 * Matched case-insensitively. Add to this list whenever a new
 * credential-bearing field lands in the schema.
 */
const SENSITIVE_KEYS = new Set<string>([
    'password',
    'passwordhash',
    'newpassword',
    'oldpassword',
    'refreshtokenhash',
    'accesstoken',
    'refreshtoken',
    'access_token',
    'refresh_token',
    'jwt_access_secret',
    'jwt_refresh_secret',
    'cookie',
    'authorization',
    'set-cookie',
]);

/**
 * Deep-copy any JSON-serializable value with sensitive keys replaced.
 * Handles arrays and nested objects. Primitives and Dates pass through.
 */
function sanitize(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (value instanceof Date) return value;
    if (Array.isArray(value)) return value.map(sanitize);
    if (typeof value !== 'object') return value;

    // Decimal (decimal.js), and any future type with a custom
    // serializer, must go through toJSON before we enumerate keys.
    const withJson = value as { toJSON?: () => unknown };
    if (typeof withJson.toJSON === 'function') {
        return sanitize(withJson.toJSON());
    }

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? REDACTED : sanitize(v);
    }
    return out;
}

export interface AuditLogInput {
    /** null for anonymous events (e.g. LOGIN_FAILED on unknown username). */
    UserId: string | null;
    /** SCREAMING_SNAKE_CASE, e.g. WAREHOUSE_CREATED, SALE_VOIDED. */
    Action: string;
    /** PascalCase model name, e.g. Warehouse, Product, Sale. */
    Entity: string | null;
    /** UUID of the affected row, or null for non-row events (LOGIN_FAILED). */
    EntityId: string | null;
    /** Snapshot before the change. Optional — sanitized before write. */
    Before?: unknown;
    /** Snapshot after the change. Optional — sanitized before write. */
    After?: unknown;
    /** Free-form extras: reason, changed field list, line items, etc. */
    Metadata?: unknown;
    Ip?: string | null;
    UserAgent?: string | null;
}

@Injectable()
export class AuditService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Write one audit entry.
     *
     * Fail-closed by design: if the insert throws, the caller's
     * transaction (when `tx` is supplied) rolls back the whole business
     * operation. When called standalone, the promise rejects and the
     * caller decides whether to swallow.
     *
     * Compose with business writes:
     *   await this.prisma.$transaction(async (tx) => {
     *     const wh = await tx.warehouse.create({ ... });
     *     await this.audit.log({ ... }, tx);
     *     return wh;
     *   });
     *
     * Standalone (no business tx, e.g. LOGIN_FAILED):
     *   await this.audit.log({ Action: 'LOGIN_FAILED', ... });
     */
    async log(
        input: AuditLogInput,
        tx?: Prisma.TransactionClient,
    ): Promise<AuditLog> {
        const data: Prisma.AuditLogUncheckedCreateInput = {
            UserId: input.UserId,
            Action: input.Action,
            Entity: input.Entity,
            EntityId: input.EntityId,
            Ip: input.Ip ?? null,
            UserAgent: input.UserAgent ?? null,
        };

        // Only set JSON columns when the caller provided a value, so
        // the DB stores SQL NULL (not JSON `null`) when omitted.
        if (input.Before !== undefined) {
            data.Before = sanitize(input.Before) as Prisma.InputJsonValue;
        }
        if (input.After !== undefined) {
            data.After = sanitize(input.After) as Prisma.InputJsonValue;
        }
        if (input.Metadata !== undefined) {
            data.Metadata = sanitize(input.Metadata) as Prisma.InputJsonValue;
        }

        const client = tx ?? this.prisma;
        return client.auditLog.create({ data });
    }

    /**
     * Read-only list. Exposed to the audit.view permission.
     * No sanitization on read — rows were already sanitized on write,
     * and callers with audit.view are trusted administrators.
     */
    async list(
        query: QueryAuditLogDto,
    ): Promise<PaginatedResponse<AuditLog>> {
        const where: Prisma.AuditLogWhereInput = {};

        if (query.UserId) where.UserId = query.UserId;
        if (query.Action) where.Action = query.Action;
        if (query.Entity) where.Entity = query.Entity;
        if (query.EntityId) where.EntityId = query.EntityId;

        if (query.From || query.To) {
            where.CreatedAt = {};
            if (query.From) where.CreatedAt.gte = new Date(query.From);
            if (query.To) where.CreatedAt.lte = new Date(query.To);
        }

        if (query.search) {
            where.OR = [
                { Action: { contains: query.search, mode: 'insensitive' } },
                { Entity: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        return paginate<AuditLog>(
            this.prisma.auditLog,
            { where, orderBy: { CreatedAt: 'desc' } },
            query.page,
            query.limit,
        );
    }
}