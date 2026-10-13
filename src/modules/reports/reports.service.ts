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
            SELECT
                TO_CHAR(DATE_TRUNC(${unit}::text, "CreatedAt"), 'YYYY-MM-DD') AS "Period",
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
            GROUP BY DATE_TRUNC(${unit}::text, "CreatedAt")
            ORDER BY DATE_TRUNC(${unit}::text, "CreatedAt") ASC
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
            SELECT
                NULL::uuid                                   AS "ProductId",
                TO_CHAR(DATE_TRUNC(${unit}::text, s."CreatedAt"), 'YYYY-MM-DD') AS "Name",
                NULL::text                                   AS "SKU",
                NULL::text                                   AS "CategoryName",
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
            WHERE s."DeletedAt" IS NULL
              AND s."Status" <> 'CANCELLED'
              AND s."CreatedAt" >= ${from}
              AND s."CreatedAt" <= ${to}
              ${terminalFilter}
              ${categoryFilter}
              ${productFilter}
            GROUP BY DATE_TRUNC(${unit}::text, s."CreatedAt")
            ORDER BY DATE_TRUNC(${unit}::text, s."CreatedAt") ASC
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
}