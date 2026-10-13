import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import configuration from './config/configuration';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PrismaModule } from './database/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { WarehousesModule } from './modules/warehouses/warehouses.module';
import { TerminalsModule } from './modules/terminals/terminals.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { BrandsModule } from './modules/brands/brands.module';
import { ProductsModule } from './modules/products/products.module';
import { AuditModule } from './modules/audit/audit.module';
import { StockModule } from './modules/stock/stock.module';
import { CommonModule } from './common/common.module';
import { SettingsModule } from './modules/settings/settings.module';
import { CustomersModule } from './modules/customers/customers.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { SupplierPaymentsModule } from './modules/supplier-payments/supplier-payments.module';
import { SupplierChequesModule } from './modules/supplier-cheques/supplier-cheques.module';
import { SalesModule } from './modules/sales/sales.module';
import { SaleReturnsModule } from './modules/sale-returns/sale-returns.module';
import { CustomerChequesModule } from './modules/customer-cheques/customer-cheques.module';
import { CreditPaymentsModule } from './modules/credit-payments/credit-payments.module';
import { CashSessionsModule } from './modules/cash-sessions/cash-sessions.module';
import { BankAccountsModule } from './modules/bank-accounts/bank-accounts.module';
import { ExpenseCategoriesModule } from './modules/expense-categories/expense-categories.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { CashMovementsModule } from './modules/cash-movements/cash-movements.module';
import { ReportsModule } from './modules/reports/reports.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      cache: true,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
              target: 'pino-pretty',
              options: { singleLine: true, colorize: true },
            },
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    CommonModule,
    PrismaModule,
    AuthModule,
    WarehousesModule,
    AuditModule,
    TerminalsModule,
    CategoriesModule,
    BrandsModule,
    ProductsModule,
    StockModule,
    SettingsModule,
    CustomersModule,
    SuppliersModule,
    PurchasesModule,
    SupplierPaymentsModule,
    SupplierChequesModule,
    SalesModule,
    SaleReturnsModule,
    CustomerChequesModule,
    CreditPaymentsModule,
    CashSessionsModule,
    BankAccountsModule,
    ExpenseCategoriesModule,
    ExpensesModule,
    CashMovementsModule,
    ReportsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule { }