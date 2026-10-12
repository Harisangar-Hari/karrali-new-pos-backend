import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateCustomerDto } from './create-customer.dto';

/**
 * Opening balance only applies on create. Balance changes after
 * creation go through `POST /customers/:id/adjust-balance`.
 */
export class UpdateCustomerDto extends PartialType(
    OmitType(CreateCustomerDto, ['OpeningBalance'] as const),
) { }