import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {
    Customer,
    LoyaltyTransactionType,
    Prisma,
    Sale,
} from '@prisma/client';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AdjustPointsDto } from './dto/adjust-points.dto';
import { QueryLoyaltyTransactionDto } from './dto/query-loyalty-transaction.dto';

const ZERO = new Prisma.Decimal(0);

export interface LoyaltyTierConfig {
    Name: string;
    MinLifetime: number;
}

export interface LoyaltyConfig {
    Enabled: boolean;
    CurrencyPerPoint: number;
    RedeemRate: number;
    MinRedeem: number;
    MaxRedeemPercent: number;
    Tiers: LoyaltyTierConfig[];
}

export interface LoyaltyStatus {
    CustomerId: string;
    Code: string;
    Name: string;
    Points: number;
    LifetimeEarned: number;
    Tier: string;
    NextTier: string | null;
    PointsToNextTier: number | null;
    RedeemValue: string; // currency value of current points
}

export interface RedeemResult {
    Points: number;
    DiscountAmount: Prisma.Decimal;
    TransactionId: string;
}

export interface EarnResult {
    Points: number;
    TransactionId: string;
}

const DEFAULT_CONFIG: LoyaltyConfig = {
    Enabled: false,
    CurrencyPerPoint: 100,
    RedeemRate: 1,
    MinRedeem: 100,
    MaxRedeemPercent: 50,
    Tiers: [
        { Name: 'Bronze', MinLifetime: 0 },
        { Name: 'Silver', MinLifetime: 1000 },
        { Name: 'Gold', MinLifetime: 5000 },
        { Name: 'Platinum', MinLifetime: 20000 },
    ],
};

