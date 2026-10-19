import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
    SalesSummaryGroup,
    SalesSummaryQueryDto,
} from './dto/sales-summary.dto';
import { ZReportQueryDto } from './dto/z-report.dto';
import {
    ProfitGroup,
    ProfitReportQueryDto,
} from './dto/profit-report.dto';
import { StockValuationQueryDto } from './dto/stock-valuation.dto';
import { InventoryMovementQueryDto } from './dto/inventory-movement.dto';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/pagination.util';
import { StockMovementType } from '@prisma/client';
import { ArAgingQueryDto } from './dto/ar-aging.dto';
import { ChequeCalendarQueryDto } from './dto/cheque-calendar.dto';
import {
    CashFlowGroup,
    CashFlowQueryDto,
} from './dto/cash-flow.dto';


export interface ArAgingBucket {
    Current: string;   // 0-30 days
    Days31To60: string;
    Days61To90: string;
    Days91To180: string;
    DaysOver180: string;
}

export interface ArAgingRow {
    CustomerId: string;
    Code: string;
    Name: string;
    Phone: string | null;
    Balance: string;
    CreditLimit: string;
    AvailableCredit: string;
    LastCreditSaleDate: string | null;
    Buckets: ArAgingBucket;
}

export interface ArAgingReport {
    From: string;
    To: string;
    Rows: ArAgingRow[];
    Totals: ArAgingBucket & { Grand: string };
}

export interface ChequeCalendarEntry {
    Side: 'CUSTOMER' | 'SUPPLIER';
    ChequeId: string;
    Code: string;
    ChequeNumber: string;
    Amount: string;
    IssueDate: string;
    DueDate: string;
    CounterpartyId: string;
    CounterpartyName: string;
    CounterpartyCode: string;
    BankName: string | null;
    Notes: string | null;
}

export interface ChequeCalendarReport {
    From: string;
    To: string;
    CustomerTotal: string;
    SupplierTotal: string;
    NetExposure: string;
    Entries: ChequeCalendarEntry[];
    ByDay: {
        Day: string;
        CustomerAmount: string;
        SupplierAmount: string;
        Count: number;
    }[];
}

export interface CashFlowRow {
    Period: string;
    Opening: string;
    In: {
        Sale: string;
        CreditPayment: string;
        CashIn: string;
        ExpenseReversed: string;
        CreditPaymentReversed: string;
    };
    Out: {
        SaleRefund: string;
        CashOut: string;
        Expense: string;
    };
    NetChange: string;
    Closing: string;
    EntryCount: number;
}

export interface CashFlowReport {
    Group: CashFlowGroup;
    From: string;
    To: string;
    OpeningBalance: string;
    ClosingBalance: string;
    Rows: CashFlowRow[];
}

export interface SalesSummaryRow {
    Period: string | null;
    SaleCount: number;
    GrossSales: string;
    Discounts: string;
    TaxCollected: string;
    NetSales: string;
    CashTotal: string;
    CardTotal: string;
    CreditTotal: string;
    ChequeTotal: string;
    RefundTotal: string;
}

export interface ZReport {
    Date: string;
    Window: { From: string; To: string };
    Terminal: { Id: string; Name: string; Code: string } | null;
    Session: {
        Id: string;
        OpenedAt: string;
        ClosedAt: string | null;
        Status: string;
        StartingCash: string;
        ExpectedCash: string | null;
        CountedCash: string | null;
        Difference: string | null;
    } | null;

    Sales: {
        Count: number;
        GrossSales: string;
        Discounts: string;
        TaxCollected: string;
        NetSales: string;
        PaidAmount: string;
    };

    Payments: {
        Cash: string;
        Card: string;
        Credit: string;
        Cheque: string;
    };

    Returns: {
        Count: number;
        Total: string;
        CashRefunded: string;
        CreditIssued: string;
    };

    Cancels: {
        Count: number;
        Value: string;
    };

    CashFlow: {
        StartingCash: string | null;
        CashSales: string;
        CashCreditPayments: string;
        CashIn: string;
        CashOut: string;
        CashRefunds: string;
        CashExpenses: string;
        ExpectedDrawer: string;
    };

    TopProducts: {
        ProductId: string;
        Name: string;
        SKU: string | null;
        QtySold: number;
        Revenue: string;
    }[];
}

export interface ProfitReportRow {
    ProductId: string | null;
    Name: string;
    SKU: string | null;
    CategoryName: string | null;
    QtySold: number;
    NetRevenue: string;
    TaxCollected: string;
    COGS: string;
    GrossProfit: string;
    MarginPct: string;
}

export interface ProfitReportTotals {
    QtySold: number;
    NetRevenue: string;
    TaxCollected: string;
    COGS: string;
    GrossProfit: string;
    MarginPct: string;
}

export interface StockValuationRow {
    ProductId: string;
    Name: string;
    SKU: string | null;
    Barcode: string | null;
    CategoryName: string;
    SellingPrice: string;
    CostPrice: string;
    ReorderLevel: number;
    Qty: number;
    CostValue: string;
    RetailValue: string;
}

export interface InventoryMovementRow {
    Id: string;
    ProductId: string;
    WarehouseId: string;
    Type: StockMovementType;
    Quantity: number;
    UnitCost: string | null;
    Notes: string | null;
    SaleId: string | null;
    SaleReturnId: string | null;
    PurchaseId: string | null;
    CreatedAt: Date;
    CreatedByUserId: string | null;
    Product: { Id: string; Name: string; SKU: string | null };
    Warehouse: { Id: string; Name: string; Code: string };
}

const DEFAULTS = {
    /** Local-time start-of-day. */
    startOfDay(d: Date): Date {
        const x = new Date(d);
        x.setHours(0, 0, 0, 0);
        return x;
    },
    /** Local-time end-of-day. */
    endOfDay(d: Date): Date {
        const x = new Date(d);
        x.setHours(23, 59, 59, 999);
        return x;
    },
};

@Injectable()
export class ReportsService {
    constructor(private readonly prisma: PrismaService) { }

    // ---------------------------------------------------------------
    // Sales summary — time-bucketed aggregates
    // ---------------------------------------------------------------

