import { Controller, Get, Query } from '@nestjs/common';
import {
    ApiCookieAuth,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { SalesSummaryQueryDto } from './dto/sales-summary.dto';
import { ZReportQueryDto } from './dto/z-report.dto';
import { ReportsService } from './reports.service';
import { InventoryMovementQueryDto } from './dto/inventory-movement.dto';
import { ProfitReportQueryDto } from './dto/profit-report.dto';
import { StockValuationQueryDto } from './dto/stock-valuation.dto';
import { ArAgingQueryDto } from './dto/ar-aging.dto';
import { ChequeCalendarQueryDto } from './dto/cheque-calendar.dto';
import { CashFlowQueryDto } from './dto/cash-flow.dto';


@ApiTags('reports')
@ApiCookieAuth('cookie-auth')
@Controller('reports')
export class ReportsController {
    constructor(private readonly reports: ReportsService) { }

    @Get('sales-summary')
    @RequirePermissions('reports.sales')
    @ApiOperation({
        summary: 'Sales summary by day / week / month',
        description:
            'Aggregates sales counts, revenue, tax, discounts, and payment-method breakdown. Excludes cancelled sales. Defaults to today if no range given.',
    })
    @ApiOkResponse({ description: 'Sales summary rows.' })
    salesSummary(@Query() query: SalesSummaryQueryDto) {
        return this.reports.salesSummary(query);
    }

    @Get('z-report')
    @RequirePermissions('reports.z_report')
    @ApiOperation({
        summary: 'Z-report — day close summary',
        description:
            'Everything a cashier/manager needs at close: sales, payments by method, returns, cancels, cash ledger breakdown, expected drawer, top products. Scope by TerminalId or CashSessionId.',
    })
    @ApiOkResponse({ description: 'Z-report summary.' })
    zReport(@Query() query: ZReportQueryDto) {
        return this.reports.zReport(query);
    }


    @Get('profit')
    @RequirePermissions('reports.profit')
    @ApiOperation({
        summary: 'Profit & COGS report',
        description:
            'Per-product or time-bucketed gross profit. COGS uses current Product.CostPrice (not a snapshot — see code comment for details).',
    })
    @ApiOkResponse({ description: 'Profit rows + totals.' })
    profit(@Query() query: ProfitReportQueryDto) {
        return this.reports.profitReport(query);
    }

    @Get('stock-valuation')
    @RequirePermissions('reports.stock')
    @ApiOperation({
        summary: 'Current stock valuation',
        description:
            'Qty on hand × current cost and retail, per product. Paginated. Totals cover the full filtered set, not just the current page.',
    })
    @ApiOkResponse({ description: 'Valuation rows + grand totals.' })
    stockValuation(@Query() query: StockValuationQueryDto) {
        return this.reports.stockValuation(query);
    }

    @Get('inventory-movement')
    @RequirePermissions('reports.stock')
    @ApiOperation({
        summary: 'Inventory movement ledger',
        description:
            'Raw StockMovement rows with product/warehouse embeds. Filter by ProductId, WarehouseId, Type, date range. Also returns NetChange (sum of Quantity across the filtered set).',
    })
    @ApiOkResponse({ description: 'Paginated movement rows + net change.' })
    inventoryMovement(@Query() query: InventoryMovementQueryDto) {
        return this.reports.inventoryMovement(query);
    }

    @Get('ar-aging')
    @RequirePermissions('reports.aging')
    @ApiOperation({
        summary: 'Accounts receivable aging',
        description:
            'FIFO-bucketed outstanding balances per customer: Current / 31-60 / 61-90 / 91-180 / 180+. Payments apply to oldest invoices first.',
    })
    @ApiOkResponse({ description: 'Aging rows + totals.' })
    arAging(@Query() query: ArAgingQueryDto) {
        return this.reports.arAging(query);
    }

    @Get('cheque-calendar')
    @RequirePermissions('reports.cheque_calendar')
    @ApiOperation({
        summary: 'Unified cheque calendar (customer + supplier)',
        description:
            'PENDING cheques due in the range, sorted by DueDate. Includes per-day totals and net exposure (customer − supplier).',
    })
    @ApiOkResponse({ description: 'Calendar entries + daily totals.' })
    chequeCalendar(@Query() query: ChequeCalendarQueryDto) {
        return this.reports.chequeCalendar(query);
    }

    @Get('cash-flow')
    @RequirePermissions('reports.cashflow')
    @ApiOperation({
        summary: 'Cash flow by day / week / month',
        description:
            'Opening balance, cash in (by source), cash out (by source), net change, closing. Opening for the first period is the real cumulative cash position before the window.',
    })
    @ApiOkResponse({ description: 'Cash flow rows.' })
    cashFlow(@Query() query: CashFlowQueryDto) {
        return this.reports.cashFlow(query);
    }
}