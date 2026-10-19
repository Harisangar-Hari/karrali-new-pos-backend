//src/modules/customers/dto/query-ledger.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerLedgerType } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryLedgerDto extends PaginationDto {
    @ApiPropertyOptional({ enum: CustomerLedgerType })
    @IsOptional()
    @IsEnum(CustomerLedgerType)
    Type?: CustomerLedgerType;

    /** Ledger lists are always newest-first. */
    @ApiPropertyOptional({ default: 'CreatedAt' })
    @IsOptional()
    override sortBy: string = 'CreatedAt';

    @ApiPropertyOptional({ default: 'desc' })
    @IsOptional()
    override sortOrder: 'asc' | 'desc' = 'desc';
}