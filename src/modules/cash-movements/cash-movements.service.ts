import { Injectable, NotFoundException } from '@nestjs/common';
import { CashMovement, CashMovementType, Prisma } from '@prisma/client';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { CatalogGuardsService } from '../../common/services/catalog-guards.service';
import { nextCode } from '../../common/utils/code.util';
import { paginate } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';
import { DeleteCashMovementDto } from './dto/delete-cash-movement.dto';
import { QueryCashMovementDto } from './dto/query-cash-movement.dto';

const MOVEMENT_CODE_PREFIX = 'CM';

const MOVEMENT_INCLUDE = {
    BankAccount: { select: { Id: true, Name: true, BankName: true } },
    CashSession: {
        select: { Id: true, OpenedAt: true, ClosedAt: true, Status: true },
    },
} as const;

type MovementRow = Prisma.CashMovementGetPayload<{
    include: typeof MOVEMENT_INCLUDE;
}>;

@Injectable()
export class CashMovementsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly guards: CatalogGuardsService,
    ) {}

    // ---------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------

    async list(
        query: QueryCashMovementDto,
    ): Promise<PaginatedResponse<MovementRow>> {
        const where: Prisma.CashMovementWhereInput = {};

        if (query.Type) where.Type = query.Type;
        if (query.BankAccountId) where.BankAccountId = query.BankAccountId;
        if (query.CashSessionId) where.CashSessionId = query.CashSessionId;

        if (query.From || query.To) {
            where.CreatedAt = {};
            if (query.From) where.CreatedAt.gte = new Date(query.From);
            if (query.To) where.CreatedAt.lte = new Date(query.To);
        }

        if (query.search) {
            where.OR = [
                { Code: { contains: query.search, mode: 'insensitive' } },
                { Reason: { contains: query.search, mode: 'insensitive' } },
                { Notes: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        const orderBy: Prisma.CashMovementOrderByWithRelationInput = {
            [query.sortBy ?? 'CreatedAt']: query.sortOrder,
        };

        return paginate<MovementRow>(
            this.prisma.cashMovement,
            { where, orderBy, include: MOVEMENT_INCLUDE },
            query.page,
            query.limit,
        );
    }

    async findOne(id: string): Promise<MovementRow> {
        const movement = await this.prisma.cashMovement.findUnique({
            where: { Id: id },
            include: MOVEMENT_INCLUDE,
        });
        if (!movement) throw new NotFoundException('Cash movement not found');
        return movement;
    }

    // ---------------------------------------------------------------
    // Create
    // ---------------------------------------------------------------

    async create(
        dto: CreateCashMovementDto,
        actorId: string,
    ): Promise<MovementRow> {
        if (dto.BankAccountId) {
            await this.guards.assertBankAccountUsable(dto.BankAccountId);
        }

        const amount = new Prisma.Decimal(dto.Amount);

        // CASH_IN → +amount, CASH_OUT → -amount
        const ledgerSignedAmount =
            dto.Type === 'CASH_IN' ? amount : amount.neg();

        return this.prisma.$transaction(async (tx) => {
            // Auto-link to the actor's currently open session, if any.
            // If none, session is attached retroactively at close time
            // by the orphan-attachment logic in CashSessionsService.
            const openSession = await tx.cashSession.findFirst({
                where: { CashierId: actorId, Status: 'OPEN' },
                select: { Id: true },
            });

            const code = await nextCode(tx, MOVEMENT_CODE_PREFIX);

            const movement = await tx.cashMovement.create({
                data: {
                    Code: code,
                    Type: dto.Type,
                    Amount: amount,
                    Reason: dto.Reason,
                    Notes: dto.Notes ?? null,
                    BankAccountId: dto.BankAccountId ?? null,
                    CashSessionId: openSession?.Id ?? null,
                    CreatedByUserId: actorId,
                    UpdatedByUserId: actorId,
                },
            });

            await tx.cashLedger.create({
                data: {
                    Type: dto.Type,
                    Amount: ledgerSignedAmount,
                    CashSessionId: openSession?.Id ?? null,
                    Notes: `${code}: ${dto.Reason}`,
                    CreatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'CASH_MOVEMENT_CREATED',
                    Entity: 'CashMovement',
                    EntityId: movement.Id,
                    After: movement,
                    Metadata: {
                        Type: dto.Type,
                        Reason: dto.Reason,
                        BankAccountId: dto.BankAccountId ?? null,
                        SessionId: openSession?.Id ?? null,
                    },
                },
                tx,
            );

            return tx.cashMovement.findUniqueOrThrow({
                where: { Id: movement.Id },
                include: MOVEMENT_INCLUDE,
            });
        });
    }

    // ---------------------------------------------------------------
    // Delete — reverses the ledger effect
    // ---------------------------------------------------------------

    async remove(
        id: string,
        dto: DeleteCashMovementDto,
        actorId: string,
    ): Promise<{ ok: true }> {
        return this.prisma.$transaction(async (tx) => {
            const movement = await tx.cashMovement.findUnique({
                where: { Id: id },
            });
            if (!movement) throw new NotFoundException('Cash movement not found');

            const amount = new Prisma.Decimal(movement.Amount);

            // Delete reversal writes the OPPOSITE ledger type:
            //   deleting CASH_IN  → write CASH_OUT with -amount
            //   deleting CASH_OUT → write CASH_IN  with +amount
            const reverseType: CashMovementType =
                movement.Type === 'CASH_IN' ? 'CASH_OUT' : 'CASH_IN';
            const reverseSignedAmount =
                movement.Type === 'CASH_IN' ? amount.neg() : amount;

            // Attach the reversal to any open session the actor has right
            // now — the reversal affects the CURRENT drawer, not the
            // historical session the original entry belonged to.
            const openSession = await tx.cashSession.findFirst({
                where: { CashierId: actorId, Status: 'OPEN' },
                select: { Id: true },
            });

            await tx.cashLedger.create({
                data: {
                    Type: reverseType,
                    Amount: reverseSignedAmount,
                    CashSessionId: openSession?.Id ?? null,
                    Notes: `Reversal of ${movement.Code}: ${dto.Reason}`,
                    CreatedByUserId: actorId,
                },
            });

            await tx.cashMovement.delete({ where: { Id: id } });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'CASH_MOVEMENT_DELETED',
                    Entity: 'CashMovement',
                    EntityId: id,
                    Before: movement,
                    Metadata: {
                        Reason: dto.Reason,
                        ReversalType: reverseType,
                    },
                },
                tx,
            );

            return { ok: true };
        });
    }
}