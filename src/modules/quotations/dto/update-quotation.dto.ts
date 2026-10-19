//src/modules/quotations/dto/update-quotation.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateQuotationDto } from './create-quotation.dto';

export class UpdateQuotationDto extends PartialType(CreateQuotationDto) {}