    async salesSummary(query: SalesSummaryQueryDto): Promise<{
        Group: SalesSummaryGroup;
        From: string;
        To: string;
        Rows: SalesSummaryRow[];
    }> {
        const { from, to } = this.resolveRange(query.From, query.To);
        const group: SalesSummaryGroup = query.GroupBy ?? 'day';

        const terminalFilter = query.TerminalId
            ? Prisma.sql`AND "TerminalId" = ${query.TerminalId}::uuid`
            : Prisma.empty;
        const cashierFilter = query.CashierId
            ? Prisma.sql`AND "CashierId" = ${query.CashierId}::uuid`
            : Prisma.empty;

        if (group === 'none') {
            const rows = await this.prisma.$queryRaw<SalesSummaryRow[]>`
                SELECT
                    NULL::text                                AS "Period",
                    COUNT(*)::int                             AS "SaleCount",
                    COALESCE(SUM("Subtotal"), 0)::text        AS "GrossSales",
                    COALESCE(SUM("DiscountAmount"), 0)::text  AS "Discounts",
                    COALESCE(SUM("TaxAmount"), 0)::text       AS "TaxCollected",
                    COALESCE(SUM("TotalAmount"), 0)::text     AS "NetSales",
                    COALESCE(SUM("CashAmount"), 0)::text      AS "CashTotal",
                    COALESCE(SUM("CardAmount"), 0)::text      AS "CardTotal",
                    COALESCE(SUM("CreditAmount"), 0)::text    AS "CreditTotal",
                    COALESCE(SUM("ChequeAmount"), 0)::text    AS "ChequeTotal",
                    COALESCE(SUM("RefundedAmount"), 0)::text  AS "RefundTotal"
                FROM "Sales"
                WHERE "DeletedAt" IS NULL
                  AND "Status" <> 'CANCELLED'
                  AND "CreatedAt" >= ${from}
                  AND "CreatedAt" <= ${to}
                  ${terminalFilter}
                  ${cashierFilter}
            `;
            return { Group: group, From: from.toISOString(), To: to.toISOString(), Rows: rows };
        }

        const unit = group; // 'day' | 'week' | 'month'

        const rows = await this.prisma.$queryRaw<SalesSummaryRow[]>`
            WITH bucketed AS (
                SELECT
                    TO_CHAR(DATE_TRUNC(${unit}::text, "CreatedAt"), 'YYYY-MM-DD') AS "Period",
                    "Subtotal",
                    "DiscountAmount",
                    "TaxAmount",
                    "TotalAmount",
                    "CashAmount",
                    "CardAmount",
                    "CreditAmount",
                    "ChequeAmount",
                    "RefundedAmount"
                FROM "Sales"
                WHERE "DeletedAt" IS NULL
                  AND "Status" <> 'CANCELLED'
                  AND "CreatedAt" >= ${from}
                  AND "CreatedAt" <= ${to}
                  ${terminalFilter}
                  ${cashierFilter}
            )
            SELECT
                "Period",
                COUNT(*)::int                             AS "SaleCount",
                COALESCE(SUM("Subtotal"), 0)::text        AS "GrossSales",
                COALESCE(SUM("DiscountAmount"), 0)::text  AS "Discounts",
                COALESCE(SUM("TaxAmount"), 0)::text       AS "TaxCollected",
                COALESCE(SUM("TotalAmount"), 0)::text     AS "NetSales",
                COALESCE(SUM("CashAmount"), 0)::text      AS "CashTotal",
                COALESCE(SUM("CardAmount"), 0)::text      AS "CardTotal",
                COALESCE(SUM("CreditAmount"), 0)::text    AS "CreditTotal",
                COALESCE(SUM("ChequeAmount"), 0)::text    AS "ChequeTotal",
                COALESCE(SUM("RefundedAmount"), 0)::text  AS "RefundTotal"
            FROM bucketed
            GROUP BY "Period"
            ORDER BY "Period" ASC
        `;

        return { Group: group, From: from.toISOString(), To: to.toISOString(), Rows: rows };
    }
    // ---------------------------------------------------------------
    // Z-Report — day close summary
    // ---------------------------------------------------------------

