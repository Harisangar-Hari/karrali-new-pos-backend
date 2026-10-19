import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { CashSession, Prisma } from '@prisma/client';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CloseSessionDto } from './dto/close-session.dto';
import { OpenSessionDto } from './dto/open-session.dto';
import { QueryCashLedgerDto } from './dto/query-cash-ledger.dto';
import { QueryCashSessionDto } from './dto/query-cash-session.dto';

const SESSION_INCLUDE = {
    Terminal: { select: { Id: true, Name: true, Code: true } },
    Cashier: { select: { Id: true, Username: true, FullName: true } },
} as const;

const LEDGER_INCLUDE = {
    CashSession: {
        select: { Id: true, OpenedAt: true, ClosedAt: true, Status: true },
    },
} as const;

type SessionRow = Prisma.CashSessionGetPayload<{ include: typeof SESSION_INCLUDE }>;
type LedgerRow = Prisma.CashLedgerGetPayload<{ include: typeof LEDGER_INCLUDE }>;

const ZERO = new Prisma.Decimal(0);
const EPSILON = new Prisma.Decimal('0.0001');

export interface ExpectedCashResult {
    SessionId: string;
    StartingCash: string;
    LedgerTotal: string;
    ExpectedCash: string;
    EntryCount: number;
    /** Per-type totals for the drawer breakdown strip. */
    ByType: Record<string, { total: string; count: number }>;
}

export interface OpenSessionSummary extends Omit<SessionRow, 'ExpectedCash'> {
    LedgerTotal: string;
    /** Live expected cash (string) — overrides the DB Decimal column of the same name. */
    ExpectedCash: string;
    EntryCount: number;
}

