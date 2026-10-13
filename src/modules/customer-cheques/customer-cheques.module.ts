import { Module } from '@nestjs/common';
import { CustomerChequesController } from './customer-cheques.controller';
import { CustomerChequesService } from './customer-cheques.service';

@Module({
    controllers: [CustomerChequesController],
    providers: [CustomerChequesService],
    exports: [CustomerChequesService],
})
export class CustomerChequesModule {}