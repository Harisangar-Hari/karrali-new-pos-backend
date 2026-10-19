import { Module } from '@nestjs/common';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { StockModule } from '../stock/stock.module';
import { SaleReturnsController } from './sale-returns.controller';
import { SaleReturnsService } from './sale-returns.service';

@Module({
    imports: [StockModule, LoyaltyModule],
    controllers: [SaleReturnsController],
    providers: [SaleReturnsService],
    exports: [SaleReturnsService],
})
export class SaleReturnsModule {}