@Injectable()
export class CashSessionsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    // ---------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------

    async list(
        query: QueryCashSessionDto,
    ): Promise<PaginatedResponse<SessionRow>> {
        const where: Prisma.CashSessionWhereInput = {};

        if (query.TerminalId) where.TerminalId = query.TerminalId;
        if (query.CashierId) where.CashierId = query.CashierId;
        if (query.Status) where.Status = query.Status;

        if (query.From || query.To) {
            where.OpenedAt = {};
            if (query.From) where.OpenedAt.gte = new Date(query.From);
            if (query.To) where.OpenedAt.lte = new Date(query.To);
        }

        const orderBy: Prisma.CashSessionOrderByWithRelationInput = {
            [query.sortBy ?? 'OpenedAt']: query.sortOrder,
        };

        return paginate<SessionRow>(
            this.prisma.cashSession,
            { where, orderBy, include: SESSION_INCLUDE },
            query.page,
            query.limit,
        );
    }

    async findOne(id: string): Promise<SessionRow> {
        const session = await this.prisma.cashSession.findUnique({
            where: { Id: id },
            include: SESSION_INCLUDE,
        });
        if (!session) throw new NotFoundException('Cash session not found');
        return session;
    }

    /**
     * The currently-open session for the given cashier. Returns null if
     * none. POS clients hit this on load to know whether the drawer is
     * already open.
     */
    async getMyOpenSession(cashierId: string): Promise<OpenSessionSummary | null> {
        const session = await this.prisma.cashSession.findFirst({
            where: { CashierId: cashierId, Status: 'OPEN' },
            include: SESSION_INCLUDE,
        });
        if (!session) return null;
        return this.withExpectedCash(session);
    }

    /**
     * Live expected cash for a session (no close). Includes orphan
     * ledger entries created during the session window that haven't
     * been attached yet.
     */
   async getExpectedCash(sessionId: string): Promise<ExpectedCashResult> {
        const session = await this.prisma.cashSession.findUnique({
            where: { Id: sessionId },
        });
        if (!session) throw new NotFoundException('Cash session not found');

        const upTo = session.ClosedAt ?? new Date();

        // Same "attached + in-window orphans" predicate used by
        // computeLedgerTotal, applied twice: once for the grand total,
        // once grouped by Type for the drawer breakdown strip.
        const ledgerWhere: Prisma.CashLedgerWhereInput = {
            OR: [
                { CashSessionId: sessionId },
                {
                    CashSessionId: null,
                    CreatedByUserId: session.CashierId,
                    CreatedAt: { gte: session.OpenedAt, lte: upTo },
                },
            ],
        };

        const [{ total, count }, grouped] = await Promise.all([
            this.computeLedgerTotal(
                session.Id,
                session.CashierId,
                session.OpenedAt,
                upTo,
            ),
            this.prisma.cashLedger.groupBy({
                by: ['Type'],
                where: ledgerWhere,
                _sum: { Amount: true },
                _count: { _all: true },
            }),
        ]);

        const byType: Record<string, { total: string; count: number }> = {};
        for (const row of grouped) {
            byType[row.Type] = {
                total: new Prisma.Decimal(row._sum.Amount ?? 0).toString(),
                count: row._count._all,
            };
        }

        const expected = new Prisma.Decimal(session.StartingCash).add(total);

        return {
            SessionId: session.Id,
            StartingCash: session.StartingCash.toString(),
            LedgerTotal: total.toString(),
            ExpectedCash: expected.toString(),
            EntryCount: count,
            ByType: byType,
        };
    }

    async getLedger(
        query: QueryCashLedgerDto,
    ): Promise<PaginatedResponse<LedgerRow>> {
        const where: Prisma.CashLedgerWhereInput = {};

        if (query.CashSessionId) where.CashSessionId = query.CashSessionId;
        if (query.Type) where.Type = query.Type;

        if (query.From || query.To) {
            where.CreatedAt = {};
            if (query.From) where.CreatedAt.gte = new Date(query.From);
            if (query.To) where.CreatedAt.lte = new Date(query.To);
        }

        return paginate<LedgerRow>(
            this.prisma.cashLedger,
            { where, orderBy: { CreatedAt: 'desc' }, include: LEDGER_INCLUDE },
            query.page,
            query.limit,
        );
    }

    // ---------------------------------------------------------------
    // Open
    // ---------------------------------------------------------------

    async open(dto: OpenSessionDto, actorId: string): Promise<SessionRow> {
        const terminal = await this.prisma.terminal.findFirst({
            where: { Id: dto.TerminalId, DeletedAt: null },
            select: { Id: true, IsActive: true, Code: true },
        });
        if (!terminal) {
            throw new BadRequestException('Terminal not found or has been deleted');
        }
        if (!terminal.IsActive) {
            throw new BadRequestException(`Terminal ${terminal.Code} is inactive`);
        }

        const existing = await this.prisma.cashSession.findFirst({
            where: { CashierId: actorId, Status: 'OPEN' },
            select: { Id: true, TerminalId: true, OpenedAt: true },
        });
        if (existing) {
            throw new ConflictException(
                `You already have an open session (opened ${existing.OpenedAt.toISOString()}). Close it before opening a new one.`,
            );
        }

        return this.prisma.$transaction(async (tx) => {
            const session = await tx.cashSession.create({
                data: {
                    TerminalId: dto.TerminalId,
                    CashierId: actorId,
                    OpenedAt: new Date(),
                    StartingCash: new Prisma.Decimal(dto.StartingCash),
                    Status: 'OPEN',
                    Notes: dto.Notes ?? null,
                    CreatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'CASH_SESSION_OPENED',
                    Entity: 'CashSession',
                    EntityId: session.Id,
                    After: session,
                    Metadata: {
                        TerminalCode: terminal.Code,
                        StartingCash: dto.StartingCash.toFixed(4),
                    },
                },
                tx,
            );

            return tx.cashSession.findUniqueOrThrow({
                where: { Id: session.Id },
                include: SESSION_INCLUDE,
            });
        });
    }

    // ---------------------------------------------------------------
    // Close
    // ---------------------------------------------------------------

    async close(
        id: string,
        dto: CloseSessionDto,
        actorId: string,
        canCloseOthers: boolean,
    ): Promise<SessionRow> {
        return this.prisma.$transaction(async (tx) => {
            const session = await tx.cashSession.findUnique({
                where: { Id: id },
            });
            if (!session) throw new NotFoundException('Cash session not found');

            if (session.Status !== 'OPEN') {
                throw new ConflictException(
                    `Session is already ${session.Status}.`,
                );
            }

            if (session.CashierId !== actorId && !canCloseOthers) {
                throw new ForbiddenException(
                    'Only the session cashier or a manager can close this session.',
                );
            }

            const closedAt = new Date();

            // 1. Attach orphan ledger entries created during this session
            //    by this cashier, in this time window.
            await tx.cashLedger.updateMany({
                where: {
                    CashSessionId: null,
                    CreatedByUserId: session.CashierId,
                    CreatedAt: { gte: session.OpenedAt, lte: closedAt },
                },
                data: { CashSessionId: session.Id },
            });

            // 2. Sum all ledger entries for this session.
            const agg = await tx.cashLedger.aggregate({
                where: { CashSessionId: session.Id },
                _sum: { Amount: true },
            });
            const ledgerTotal = new Prisma.Decimal(agg._sum.Amount ?? 0);

            const expectedCash = new Prisma.Decimal(session.StartingCash).add(
                ledgerTotal,
            );
            const countedCash = new Prisma.Decimal(dto.CountedCash);
            const difference = countedCash.sub(expectedCash);

            const hasDiscrepancy = difference.abs().gt(EPSILON);
            if (hasDiscrepancy && !dto.DiscrepancyReason) {
                throw new BadRequestException(
                    `Counted ${countedCash.toString()} differs from expected ${expectedCash.toString()} by ${difference.toString()}. Provide DiscrepancyReason.`,
                );
            }

            const updated = await tx.cashSession.update({
                where: { Id: id },
                data: {
                    Status: 'CLOSED',
                    ClosedAt: closedAt,
                    ClosedByUserId: actorId,
                    CountedCash: countedCash,
                    ExpectedCash: expectedCash,
                    Difference: difference,
                    Notes: dto.Notes
                        ? session.Notes
                            ? `${session.Notes}\n\nClose: ${dto.Notes}`
                            : `Close: ${dto.Notes}`
                        : session.Notes,
                },
                include: SESSION_INCLUDE,
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'CASH_SESSION_CLOSED',
                    Entity: 'CashSession',
                    EntityId: id,
                    Before: { Status: 'OPEN' },
                    After: {
                        Status: 'CLOSED',
                        ClosedAt: closedAt.toISOString(),
                        CountedCash: countedCash.toString(),
                        ExpectedCash: expectedCash.toString(),
                        Difference: difference.toString(),
                    },
                    Metadata: {
                        DiscrepancyReason: dto.DiscrepancyReason ?? null,
                    },
                },
                tx,
            );

            return updated;
        });
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    /**
     * Sum ledger amounts for a session. Includes both:
     *  - Entries already attached to the session (CashSessionId = id)
     *  - Orphan entries by the same cashier within the time window
     *
     * This matches what `close` does when it attaches orphans, so the
     * live preview and the final close agree.
     */
    private async computeLedgerTotal(
        sessionId: string,
        cashierId: string,
        openedAt: Date,
        upTo: Date,
    ): Promise<{ total: Prisma.Decimal; count: number }> {
        const [attachedAgg, attachedCount, orphanAgg, orphanCount] =
            await Promise.all([
                this.prisma.cashLedger.aggregate({
                    where: { CashSessionId: sessionId },
                    _sum: { Amount: true },
                }),
                this.prisma.cashLedger.count({
                    where: { CashSessionId: sessionId },
                }),
                this.prisma.cashLedger.aggregate({
                    where: {
                        CashSessionId: null,
                        CreatedByUserId: cashierId,
                        CreatedAt: { gte: openedAt, lte: upTo },
                    },
                    _sum: { Amount: true },
                }),
                this.prisma.cashLedger.count({
                    where: {
                        CashSessionId: null,
                        CreatedByUserId: cashierId,
                        CreatedAt: { gte: openedAt, lte: upTo },
                    },
                }),
            ]);

        const total = new Prisma.Decimal(attachedAgg._sum.Amount ?? 0).add(
            orphanAgg._sum.Amount ?? 0,
        );
        return { total, count: attachedCount + orphanCount };
    }

    private async withExpectedCash(
        session: CashSession & SessionRow,
    ): Promise<OpenSessionSummary> {
        const { total, count } = await this.computeLedgerTotal(
            session.Id,
            session.CashierId,
            session.OpenedAt,
            new Date(),
        );
        const expectedCash = new Prisma.Decimal(session.StartingCash).add(total);

        return {
            ...session,
            LedgerTotal: total.toString(),
            ExpectedCash: expectedCash.toString(),
            EntryCount: count,
        };
    }
}