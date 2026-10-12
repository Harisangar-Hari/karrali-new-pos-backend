import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

/**
 * Global so feature modules don't need to import this module just to
 * call `audit.log(...)`. AuditService has no side-effect dependencies
 * beyond PrismaService (already @Global()).
 */
@Global()
@Module({
    controllers: [AuditController],
    providers: [AuditService],
    exports: [AuditService],
})
export class AuditModule { }