    async zReport(query: ZReportQueryDto): Promise<ZReport> {
        // Resolve terminal + session context
        let terminalId = query.TerminalId ?? null;
        let session: {
            Id: string;
            TerminalId: string;
            OpenedAt: Date;
            ClosedAt: Date | null;
            Status: string;
            StartingCash: Prisma.Decimal;
            ExpectedCash: Prisma.Decimal | null;
            CountedCash: Prisma.Decimal | null;
            Difference: Prisma.Decimal | null;
        } | null = null;

        if (query.CashSessionId) {
            const s = await this.prisma.cashSession.findUnique({
                where: { Id: query.CashSessionId },
                select: {
                    Id: true,
                    TerminalId: true,
                    OpenedAt: true,
                    ClosedAt: true,
                    Status: true,
                    StartingCash: true,
                    ExpectedCash: true,
                    CountedCash: true,
                    Difference: true,
                },
            });
            if (!s) throw new NotFoundException('Cash session not found');
            session = s;
            terminalId = s.TerminalId;
        }

        // Window: if a session, use session window; otherwise local day of `Date`.
        const dateObj = new Date(query.Date);
        const from = session ? session.OpenedAt : DEFAULTS.startOfDay(dateObj);
        const to = session ? (session.ClosedAt ?? new Date()) : DEFAULTS.endOfDay(dateObj);

        const terminal = terminalId
            ? await this.prisma.terminal.findUnique({
                where: { Id: terminalId },
                select: { Id: true, Name: true, Code: true },
            })
            : null;

        const terminalFilter = terminalId
            ? Prisma.sql`AND "TerminalId" = ${terminalId}::uuid`
            : Prisma.empty;

        // ---- Sales aggregate ----
        const salesAgg = await this.prisma.sale.aggregate({
            where: {
                DeletedAt: null,
                Status: { not: 'CANCELLED' },
                CreatedAt: { gte: from, lte: to },
                ...(terminalId ? { TerminalId: terminalId } : {}),
            },
            _count: { _all: true },
            _sum: {
                Subtotal: true,
                DiscountAmount: true,
                TaxAmount: true,
                TotalAmount: true,
                PaidAmount: true,
                CashAmount: true,
                CardAmount: true,
                CreditAmount: true,
                ChequeAmount: true,
            },
        });

        // ---- Returns in window ----
        const returnsAgg = await this.prisma.saleReturn.aggregate({
            where: {
                CreatedAt: { gte: from, lte: to },
                ...(terminalId
                    ? { Sale: { TerminalId: terminalId } }
                    : {}),
            },
            _count: { _all: true },
            _sum: { RefundAmount: true },
        });

        const cashReturns = await this.prisma.saleReturn.aggregate({
            where: {
                CreatedAt: { gte: from, lte: to },
                RefundMethod: 'CASH',
                ...(terminalId
                    ? { Sale: { TerminalId: terminalId } }
                    : {}),
            },
            _sum: { RefundAmount: true },
        });

        const creditReturns = await this.prisma.saleReturn.aggregate({
            where: {
                CreatedAt: { gte: from, lte: to },
                RefundMethod: 'CREDIT',
                ...(terminalId
                    ? { Sale: { TerminalId: terminalId } }
                    : {}),
            },
            _sum: { RefundAmount: true },
        });

        // ---- Cancels in window ----
        const cancelsAgg = await this.prisma.sale.aggregate({
            where: {
                Status: 'CANCELLED',
                DeletedAt: null,
                CancelledAt: { gte: from, lte: to },
                ...(terminalId ? { TerminalId: terminalId } : {}),
            },
            _count: { _all: true },
            _sum: { TotalAmount: true },
        });

        // ---- Cash ledger grouped by type ----
        type LedgerRow = { Type: string; Sum: string | null };
        const ledgerRows = await this.prisma.$queryRaw<LedgerRow[]>`
            SELECT "Type"::text AS "Type", SUM("Amount")::text AS "Sum"
            FROM "CashLedgers"
            WHERE "CreatedAt" >= ${from}
              AND "CreatedAt" <= ${to}
              AND "CashSessionId" IS NULL
              ${terminalId ? Prisma.sql`AND "CashSessionId" IS NULL` : Prisma.empty}
            GROUP BY "Type"
        `;

        // If a session is specified, prefer its ledger.
        const ledgerByType = new Map<string, Prisma.Decimal>();
        if (session) {
            const sessLedger = await this.prisma.cashLedger.groupBy({
                by: ['Type'],
                where: { CashSessionId: session.Id },
                _sum: { Amount: true },
            });
            for (const r of sessLedger) {
                ledgerByType.set(r.Type, new Prisma.Decimal(r._sum.Amount ?? 0));
            }
        } else {
            for (const r of ledgerRows) {
                ledgerByType.set(r.Type, new Prisma.Decimal(r.Sum ?? '0'));
            }
        }

        const g = (t: string) => ledgerByType.get(t) ?? new Prisma.Decimal(0);

        const cashSales = g('SALE');
        const cashCreditPayments = g('CREDIT_PAYMENT');
        const cashIn = g('CASH_IN');
        const cashOut = g('CASH_OUT');
        const cashRefunds = g('SALE_REFUND'); // negative
        const cashExpenses = g('EXPENSE'); // negative

        const startingCash = session
            ? new Prisma.Decimal(session.StartingCash)
            : null;

        const expectedDrawer =
            (startingCash ?? new Prisma.Decimal(0))
                .add(cashSales)
                .add(cashCreditPayments)
                .add(cashIn)
                .add(cashOut)
                .add(cashRefunds)
                .add(cashExpenses);

        // ---- Top products ----
        type TopRow = {
            ProductId: string;
            Name: string;
            SKU: string | null;
            QtySold: number;
            Revenue: string;
        };
        const topProducts = await this.prisma.$queryRaw<TopRow[]>`
            SELECT
                p."Id" AS "ProductId",
                p."Name" AS "Name",
                p."SKU" AS "SKU",
                SUM(si."Qty")::int AS "QtySold",
                SUM(si."LineTotal")::text AS "Revenue"
            FROM "SaleItems" si
            JOIN "Sales" s ON s."Id" = si."SaleId"
            JOIN "Products" p ON p."Id" = si."ProductId"
            WHERE s."DeletedAt" IS NULL
              AND s."Status" <> 'CANCELLED'
              AND s."CreatedAt" >= ${from}
              AND s."CreatedAt" <= ${to}
              ${terminalFilter ? Prisma.sql`AND s."TerminalId" = ${terminalId}::uuid` : Prisma.empty}
            GROUP BY p."Id", p."Name", p."SKU"
            ORDER BY SUM(si."Qty") DESC
            LIMIT 10
        `;

        return {
            Date: query.Date,
            Window: { From: from.toISOString(), To: to.toISOString() },
            Terminal: terminal
                ? { Id: terminal.Id, Name: terminal.Name, Code: terminal.Code }
                : null,
            Session: session
                ? {
                    Id: session.Id,
                    OpenedAt: session.OpenedAt.toISOString(),
                    ClosedAt: session.ClosedAt
                        ? session.ClosedAt.toISOString()
                        : null,
                    Status: session.Status,
                    StartingCash: session.StartingCash.toString(),
                    ExpectedCash: session.ExpectedCash
                        ? session.ExpectedCash.toString()
                        : null,
                    CountedCash: session.CountedCash
                        ? session.CountedCash.toString()
                        : null,
                    Difference: session.Difference
                        ? session.Difference.toString()
                        : null,
                }
                : null,

            Sales: {
                Count: salesAgg._count._all,
                GrossSales: (salesAgg._sum.Subtotal ?? new Prisma.Decimal(0)).toString(),
                Discounts: (salesAgg._sum.DiscountAmount ?? new Prisma.Decimal(0)).toString(),
                TaxCollected: (salesAgg._sum.TaxAmount ?? new Prisma.Decimal(0)).toString(),
                NetSales: (salesAgg._sum.TotalAmount ?? new Prisma.Decimal(0)).toString(),
                PaidAmount: (salesAgg._sum.PaidAmount ?? new Prisma.Decimal(0)).toString(),
            },

            Payments: {
                Cash: (salesAgg._sum.CashAmount ?? new Prisma.Decimal(0)).toString(),
                Card: (salesAgg._sum.CardAmount ?? new Prisma.Decimal(0)).toString(),
                Credit: (salesAgg._sum.CreditAmount ?? new Prisma.Decimal(0)).toString(),
                Cheque: (salesAgg._sum.ChequeAmount ?? new Prisma.Decimal(0)).toString(),
            },

            Returns: {
                Count: returnsAgg._count._all,
                Total: (returnsAgg._sum.RefundAmount ?? new Prisma.Decimal(0)).toString(),
                CashRefunded: (cashReturns._sum.RefundAmount ?? new Prisma.Decimal(0)).toString(),
                CreditIssued: (creditReturns._sum.RefundAmount ?? new Prisma.Decimal(0)).toString(),
            },

            Cancels: {
                Count: cancelsAgg._count._all,
                Value: (cancelsAgg._sum.TotalAmount ?? new Prisma.Decimal(0)).toString(),
            },

            CashFlow: {
                StartingCash: startingCash ? startingCash.toString() : null,
                CashSales: cashSales.toString(),
                CashCreditPayments: cashCreditPayments.toString(),
                CashIn: cashIn.toString(),
                CashOut: cashOut.toString(),
                CashRefunds: cashRefunds.toString(),
                CashExpenses: cashExpenses.toString(),
                ExpectedDrawer: expectedDrawer.toString(),
            },

            TopProducts: topProducts,
        };
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    private resolveRange(
        fromStr?: string,
        toStr?: string,
    ): { from: Date; to: Date } {
        const now = new Date();
        const from = fromStr ? new Date(fromStr) : DEFAULTS.startOfDay(now);
        const to = toStr ? new Date(toStr) : DEFAULTS.endOfDay(now);
        return { from, to };
    }



    async profitReport(query: ProfitReportQueryDto): Promise<{
        Group: ProfitGroup;
        From: string;
        To: string;
        Rows: ProfitReportRow[];
        Total: ProfitReportTotals;
    }> {
        const { from, to } = this.resolveRange(query.From, query.To);
        const group: ProfitGroup = query.GroupBy ?? 'none';

        const terminalFilter = query.TerminalId
            ? Prisma.sql`AND s."TerminalId" = ${query.TerminalId}::uuid`
            : Prisma.empty;
        const categoryFilter = query.CategoryId
            ? Prisma.sql`AND p."CategoryId" = ${query.CategoryId}::uuid`
            : Prisma.empty;
        const productFilter = query.ProductId
            ? Prisma.sql`AND p."Id" = ${query.ProductId}::uuid`
            : Prisma.empty;

        if (group === 'none') {
            const rows = await this.prisma.$queryRaw<ProfitReportRow[]>`
                SELECT
                    p."Id"                                       AS "ProductId",
                    p."Name"                                     AS "Name",
                    p."SKU"                                      AS "SKU",
                    c."Name"                                     AS "CategoryName",
                    SUM(si."Qty")::int                           AS "QtySold",
                    SUM(si."LineSubtotal" - si."LineDiscount")::text AS "NetRevenue",
                    SUM(si."LineTax")::text                      AS "TaxCollected",
                    SUM(si."Qty" * p."CostPrice")::text          AS "COGS",
                    SUM(si."LineSubtotal" - si."LineDiscount" - (si."Qty" * p."CostPrice"))::text AS "GrossProfit",
                    CASE
                        WHEN SUM(si."LineSubtotal" - si."LineDiscount") > 0
                        THEN ROUND(
                            (SUM(si."LineSubtotal" - si."LineDiscount" - (si."Qty" * p."CostPrice"))
                             / SUM(si."LineSubtotal" - si."LineDiscount") * 100)::numeric,
                            2
                        )::text
                        ELSE '0.00'
                    END                                          AS "MarginPct"
                FROM "SaleItems" si
                JOIN "Sales" s ON s."Id" = si."SaleId"
                JOIN "Products" p ON p."Id" = si."ProductId"
                JOIN "Categories" c ON c."Id" = p."CategoryId"
                WHERE s."DeletedAt" IS NULL
                  AND s."Status" <> 'CANCELLED'
                  AND s."CreatedAt" >= ${from}
                  AND s."CreatedAt" <= ${to}
                  ${terminalFilter}
                  ${categoryFilter}
                  ${productFilter}
                GROUP BY p."Id", p."Name", p."SKU", c."Name"
                ORDER BY SUM(si."LineSubtotal" - si."LineDiscount" - (si."Qty" * p."CostPrice")) DESC
            `;

            const total = this.sumProfitRows(rows);
            return {
                Group: group,
                From: from.toISOString(),
                To: to.toISOString(),
                Rows: rows,
                Total: total,
            };
        }

        const unit = group; // 'day' | 'week' | 'month'

        const rows = await this.prisma.$queryRaw<ProfitReportRow[]>`
            WITH joined AS (
                SELECT
                    TO_CHAR(DATE_TRUNC(${unit}::text, s."CreatedAt"), 'YYYY-MM-DD') AS "Bucket",
                    si."Qty"             AS "Qty",
                    si."LineSubtotal"    AS "LineSubtotal",
                    si."LineDiscount"    AS "LineDiscount",
                    si."LineTax"         AS "LineTax",
                    p."CostPrice"        AS "CostPrice"
                FROM "SaleItems" si
                JOIN "Sales" s ON s."Id" = si."SaleId"
                JOIN "Products" p ON p."Id" = si."ProductId"
                WHERE s."DeletedAt" IS NULL
                  AND s."Status" <> 'CANCELLED'
                  AND s."CreatedAt" >= ${from}
                  AND s."CreatedAt" <= ${to}
                  ${terminalFilter}
                  ${categoryFilter}
                  ${productFilter}
            )
            SELECT
                NULL::uuid                                   AS "ProductId",
                "Bucket"                                     AS "Name",
                NULL::text                                   AS "SKU",
                NULL::text                                   AS "CategoryName",
                SUM("Qty")::int                              AS "QtySold",
                SUM("LineSubtotal" - "LineDiscount")::text   AS "NetRevenue",
                SUM("LineTax")::text                         AS "TaxCollected",
                SUM("Qty" * "CostPrice")::text               AS "COGS",
                SUM("LineSubtotal" - "LineDiscount" - ("Qty" * "CostPrice"))::text AS "GrossProfit",
                CASE
                    WHEN SUM("LineSubtotal" - "LineDiscount") > 0
                    THEN ROUND(
                        (SUM("LineSubtotal" - "LineDiscount" - ("Qty" * "CostPrice"))
                         / SUM("LineSubtotal" - "LineDiscount") * 100)::numeric,
                        2
                    )::text
                    ELSE '0.00'
                END                                          AS "MarginPct"
            FROM joined
            GROUP BY "Bucket"
            ORDER BY "Bucket" ASC
        `;

        return {
            Group: group,
            From: from.toISOString(),
            To: to.toISOString(),
            Rows: rows,
            Total: this.sumProfitRows(rows),
        };
    }
    // ---------------------------------------------------------------
    // Stock valuation — current qty × current cost
    // ---------------------------------------------------------------

    async stockValuation(query: StockValuationQueryDto): Promise<{
        Rows: PaginatedResponse<StockValuationRow>['data'];
        Meta: PaginatedResponse<StockValuationRow>['meta'];
        TotalRetail: string;
        TotalCost: string;
    }> {
        const warehouseFilter = query.WarehouseId
            ? Prisma.sql`AND ws."WarehouseId" = ${query.WarehouseId}::uuid`
            : Prisma.empty;
        const categoryFilter = query.CategoryId
            ? Prisma.sql`AND p."CategoryId" = ${query.CategoryId}::uuid`
            : Prisma.empty;
        const inStockFilter = query.InStockOnly
            ? Prisma.sql`AND ws."Qty" > 0`
            : Prisma.empty;

        const sortCol = (() => {
            switch (query.sortBy ?? 'Value') {
                case 'Name':
                    return Prisma.sql`p."Name"`;
                case 'Qty':
                    return Prisma.sql`SUM(ws."Qty")`;
                case 'Value':
                default:
                    return Prisma.sql`SUM(ws."Qty" * p."CostPrice")`;
            }
        })();
        const sortDir =
            (query.sortOrder ?? 'desc') === 'asc'
                ? Prisma.sql`ASC`
                : Prisma.sql`DESC`;

        // We need the total count for pagination. Do it via COUNT(DISTINCT p.Id)
        // in a separate query using the same filters.
        const countRows = await this.prisma.$queryRaw<{ Count: bigint }[]>`
            SELECT COUNT(DISTINCT p."Id") AS "Count"
            FROM "Products" p
            JOIN "WarehouseStocks" ws ON ws."ProductId" = p."Id"
            WHERE p."DeletedAt" IS NULL
              ${warehouseFilter}
              ${categoryFilter}
              ${inStockFilter}
        `;
        const total = Number(countRows[0]?.Count ?? 0);

        const skip = (query.page - 1) * query.limit;

        const rows = await this.prisma.$queryRaw<StockValuationRow[]>`
            SELECT
                p."Id"                                   AS "ProductId",
                p."Name"                                 AS "Name",
                p."SKU"                                  AS "SKU",
                p."Barcode"                              AS "Barcode",
                c."Name"                                 AS "CategoryName",
                p."Price"::text                          AS "SellingPrice",
                p."CostPrice"::text                      AS "CostPrice",
                p."ReorderLevel"                         AS "ReorderLevel",
                SUM(ws."Qty")::int                       AS "Qty",
                SUM(ws."Qty" * p."CostPrice")::text      AS "CostValue",
                SUM(ws."Qty" * p."Price")::text          AS "RetailValue"
            FROM "Products" p
            JOIN "WarehouseStocks" ws ON ws."ProductId" = p."Id"
            JOIN "Categories" c ON c."Id" = p."CategoryId"
            WHERE p."DeletedAt" IS NULL
              ${warehouseFilter}
              ${categoryFilter}
              ${inStockFilter}
            GROUP BY p."Id", p."Name", p."SKU", p."Barcode", c."Name",
                     p."Price", p."CostPrice", p."ReorderLevel"
            ORDER BY ${sortCol} ${sortDir}
            LIMIT ${query.limit}
            OFFSET ${skip}
        `;

        // Totals across ALL filtered rows (not just current page).
        const totalsAgg = await this.prisma.$queryRaw<
            { TotalRetail: string; TotalCost: string }[]
        >`
            SELECT
                COALESCE(SUM(sub."Qty" * sub."Price"), 0)::text     AS "TotalRetail",
                COALESCE(SUM(sub."Qty" * sub."CostPrice"), 0)::text AS "TotalCost"
            FROM (
                SELECT
                    SUM(ws."Qty")::int  AS "Qty",
                    p."Price"           AS "Price",
                    p."CostPrice"       AS "CostPrice"
                FROM "Products" p
                JOIN "WarehouseStocks" ws ON ws."ProductId" = p."Id"
                WHERE p."DeletedAt" IS NULL
                  ${warehouseFilter}
                  ${categoryFilter}
                  ${inStockFilter}
                GROUP BY p."Id", p."Price", p."CostPrice"
            ) sub
        `;

        const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

        return {
            Rows: rows,
            Meta: {
                page: query.page,
                limit: query.limit,
                total,
                totalPages,
                hasNext: query.page < totalPages,
                hasPrev: query.page > 1,
            },
            TotalRetail: totalsAgg[0]?.TotalRetail ?? '0',
            TotalCost: totalsAgg[0]?.TotalCost ?? '0',
        };
    }

    // ---------------------------------------------------------------
    // Inventory movement — ledger view with filters
    // ---------------------------------------------------------------

    async inventoryMovement(
        query: InventoryMovementQueryDto,
    ): Promise<{
        Rows: InventoryMovementRow[];
        Meta: PaginatedResponse<InventoryMovementRow>['meta'];
        NetChange: string;
    }> {
        const where: Prisma.StockMovementWhereInput = {};

        if (query.ProductId) where.ProductId = query.ProductId;
        if (query.WarehouseId) where.WarehouseId = query.WarehouseId;
        if (query.Type) where.Type = query.Type;

        if (query.From || query.To) {
            where.CreatedAt = {};
            if (query.From) where.CreatedAt.gte = new Date(query.From);
            if (query.To) where.CreatedAt.lte = new Date(query.To);
        }

        const result = await paginate<InventoryMovementRow>(
            this.prisma.stockMovement,
            {
                where,
                orderBy: { CreatedAt: 'desc' },
                include: {
                    Product: { select: { Id: true, Name: true, SKU: true } },
                    Warehouse: { select: { Id: true, Name: true, Code: true } },
                },
            },
            query.page,
            query.limit,
        );

        // Net qty change across the filtered set (not just page).
        const agg = await this.prisma.stockMovement.aggregate({
            where,
            _sum: { Quantity: true },
        });

        return {
            Rows: result.data as InventoryMovementRow[],
            Meta: result.meta,
            NetChange: (agg._sum.Quantity ?? 0).toString(),
        };
    }

    // ---------------------------------------------------------------
    // Helpers for the new reports
    // ---------------------------------------------------------------

    private sumProfitRows(rows: ProfitReportRow[]): ProfitReportTotals {
        const zero = new Prisma.Decimal(0);
        const sum = (key: keyof ProfitReportRow) =>
            rows.reduce(
                (s, r) => s.add(new Prisma.Decimal((r[key] as string) ?? 0)),
                zero,
            );

        const netRevenue = sum('NetRevenue');
        const grossProfit = sum('GrossProfit');
        const marginPct = netRevenue.isZero()
            ? '0.00'
            : grossProfit.div(netRevenue).mul(100).toDecimalPlaces(2).toString();

        return {
            QtySold: rows.reduce((s, r) => s + r.QtySold, 0),
            NetRevenue: netRevenue.toString(),
            TaxCollected: sum('TaxCollected').toString(),
            COGS: sum('COGS').toString(),
            GrossProfit: grossProfit.toString(),
            MarginPct: marginPct,
        };
    }

    // ---------------------------------------------------------------
    // AR Aging
    // ---------------------------------------------------------------

    async arAging(query: ArAgingQueryDto): Promise<ArAgingReport> {
        const { from, to } = this.resolveRange(query.From, query.To);

        const customerWhere: Prisma.CustomerWhereInput = {
            DeletedAt: null,
        };
        if (query.CustomerId) customerWhere.Id = query.CustomerId;
        if (!query.IncludeZeroBalance) customerWhere.Balance = { gt: 0 };

        const customers = await this.prisma.customer.findMany({
            where: customerWhere,
            select: {
                Id: true,
                Code: true,
                Name: true,
                Phone: true,
                Balance: true,
                CreditLimit: true,
            },
            orderBy: { Balance: 'desc' },
        });

        if (customers.length === 0) {
            const empty: ArAgingBucket = {
                Current: '0',
                Days31To60: '0',
                Days61To90: '0',
                Days91To180: '0',
                DaysOver180: '0',
            };
            return {
                From: from.toISOString(),
                To: to.toISOString(),
                Rows: [],
                Totals: { ...empty, Grand: '0' },
            };
        }

        const customerIds = customers.map((c) => c.Id);

        // Fetch every credit sale for these customers, newest first.
        // Cap the lookback at 3 years — anything older isn't invoice-relevant
        // and would blow up the query for high-volume shops.
        const threeYearsAgo = new Date();
        threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

        const sales = await this.prisma.sale.findMany({
            where: {
                CustomerId: { in: customerIds },
                DeletedAt: null,
                Status: { not: 'CANCELLED' },
                CreditAmount: { gt: 0 },
                CreatedAt: { gte: threeYearsAgo, lte: to },
            },
            select: {
                CustomerId: true,
                CreatedAt: true,
                CreditAmount: true,
            },
            orderBy: [{ CustomerId: 'asc' }, { CreatedAt: 'desc' }],
        });

        const salesByCustomer = new Map<string, typeof sales>();
        for (const s of sales) {
            const list = salesByCustomer.get(s.CustomerId) ?? [];
            list.push(s);
            salesByCustomer.set(s.CustomerId, list);
        }

        const now = to.getTime();
        const dayMs = 86_400_000;
        const ZERO = new Prisma.Decimal(0);

        const rows: ArAgingRow[] = [];

        for (const c of customers) {
            const balance = new Prisma.Decimal(c.Balance);
            if (balance.lte(0) && !query.IncludeZeroBalance) continue;

            let remaining = balance;
            const buckets: ArAgingBucket = {
                Current: '0',
                Days31To60: '0',
                Days61To90: '0',
                Days91To180: '0',
                DaysOver180: '0',
            };
            const bucketNums = {
                Current: ZERO,
                Days31To60: ZERO,
                Days61To90: ZERO,
                Days91To180: ZERO,
                DaysOver180: ZERO,
            };

            const custSales = salesByCustomer.get(c.Id) ?? [];
            let lastCreditSaleDate: Date | null = null;

            for (const s of custSales) {
                if (!lastCreditSaleDate) lastCreditSaleDate = s.CreatedAt;
                if (remaining.lte(0)) break;

                const saleCredit = new Prisma.Decimal(s.CreditAmount);
                const alloc = Prisma.Decimal.min(remaining, saleCredit);

                const ageDays = Math.floor(
                    (now - s.CreatedAt.getTime()) / dayMs,
                );

                if (ageDays <= 30) bucketNums.Current = bucketNums.Current.add(alloc);
                else if (ageDays <= 60) bucketNums.Days31To60 = bucketNums.Days31To60.add(alloc);
                else if (ageDays <= 90) bucketNums.Days61To90 = bucketNums.Days61To90.add(alloc);
                else if (ageDays <= 180) bucketNums.Days91To180 = bucketNums.Days91To180.add(alloc);
                else bucketNums.DaysOver180 = bucketNums.DaysOver180.add(alloc);

                remaining = remaining.sub(alloc);
            }

            // Any remaining balance with no matching sale (e.g. opening
            // balance adjustments) goes to the oldest bucket.
            if (remaining.gt(0)) {
                bucketNums.DaysOver180 = bucketNums.DaysOver180.add(remaining);
            }

            buckets.Current = bucketNums.Current.toString();
            buckets.Days31To60 = bucketNums.Days31To60.toString();
            buckets.Days61To90 = bucketNums.Days61To90.toString();
            buckets.Days91To180 = bucketNums.Days91To180.toString();
            buckets.DaysOver180 = bucketNums.DaysOver180.toString();

            const availableCredit = new Prisma.Decimal(c.CreditLimit).sub(balance);

            rows.push({
                CustomerId: c.Id,
                Code: c.Code,
                Name: c.Name,
                Phone: c.Phone,
                Balance: balance.toString(),
                CreditLimit: c.CreditLimit.toString(),
                AvailableCredit: availableCredit.toString(),
                LastCreditSaleDate: lastCreditSaleDate
                    ? lastCreditSaleDate.toISOString()
                    : null,
                Buckets: buckets,
            });
        }

        const totals = rows.reduce(
            (acc, r) => {
                acc.Current = acc.Current.add(new Prisma.Decimal(r.Buckets.Current));
                acc.Days31To60 = acc.Days31To60.add(new Prisma.Decimal(r.Buckets.Days31To60));
                acc.Days61To90 = acc.Days61To90.add(new Prisma.Decimal(r.Buckets.Days61To90));
                acc.Days91To180 = acc.Days91To180.add(new Prisma.Decimal(r.Buckets.Days91To180));
                acc.DaysOver180 = acc.DaysOver180.add(new Prisma.Decimal(r.Buckets.DaysOver180));
                return acc;
            },
            {
                Current: ZERO,
                Days31To60: ZERO,
                Days61To90: ZERO,
                Days91To180: ZERO,
                DaysOver180: ZERO,
            },
        );

        const grand = totals.Current
            .add(totals.Days31To60)
            .add(totals.Days61To90)
            .add(totals.Days91To180)
            .add(totals.DaysOver180);

        return {
            From: from.toISOString(),
            To: to.toISOString(),
            Rows: rows,
            Totals: {
                Current: totals.Current.toString(),
                Days31To60: totals.Days31To60.toString(),
                Days61To90: totals.Days61To90.toString(),
                Days91To180: totals.Days91To180.toString(),
                DaysOver180: totals.DaysOver180.toString(),
                Grand: grand.toString(),
            },
        };
    }

    // ---------------------------------------------------------------
    // Cheque calendar
    // ---------------------------------------------------------------

    async chequeCalendar(
        query: ChequeCalendarQueryDto,
    ): Promise<ChequeCalendarReport> {
        const now = new Date();
        const defaultFrom = new Date(now);
        defaultFrom.setHours(0, 0, 0, 0);
        const defaultTo = new Date(now);
        defaultTo.setDate(defaultTo.getDate() + 30);
        defaultTo.setHours(23, 59, 59, 999);

        const from = query.From ? new Date(query.From) : defaultFrom;
        const to = query.To ? new Date(query.To) : defaultTo;

        const customerWhere: Prisma.CustomerChequeWhereInput = {
            Status: 'PENDING',
            DeletedAt: null,
            DueDate: { gte: from, lte: to },
        };
        if (query.CustomerId) customerWhere.CustomerId = query.CustomerId;

        const supplierWhere: Prisma.SupplierChequeWhereInput = {
            Status: 'PENDING',
            DueDate: { gte: from, lte: to },
        };
        if (query.SupplierId) supplierWhere.SupplierId = query.SupplierId;

        const [customerCheques, supplierCheques] = await Promise.all([
            this.prisma.customerCheque.findMany({
                where: customerWhere,
                include: {
                    Customer: { select: { Id: true, Name: true, Code: true } },
                },
                orderBy: { DueDate: 'asc' },
            }),
            this.prisma.supplierCheque.findMany({
                where: supplierWhere,
                include: {
                    Supplier: { select: { Id: true, Name: true, Code: true } },
                },
                orderBy: { DueDate: 'asc' },
            }),
        ]);

        const entries: ChequeCalendarEntry[] = [];

        for (const c of customerCheques) {
            entries.push({
                Side: 'CUSTOMER',
                ChequeId: c.Id,
                Code: c.Code,
                ChequeNumber: c.ChequeNumber,
                Amount: c.Amount.toString(),
                IssueDate: c.IssueDate.toISOString(),
                DueDate: c.DueDate.toISOString(),
                CounterpartyId: c.Customer.Id,
                CounterpartyName: c.Customer.Name,
                CounterpartyCode: c.Customer.Code,
                BankName: c.BankName,
                Notes: c.Notes,
            });
        }

        for (const c of supplierCheques) {
            entries.push({
                Side: 'SUPPLIER',
                ChequeId: c.Id,
                Code: c.Code,
                ChequeNumber: c.ChequeNumber,
                Amount: c.Amount.toString(),
                IssueDate: c.IssueDate.toISOString(),
                DueDate: c.DueDate.toISOString(),
                CounterpartyId: c.Supplier.Id,
                CounterpartyName: c.Supplier.Name,
                CounterpartyCode: c.Supplier.Code,
                BankName: c.BankName,
                Notes: c.Notes,
            });
        }

        entries.sort(
            (a, b) =>
                new Date(a.DueDate).getTime() - new Date(b.DueDate).getTime(),
        );

        const customerTotal = customerCheques.reduce(
            (s, c) => s.add(new Prisma.Decimal(c.Amount)),
            new Prisma.Decimal(0),
        );
        const supplierTotal = supplierCheques.reduce(
            (s, c) => s.add(new Prisma.Decimal(c.Amount)),
            new Prisma.Decimal(0),
        );
        const netExposure = customerTotal.sub(supplierTotal);

        // Group by day
        const dayMap = new Map<
            string,
            { customer: Prisma.Decimal; supplier: Prisma.Decimal; count: number }
        >();

        const dayKey = (d: Date) => {
            const x = new Date(d);
            x.setHours(0, 0, 0, 0);
            return x.toISOString().slice(0, 10);
        };

        for (const e of entries) {
            const k = dayKey(new Date(e.DueDate));
            const cur =
                dayMap.get(k) ?? {
                    customer: new Prisma.Decimal(0),
                    supplier: new Prisma.Decimal(0),
                    count: 0,
                };
            const amt = new Prisma.Decimal(e.Amount);
            if (e.Side === 'CUSTOMER') cur.customer = cur.customer.add(amt);
            else cur.supplier = cur.supplier.add(amt);
            cur.count += 1;
            dayMap.set(k, cur);
        }

        const byDay = Array.from(dayMap.entries())
            .map(([day, v]) => ({
                Day: day,
                CustomerAmount: v.customer.toString(),
                SupplierAmount: v.supplier.toString(),
                Count: v.count,
            }))
            .sort((a, b) => a.Day.localeCompare(b.Day));

        return {
            From: from.toISOString(),
            To: to.toISOString(),
            CustomerTotal: customerTotal.toString(),
            SupplierTotal: supplierTotal.toString(),
            NetExposure: netExposure.toString(),
            Entries: entries,
            ByDay: byDay,
        };
    }

    // ---------------------------------------------------------------
    // Cash flow
    // ---------------------------------------------------------------

    async cashFlow(query: CashFlowQueryDto): Promise<CashFlowReport> {
        let from: Date;
        let to: Date;

        // Session-scoped overrides the date range.
        if (query.CashSessionId) {
            const session = await this.prisma.cashSession.findUnique({
                where: { Id: query.CashSessionId },
                select: { OpenedAt: true, ClosedAt: true },
            });
            if (!session) throw new NotFoundException('Cash session not found');
            from = session.OpenedAt;
            to = session.ClosedAt ?? new Date();
        } else {
            const r = this.resolveRange(query.From, query.To);
            from = r.from;
            to = r.to;
        }

        const group: CashFlowGroup = query.GroupBy ?? 'day';

        // Opening balance = net cash on hand BEFORE the window starts.
        const beforeAgg = await this.prisma.cashLedger.aggregate({
            where: { CreatedAt: { lt: from } },
            _sum: { Amount: true },
        });
        const opening = new Prisma.Decimal(beforeAgg._sum.Amount ?? 0);

        // Per-period, per-type aggregation.
        //
        // The DATE_TRUNC expression is computed once inside the CTE so the
        // outer query can GROUP BY the aliased column directly. Attempting
        // to repeat the parameterized expression in both SELECT and
        // GROUP BY triggers Postgres error 42803.
        type Row = { Period: Date; Type: string; Sum: string; Cnt: bigint };
        const rows = await this.prisma.$queryRaw<Row[]>`
            WITH bucketed AS (
                SELECT
                    DATE_TRUNC(${group}::text, "CreatedAt") AS "Period",
                    "Type"::text                            AS "Type",
                    "Amount"                                AS "Amount"
                FROM "CashLedgers"
                WHERE "CreatedAt" >= ${from}
                  AND "CreatedAt" <= ${to}
            )
            SELECT
                "Period",
                "Type",
                COALESCE(SUM("Amount"), 0)::text        AS "Sum",
                COUNT(*)::bigint                        AS "Cnt"
            FROM bucketed
            GROUP BY "Period", "Type"
            ORDER BY "Period" ASC
        `;

        // Pivot into per-period rows.
        type Bucket = {
            Period: Date;
            types: Map<string, Prisma.Decimal>;
            count: number;
        };
        const bucketMap = new Map<string, Bucket>();

        for (const r of rows) {
            const key = r.Period.toISOString();
            const existing = bucketMap.get(key) ?? {
                Period: r.Period,
                types: new Map<string, Prisma.Decimal>(),
                count: 0,
            };
            existing.types.set(r.Type, new Prisma.Decimal(r.Sum));
            existing.count += Number(r.Cnt);
            bucketMap.set(key, existing);
        }

        const sorted = Array.from(bucketMap.values()).sort(
            (a, b) => a.Period.getTime() - b.Period.getTime(),
        );

        const ZERO = new Prisma.Decimal(0);
        let running = opening;
        const outRows: CashFlowRow[] = [];

        const label = (d: Date): string => {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            if (group === 'month') return `${yyyy}-${mm}`;
            return `${yyyy}-${mm}-${dd}`;
        };

        for (const b of sorted) {
            const g = (t: string) => b.types.get(t) ?? ZERO;
            const rowOpening = running;

            const inSale = g('SALE');
            const inCreditPayment = g('CREDIT_PAYMENT');
            const inCashIn = g('CASH_IN');
            const inExpenseRev = g('EXPENSE_REVERSED');
            const inCreditRev = g('CREDIT_PAYMENT_REVERSED');

            const outSaleRefund = g('SALE_REFUND');
            const outCashOut = g('CASH_OUT');
            const outExpense = g('EXPENSE');

            const net = inSale
                .add(inCreditPayment)
                .add(inCashIn)
                .add(inExpenseRev)
                .add(inCreditRev)
                .add(outSaleRefund)
                .add(outCashOut)
                .add(outExpense);

            const closing = rowOpening.add(net);
            running = closing;

            outRows.push({
                Period: label(b.Period),
                Opening: rowOpening.toString(),
                In: {
                    Sale: inSale.toString(),
                    CreditPayment: inCreditPayment.toString(),
                    CashIn: inCashIn.toString(),
                    ExpenseReversed: inExpenseRev.toString(),
                    CreditPaymentReversed: inCreditRev.toString(),
                },
                Out: {
                    SaleRefund: outSaleRefund.toString(),
                    CashOut: outCashOut.toString(),
                    Expense: outExpense.toString(),
                },
                NetChange: net.toString(),
                Closing: closing.toString(),
                EntryCount: b.count,
            });
        }

        return {
            Group: group,
            From: from.toISOString(),
            To: to.toISOString(),
            OpeningBalance: opening.toString(),
            ClosingBalance: running.toString(),
            Rows: outRows,
        };
    }
}