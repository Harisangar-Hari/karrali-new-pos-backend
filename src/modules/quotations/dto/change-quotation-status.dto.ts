//src/modules/quotations/dto/change-quotation-status.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ChangeQuotationStatusDto {
    @ApiPropertyOptional({
        description:
            'Reason. Required for reject and cancel; ignored for send/accept.',
        maxLength: 500,
    })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    Reason?: string;
}