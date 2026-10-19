import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
      // Client-wide defaults for every interactive transaction.
      // Neon's pooled connection adds latency per query, so the
      // Prisma default of 5s is too tight for multi-write operations
      // like sale checkout, sale returns, and credit payments.
      // 30s is safe headroom; 10s to acquire a pooled connection.
      transactionOptions: {
        timeout: 30_000,
        maxWait: 10_000,
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}