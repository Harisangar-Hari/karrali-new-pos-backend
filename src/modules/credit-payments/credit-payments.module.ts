import { Module } from '@nestjs/common';
import { CustomerChequesModule } from '../customer-cheques/customer-cheques.module';
import { CreditPaymentsController } from './credit-payments.controller';
import { CreditPaymentsService } from './credit-payments.service';

@Module({
    imports: [CustomerChequesModule],
    controllers: [CreditPaymentsController],
    providers: [CreditPaymentsService],
    exports: [CreditPaymentsService],
})
export class CreditPaymentsModule {}