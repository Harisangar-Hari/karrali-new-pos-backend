import { Module } from '@nestjs/common';
import { SupplierPaymentsModule } from '../supplier-payments/supplier-payments.module';
import { SupplierChequesController } from './supplier-cheques.controller';
import { SupplierChequesService } from './supplier-cheques.service';

@Module({
    imports: [SupplierPaymentsModule],
    controllers: [SupplierChequesController],
    providers: [SupplierChequesService],
    exports: [SupplierChequesService],
})
export class SupplierChequesModule {}