@Injectable()
export class LoyaltyService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    // ---------------------------------------------------------------
    // Config
    // ---------------------------------------------------------------

    async getConfig(): Promise<LoyaltyConfig> {
        const rows = await this.prisma.setting.findMany({
            where: { Key: { startsWith: 'Loyalty.' } },
        });
        const map = new Map(rows.map((r) => [r.Key, r.Value]));

        return {
            Enabled:
                (map.get('Loyalty.Enabled') as boolean) ??
                DEFAULT_CONFIG.Enabled,
            CurrencyPerPoint:
                Number(map.get('Loyalty.CurrencyPerPoint')) ||
                DEFAULT_CONFIG.CurrencyPerPoint,
            RedeemRate:
                Number(map.get('Loyalty.RedeemRate')) ||
                DEFAULT_CONFIG.RedeemRate,
            MinRedeem:
                Number(map.get('Loyalty.MinRedeem')) ||
                DEFAULT_CONFIG.MinRedeem,
            MaxRedeemPercent:
                Number(map.get('Loyalty.MaxRedeemPercent')) ||
                DEFAULT_CONFIG.MaxRedeemPercent,
            Tiers: this.parseTiers(map.get('Loyalty.Tiers')),
        };
    }

    /**
     * Runtime-validate the Tiers setting (stored as untyped JSON).
     * Falls back to DEFAULT_CONFIG.Tiers if anything is malformed.
     */
    private parseTiers(value: unknown): LoyaltyTierConfig[] {
        if (!Array.isArray(value) || value.length === 0) {
            return DEFAULT_CONFIG.Tiers;
        }

        const parsed: LoyaltyTierConfig[] = [];
        for (const entry of value) {
            if (
                entry !== null &&
                typeof entry === 'object' &&
                typeof (entry as { Name?: unknown }).Name === 'string' &&
                typeof (entry as { MinLifetime?: unknown }).MinLifetime ===
                'number'
            ) {
                const e = entry as { Name: string; MinLifetime: number };
                parsed.push({ Name: e.Name, MinLifetime: e.MinLifetime });
            }
        }

        return parsed.length > 0 ? parsed : DEFAULT_CONFIG.Tiers;
    }

    // ---------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------

    async getStatus(customerId: string): Promise<LoyaltyStatus> {
        const customer = await this.prisma.customer.findFirst({
            where: { Id: customerId, DeletedAt: null },
            select: {
                Id: true,
                Code: true,
                Name: true,
                LoyaltyPoints: true,
                LoyaltyTier: true,
                LifetimeEarned: true,
            },
        });
        if (!customer) throw new NotFoundException('Customer not found');

        const config = await this.getConfig();
        const tierInfo = this.computeTier(customer.LifetimeEarned, config.Tiers);
        const redeemValue = new Prisma.Decimal(customer.LoyaltyPoints).mul(
            config.RedeemRate,
        );

        return {
            CustomerId: customer.Id,
            Code: customer.Code,
            Name: customer.Name,
            Points: customer.LoyaltyPoints,
            LifetimeEarned: customer.LifetimeEarned,
            Tier: tierInfo.current,
            NextTier: tierInfo.next,
            PointsToNextTier: tierInfo.pointsToNext,
            RedeemValue: redeemValue.toString(),
        };
    }

    async getLedger(
        query: QueryLoyaltyTransactionDto,
    ): Promise<PaginatedResponse<unknown>> {
        const where: Prisma.LoyaltyTransactionWhereInput = {};

        if (query.CustomerId) where.CustomerId = query.CustomerId;
        if (query.Type) where.Type = query.Type;

        if (query.From || query.To) {
            where.CreatedAt = {};
            if (query.From) where.CreatedAt.gte = new Date(query.From);
            if (query.To) where.CreatedAt.lte = new Date(query.To);
        }

        const orderBy: Prisma.LoyaltyTransactionOrderByWithRelationInput = {
            [query.sortBy ?? 'CreatedAt']: query.sortOrder,
        };

        return paginate(
            this.prisma.loyaltyTransaction,
            {
                where,
                orderBy,
                include: {
                    Customer: { select: { Id: true, Name: true, Code: true } },
                },
            },
            query.page,
            query.limit,
        );
    }

    // ---------------------------------------------------------------
    // Redeem (called during sale checkout, inside caller's tx)
    // ---------------------------------------------------------------

    /**
     * Validate and apply a redemption. Assumes the caller has already
     * computed the resulting discount and included it in the sale's
     * LoyaltyDiscountAmount.
     *
     * Returns the transaction id so the caller can write it on the sale
     * (or a follow-up reverse).
     */
    async redeem(
        tx: Prisma.TransactionClient,
        input: {
            CustomerId: string;
            SaleId: string;
            Points: number;
            GrossTotal: Prisma.Decimal; // total BEFORE the loyalty discount
            ActorId: string;
            Config: LoyaltyConfig;
        },
    ): Promise<RedeemResult> {
        const { CustomerId, SaleId, Points, GrossTotal, ActorId, Config } = input;

        if (Points <= 0) {
            throw new BadRequestException('Redeem points must be positive');
        }
        if (Points < Config.MinRedeem) {
            throw new BadRequestException(
                `Minimum redemption is ${Config.MinRedeem} points`,
            );
        }

        const customer = await tx.customer.findFirst({
            where: { Id: CustomerId, DeletedAt: null },
            select: { LoyaltyPoints: true, IsActive: true, Name: true },
        });
        if (!customer) throw new NotFoundException('Customer not found');
        if (!customer.IsActive) {
            throw new BadRequestException(
                `Customer "${customer.Name}" is inactive`,
            );
        }

        if (Points > customer.LoyaltyPoints) {
            throw new BadRequestException(
                `Cannot redeem ${Points} points — customer only has ${customer.LoyaltyPoints}.`,
            );
        }

        const discount = new Prisma.Decimal(Points)
            .mul(Config.RedeemRate)
            .toDecimalPlaces(4);

        const maxDiscount = GrossTotal
            .mul(Config.MaxRedeemPercent)
            .div(100)
            .toDecimalPlaces(4);

        if (discount.greaterThan(maxDiscount)) {
            throw new BadRequestException(
                `Discount ${discount.toString()} exceeds the ${Config.MaxRedeemPercent}% cap (${maxDiscount.toString()}).`,
            );
        }

        const newBalance = customer.LoyaltyPoints - Points;

        const txn = await tx.loyaltyTransaction.create({
            data: {
                CustomerId,
                Type: 'REDEEM',
                Points: -Points,
                PointsAfter: newBalance,
                SaleId,
                Notes: `Redeemed ${Points} points (${discount.toString()} value)`,
                CreatedByUserId: ActorId,
            },
        });

        await tx.customer.update({
            where: { Id: CustomerId },
            data: { LoyaltyPoints: newBalance },
        });

        return {
            Points,
            DiscountAmount: discount,
            TransactionId: txn.Id,
        };
    }

    // ---------------------------------------------------------------
    // Earn (called after sale creation, same tx)
    // ---------------------------------------------------------------

    async earn(
        tx: Prisma.TransactionClient,
        input: {
            CustomerId: string;
            SaleId: string;
            Amount: Prisma.Decimal; // total actually paid
            ActorId: string;
            Config: LoyaltyConfig;
        },
    ): Promise<EarnResult | null> {
        const { CustomerId, SaleId, Amount, ActorId, Config } = input;

        if (Config.CurrencyPerPoint <= 0) return null;
        if (Amount.lte(0)) return null;

        const points = Math.floor(
            Amount.div(Config.CurrencyPerPoint).toNumber(),
        );
        if (points <= 0) return null;

        const customer = await tx.customer.findUniqueOrThrow({
            where: { Id: CustomerId },
            select: { LoyaltyPoints: true, LifetimeEarned: true },
        });

        const newBalance = customer.LoyaltyPoints + points;
        const newLifetime = customer.LifetimeEarned + points;
        const newTier = this.computeTier(newLifetime, Config.Tiers).current;

        const txn = await tx.loyaltyTransaction.create({
            data: {
                CustomerId,
                Type: 'EARN',
                Points: points,
                PointsAfter: newBalance,
                SaleId,
                Notes: `Earned ${points} points on sale`,
                CreatedByUserId: ActorId,
            },
        });

        await tx.customer.update({
            where: { Id: CustomerId },
            data: {
                LoyaltyPoints: newBalance,
                LifetimeEarned: newLifetime,
                LoyaltyTier: newTier,
            },
        });

        return { Points: points, TransactionId: txn.Id };
    }

    // ---------------------------------------------------------------
    // Reverse on cancel
    // ---------------------------------------------------------------

    /**
     * Full reversal — used when a sale is cancelled.
     *  - Earned points clawed back
     *  - Redeemed points restored
     * The sale row is NOT updated here — the caller (SalesService.cancel)
     * sets LoyaltyReversedPoints = LoyaltyEarnedPoints and passes it through.
     */
    async reverseForCancel(
        tx: Prisma.TransactionClient,
        input: {
            Sale: Pick<
                Sale,
                | 'Id'
                | 'CustomerId'
                | 'InvoiceNumber'
                | 'LoyaltyEarnedPoints'
                | 'LoyaltyRedeemedPoints'
            >;
            ActorId: string;
            Reason: string;
        },
    ): Promise<void> {
        const { Sale, ActorId, Reason } = input;
        if (!Sale.CustomerId) return;

        const customer = await tx.customer.findUniqueOrThrow({
            where: { Id: Sale.CustomerId },
            select: { LoyaltyPoints: true, LifetimeEarned: true },
        });

        let balance = customer.LoyaltyPoints;
        let lifetime = customer.LifetimeEarned;

        // Reverse earned points
        if (Sale.LoyaltyEarnedPoints > 0) {
            balance -= Sale.LoyaltyEarnedPoints;
            lifetime = Math.max(0, lifetime - Sale.LoyaltyEarnedPoints);

            await tx.loyaltyTransaction.create({
                data: {
                    CustomerId: Sale.CustomerId,
                    Type: 'REVERSAL',
                    Points: -Sale.LoyaltyEarnedPoints,
                    PointsAfter: balance,
                    SaleId: Sale.Id,
                    Notes: `Reversed earn — sale ${Sale.InvoiceNumber} cancelled: ${Reason}`,
                    CreatedByUserId: ActorId,
                },
            });
        }

        // Restore redeemed points
        if (Sale.LoyaltyRedeemedPoints > 0) {
            balance += Sale.LoyaltyRedeemedPoints;

            await tx.loyaltyTransaction.create({
                data: {
                    CustomerId: Sale.CustomerId,
                    Type: 'REVERSAL',
                    Points: Sale.LoyaltyRedeemedPoints,
                    PointsAfter: balance,
                    SaleId: Sale.Id,
                    Notes: `Restored redemption — sale ${Sale.InvoiceNumber} cancelled: ${Reason}`,
                    CreatedByUserId: ActorId,
                },
            });
        }

        if (
            Sale.LoyaltyEarnedPoints > 0 ||
            Sale.LoyaltyRedeemedPoints > 0
        ) {
            const config = await this.getConfig();
            const newTier = this.computeTier(lifetime, config.Tiers).current;
            await tx.customer.update({
                where: { Id: Sale.CustomerId },
                data: {
                    LoyaltyPoints: balance,
                    LifetimeEarned: lifetime,
                    LoyaltyTier: newTier,
                },
            });
        }
    }

    // ---------------------------------------------------------------
    // Reverse on return (proportional clawback of earned points)
    // ---------------------------------------------------------------

    /**
     * Reverse a portion of the earned points on the sale.
     *
     * Called on every SaleReturn. Uses cumulative RefundedAmount to
     * compute how much of the original earn should have been reversed
     * by now, and adjusts by the delta vs. what was already reversed
     * (Sale.LoyaltyReversedPoints).
     *
     * Returns the delta reversed so the caller can bump the sale's
     * LoyaltyReversedPoints counter.
     */
    async reverseForReturn(
        tx: Prisma.TransactionClient,
        input: {
            Sale: Pick<
                Sale,
                | 'Id'
                | 'CustomerId'
                | 'InvoiceNumber'
                | 'TotalAmount'
                | 'LoyaltyEarnedPoints'
                | 'LoyaltyReversedPoints'
            >;
            SaleReturnId: string;
            ReturnCode: string;
            RefundAmount: Prisma.Decimal;
            NewTotalRefunded: Prisma.Decimal; // sale.RefundedAmount + this refund
            ActorId: string;
        },
    ): Promise<number> {
        const {
            Sale,
            SaleReturnId,
            ReturnCode,
            NewTotalRefunded,
            ActorId,
        } = input;

        if (!Sale.CustomerId) return 0;
        if (Sale.LoyaltyEarnedPoints <= 0) return 0;

        const total = new Prisma.Decimal(Sale.TotalAmount);
        if (total.lte(0)) return 0;

        // How many of the original earned points SHOULD be reversed by now?
        let shouldBeReversed: number;
        if (NewTotalRefunded.gte(total)) {
            // Fully returned — reverse the rest
            shouldBeReversed = Sale.LoyaltyEarnedPoints;
        } else {
            shouldBeReversed = Math.floor(
                (Sale.LoyaltyEarnedPoints *
                    NewTotalRefunded.toNumber()) /
                total.toNumber(),
            );
        }

        const delta = shouldBeReversed - Sale.LoyaltyReversedPoints;
        if (delta <= 0) return 0;

        const customer = await tx.customer.findUniqueOrThrow({
            where: { Id: Sale.CustomerId },
            select: { LoyaltyPoints: true, LifetimeEarned: true },
        });

        // Clamp so we never go below zero
        const actualDelta = Math.min(delta, customer.LoyaltyPoints);
        if (actualDelta <= 0) return 0;

        const newBalance = customer.LoyaltyPoints - actualDelta;
        const newLifetime = Math.max(0, customer.LifetimeEarned - actualDelta);

        await tx.loyaltyTransaction.create({
            data: {
                CustomerId: Sale.CustomerId,
                Type: 'REVERSAL',
                Points: -actualDelta,
                PointsAfter: newBalance,
                SaleId: Sale.Id,
                SaleReturnId,
                Notes: `Reversed earn — return ${ReturnCode} on sale ${Sale.InvoiceNumber}`,
                CreatedByUserId: ActorId,
            },
        });

        const config = await this.getConfig();
        const newTier = this.computeTier(newLifetime, config.Tiers).current;

        await tx.customer.update({
            where: { Id: Sale.CustomerId },
            data: {
                LoyaltyPoints: newBalance,
                LifetimeEarned: newLifetime,
                LoyaltyTier: newTier,
            },
        });

        return actualDelta;
    }

    // ---------------------------------------------------------------
    // Manual admin adjust
    // ---------------------------------------------------------------

    async adjust(
        customerId: string,
        dto: AdjustPointsDto,
        actorId: string,
    ): Promise<LoyaltyStatus> {
        return this.prisma.$transaction(async (tx) => {
            const customer = await tx.customer.findFirst({
                where: { Id: customerId, DeletedAt: null },
                select: { LoyaltyPoints: true, LifetimeEarned: true, Name: true },
            });
            if (!customer) throw new NotFoundException('Customer not found');

            const newBalance = customer.LoyaltyPoints + dto.Points;
            if (newBalance < 0) {
                throw new BadRequestException(
                    `Adjustment would drop balance below zero (current: ${customer.LoyaltyPoints}, delta: ${dto.Points}).`,
                );
            }

            // Positive adjusts count toward lifetime; negative don't reduce it below 0
            const newLifetime =
                dto.Points > 0
                    ? customer.LifetimeEarned + dto.Points
                    : Math.max(0, customer.LifetimeEarned + dto.Points);

            const config = await this.getConfig();
            const newTier = this.computeTier(newLifetime, config.Tiers).current;

            await tx.loyaltyTransaction.create({
                data: {
                    CustomerId: customerId,
                    Type: 'ADJUST',
                    Points: dto.Points,
                    PointsAfter: newBalance,
                    Notes: `Manual adjustment: ${dto.Reason}`,
                    CreatedByUserId: actorId,
                },
            });

            await tx.customer.update({
                where: { Id: customerId },
                data: {
                    LoyaltyPoints: newBalance,
                    LifetimeEarned: newLifetime,
                    LoyaltyTier: newTier,
                },
            });

            await this.audit.log(
                {
                    UserId: actorId,
                    Action: 'LOYALTY_POINTS_ADJUSTED',
                    Entity: 'Customer',
                    EntityId: customerId,
                    Before: { LoyaltyPoints: customer.LoyaltyPoints },
                    After: { LoyaltyPoints: newBalance },
                    Metadata: {
                        Delta: dto.Points,
                        Reason: dto.Reason,
                    },
                },
                tx,
            );

            // Return fresh status
            const updated = await tx.customer.findUniqueOrThrow({
                where: { Id: customerId },
                select: {
                    Id: true,
                    Code: true,
                    Name: true,
                    LoyaltyPoints: true,
                    LoyaltyTier: true,
                    LifetimeEarned: true,
                },
            });

            const tierInfo = this.computeTier(
                updated.LifetimeEarned,
                config.Tiers,
            );
            const redeemValue = new Prisma.Decimal(updated.LoyaltyPoints).mul(
                config.RedeemRate,
            );

            return {
                CustomerId: updated.Id,
                Code: updated.Code,
                Name: updated.Name,
                Points: updated.LoyaltyPoints,
                LifetimeEarned: updated.LifetimeEarned,
                Tier: tierInfo.current,
                NextTier: tierInfo.next,
                PointsToNextTier: tierInfo.pointsToNext,
                RedeemValue: redeemValue.toString(),
            };
        });
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    /**
     * Given lifetime earned points, return current tier + next tier + points to next.
     * Tiers sorted ascending by MinLifetime.
     */
    private computeTier(
        lifetime: number,
        tiers: LoyaltyTierConfig[],
    ): { current: string; next: string | null; pointsToNext: number | null } {
        const sorted = [...tiers].sort((a, b) => a.MinLifetime - b.MinLifetime);
        if (sorted.length === 0) {
            return { current: 'Standard', next: null, pointsToNext: null };
        }

        let current = sorted[0].Name;
        let next: LoyaltyTierConfig | null = null;

        for (let i = 0; i < sorted.length; i++) {
            if (lifetime >= sorted[i].MinLifetime) {
                current = sorted[i].Name;
            } else {
                next = sorted[i];
                break;
            }
        }

        return {
            current,
            next: next?.Name ?? null,
            pointsToNext:
                next !== null ? next.MinLifetime - lifetime : null,
        };
    }
}