import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { nextCode } from '../../common/utils/code.util';
import { paginate } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SupplierPaymentsService } from '../supplier-payments/supplier-payments.service';
import { BounceSupplierChequeDto } from './dto/bounce-supplier-cheque.dto';
import { ClearSupplierChequeDto } from './dto/clear-supplier-cheque.dto';
import { CreateSupplierChequeDto } from './dto/create-supplier-cheque.dto';
import { QuerySupplierChequeDto } from './dto/query-supplier-cheque.dto';
import { VoidSupplierChequeDto } from './dto/void-supplier-cheque.dto';

const CHEQUE_CODE_PREFIX = 'CHQ';

const CHEQUE_INCLUDE = {
    Supplier: { select: { Id: true, Name: true, Code: true } },
    Purchase: {
        select: {
            Id: true,
            Code: true,
            TotalAmount: true,
            PaidAmount: true,
            Status: true,
        },
    },
    Payment: {
        select: { Id: true, Code: true, Method: true, Amount: true, PaidAt: true },
    },
} as const;

type ChequeRow = Prisma.SupplierChequeGetPayload<{
    include: typeof CHEQUE_INCLUDE;
}>;

@Injectable()
export class SupplierChequesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly payments: SupplierPaymentsService,
    ) {}

    // ---------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------

    async list(
        query: QuerySupplierChequeDto,
    ): Promise<PaginatedResponse<ChequeRow>> {
        const where: Prisma.SupplierChequeWhereInput = {};

        if (query.SupplierId) where.SupplierId = query.SupplierId;
        if (query.PurchaseId) where.PurchaseId = query.PurchaseId;
        if (query.Status) where.Status = query.Status;

        if (query.dueBefore || query.dueAfter) {
            where.DueDate = {};
            if (query.dueAfter) where.DueDate.gte = new Date(query.dueAfter);
            if (query.dueBefore) where.DueDate.lte = new Date(query.dueBefore);
        }

        if (query.search) {
            where.OR = [
                { Code: { contains: query.search, mode: 'insensitive' } },
                { ChequeNumber: { contains: query.search, mode: 'insensitive' } },
                { BankName: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        const orderBy: Prisma.SupplierChequeOrderByWithRelationInput = {
            [query.sortBy ?? 'DueDate']: query.sortOrder,
        };

        return paginate<ChequeRow>(
            this.prisma.supplierCheque,
            { where, orderBy, include: CHEQUE_INCLUDE },
            query.page,
            query.limit,
        );
    }

    async findOne(id: string): Promise<ChequeRow> {
        const cheque = await this.prisma.supplierCheque.findUnique({
            where: { Id: id },
            include: CHEQUE_INCLUDE,
        });
        if (!cheque) throw new NotFoundException('Cheque not found');
        return cheque;
    }

    // ---------------------------------------------------------------
    // Create — issue a PENDING cheque
    // ---------------------------------------------------------------

    async create(
        dto: CreateSupplierChequeDto,
        actorId: string,
    ): Promise<ChequeRow> {
        const amount = new Prisma.Decimal(dto.Amount);

        const purchase = await this.prisma.purchase.findFirst({
            where: { Id: dto.PurchaseId, DeletedAt: null },
            include: {
                Supplier: {
                    select: { Id: true, IsActive: true, DeletedAt: true },
                },
            },
        });
        if (!purchase) throw new NotFoundException('Purchase not found');

        if (purchase.Status !== 'POSTED') {
            throw new ConflictException(
                `Cannot issue a cheque against a ${purchase.Status} purchase.`,
            );
        }
        if (
            !purchase.Supplier ||
            purchase.Supplier.DeletedAt ||
            !purchase.Supplier.IsActive
        ) {
            throw new BadRequestException(
                'Purchase supplier is inactive or deleted.',
            );
        }

        // Pending cheques already "reserve" part of the invoice.
        // New cheque can't push (paid + pending + new) above TotalAmount.
        const pendingAgg = await this.prisma.supplierCheque.aggregate({
            where: { PurchaseId: purchase.Id, Status: 'PENDING' },
            _sum: { Amount: true },
        });
        const pendingSum = new Prisma.Decimal(
            pendingAgg._sum.Amount ?? 0,
        );

        const committed = new Prisma.Decimal(purchase.PaidAmount).add(pendingSum);
        const remaining = new Prisma.Decimal(purchase.TotalAmount).sub(committed);

        if (amount.greaterThan(remaining)) {
            throw new BadRequestException(
                `Amount exceeds the un-committed balance of ${remaining.toString()} (total ${purchase.TotalAmount.toString()} − paid ${purchase.PaidAmount.toString()} − pending cheques ${pendingSum.toString()}).`,
            );
        }

        return this.prisma.$transaction(async (tx) => {
            const code = await nextCode(tx, CHEQUE_CODE_PREFIX);

            const cheque = await tx.supplierCheque.create({
                data: {
                    Code: code,
                    SupplierId: purchase.SupplierId,
                    PurchaseId: purchase.Id,
                    ChequeNumber: dto.ChequeNumber,
                    BankName: dto.BankName ?? null,
                    Amount: amount,
                    IssueDate: new Date(dto.IssueDate),
                    DueDate: new Date(dto.DueDate),
                    Status: 'PENDING',
                    Notes: dto.Notes ?? null,
                    CreatedByUserId: actorId,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'SUPPLIER_CHEQUE_ISSUED',
                    Entity: 'SupplierCheque',
                    EntityId: cheque.Id,
                    After: cheque,
                    Metadata: {
                        PurchaseCode: purchase.Code,
                        ChequeNumber: dto.ChequeNumber,
                    },
                },
                tx,
            );

            return tx.supplierCheque.findUniqueOrThrow({
                where: { Id: cheque.Id },
                include: CHEQUE_INCLUDE,
            });
        });
    }

    // ---------------------------------------------------------------
    // Clear — PENDING → CLEARED. Creates the SupplierPayment.
    // ---------------------------------------------------------------

    async clear(
        id: string,
        dto: ClearSupplierChequeDto,
        actorId: string,
    ): Promise<ChequeRow> {
        return this.prisma.$transaction(async (tx) => {
            const cheque = await tx.supplierCheque.findUnique({
                where: { Id: id },
            });
            if (!cheque) throw new NotFoundException('Cheque not found');

            if (cheque.Status !== 'PENDING') {
                throw new ConflictException(
                    `Cannot clear a cheque in ${cheque.Status} status.`,
                );
            }

            const clearedAt = dto.ClearedAt ? new Date(dto.ClearedAt) : new Date();

            const updated = await tx.supplierCheque.update({
                where: { Id: id },
                data: {
                    Status: 'CLEARED',
                    ClearedAt: clearedAt,
                    Notes: dto.Notes
                        ? cheque.Notes
                            ? `${cheque.Notes}\n\nCleared: ${dto.Notes}`
                            : `Cleared: ${dto.Notes}`
                        : cheque.Notes,
                    UpdatedByUserId: actorId,
                },
            });

            // Auto-create the payment (bumps Purchase.PaidAmount).
            await this.payments.createFromCheque(
                {
                    ChequeId: updated.Id,
                    ChequeCode: updated.Code,
                    SupplierId: updated.SupplierId,
                    PurchaseId: updated.PurchaseId,
                    Amount: new Prisma.Decimal(updated.Amount),
                    PaidAt: clearedAt,
                    ActorId: actorId,
                },
                tx,
            );

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'SUPPLIER_CHEQUE_CLEARED',
                    Entity: 'SupplierCheque',
                    EntityId: id,
                    Before: { Status: 'PENDING' },
                    After: {
                        Status: 'CLEARED',
                        ClearedAt: clearedAt.toISOString(),
                    },
                    Metadata: { ChequeNumber: cheque.ChequeNumber },
                },
                tx,
            );

            return tx.supplierCheque.findUniqueOrThrow({
                where: { Id: id },
                include: CHEQUE_INCLUDE,
            });
        });
    }

    // ---------------------------------------------------------------
    // Bounce — PENDING → BOUNCED. No payment created.
    // ---------------------------------------------------------------

    async bounce(
        id: string,
        dto: BounceSupplierChequeDto,
        actorId: string,
    ): Promise<ChequeRow> {
        return this.prisma.$transaction(async (tx) => {
            const cheque = await tx.supplierCheque.findUnique({
                where: { Id: id },
            });
            if (!cheque) throw new NotFoundException('Cheque not found');

            if (cheque.Status !== 'PENDING') {
                throw new ConflictException(
                    `Cannot bounce a cheque in ${cheque.Status} status.`,
                );
            }

            const bouncedAt = dto.BouncedAt ? new Date(dto.BouncedAt) : new Date();

            const updated = await tx.supplierCheque.update({
                where: { Id: id },
                data: {
                    Status: 'BOUNCED',
                    BouncedAt: bouncedAt,
                    BounceReason: dto.Reason,
                    Notes: dto.Notes
                        ? cheque.Notes
                            ? `${cheque.Notes}\n\nBounced: ${dto.Notes}`
                            : `Bounced: ${dto.Notes}`
                        : cheque.Notes,
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'SUPPLIER_CHEQUE_BOUNCED',
                    Entity: 'SupplierCheque',
                    EntityId: id,
                    Before: { Status: 'PENDING' },
                    After: {
                        Status: 'BOUNCED',
                        BouncedAt: bouncedAt.toISOString(),
                    },
                    Metadata: {
                        ChequeNumber: cheque.ChequeNumber,
                        Reason: dto.Reason,
                    },
                },
                tx,
            );

            return tx.supplierCheque.findUniqueOrThrow({
                where: { Id: id },
                include: CHEQUE_INCLUDE,
            });
        });
    }

    // ---------------------------------------------------------------
    // Void — PENDING → VOIDED. Never reached the bank.
    // ---------------------------------------------------------------

    async void(
        id: string,
        dto: VoidSupplierChequeDto,
        actorId: string,
    ): Promise<ChequeRow> {
        return this.prisma.$transaction(async (tx) => {
            const cheque = await tx.supplierCheque.findUnique({
                where: { Id: id },
            });
            if (!cheque) throw new NotFoundException('Cheque not found');

            if (cheque.Status !== 'PENDING') {
                throw new ConflictException(
                    `Cannot void a cheque in ${cheque.Status} status. Only PENDING cheques can be voided.`,
                );
            }

            const updated = await tx.supplierCheque.update({
                where: { Id: id },
                data: {
                    Status: 'VOIDED',
                    UpdatedByUserId: actorId,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'SUPPLIER_CHEQUE_VOIDED',
                    Entity: 'SupplierCheque',
                    EntityId: id,
                    Before: { Status: 'PENDING' },
                    After: { Status: 'VOIDED' },
                    Metadata: {
                        ChequeNumber: cheque.ChequeNumber,
                        Reason: dto.Reason,
                    },
                },
                tx,
            );

            return tx.supplierCheque.findUniqueOrThrow({
                where: { Id: id },
                include: CHEQUE_INCLUDE,
            });
        });
    }
}