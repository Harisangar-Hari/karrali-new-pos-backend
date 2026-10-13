import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateExpenseDto } from './create-expense.dto';

/**
 * Only non-financial fields can change after posting. Amount, Method,
 * BankAccountId, CategoryId, and PaidAt are frozen — mistakes should
 * be deleted (which reverses the cash effect) and re-entered.
 */
export class UpdateExpenseDto extends PartialType(
    OmitType(CreateExpenseDto, [
        'Amount',
        'Method',
        'BankAccountId',
        'CategoryId',
        'PaidAt',
    ] as const),
) {}