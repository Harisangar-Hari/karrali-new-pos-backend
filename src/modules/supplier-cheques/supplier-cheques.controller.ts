import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiConflictResponse,
    ApiCookieAuth,
    ApiCreatedResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { BounceSupplierChequeDto } from './dto/bounce-supplier-cheque.dto';
import { ClearSupplierChequeDto } from './dto/clear-supplier-cheque.dto';
import { CreateSupplierChequeDto } from './dto/create-supplier-cheque.dto';
import { QuerySupplierChequeDto } from './dto/query-supplier-cheque.dto';
import { VoidSupplierChequeDto } from './dto/void-supplier-cheque.dto';
import { SupplierChequesService } from './supplier-cheques.service';

@ApiTags('supplier-cheques')
@ApiCookieAuth('cookie-auth')
@Controller('supplier-cheques')
export class SupplierChequesController {
    constructor(private readonly cheques: SupplierChequesService) {}

    @Get()
    @RequirePermissions('supplier_cheques.view')
    @ApiOperation({
        summary: 'List supplier cheques (paginated, earliest-due first)',
        description:
            'Filters: SupplierId, PurchaseId, Status, dueBefore, dueAfter. Use dueBefore for the cheque calendar widget.',
    })
    @ApiOkResponse({ description: 'Paginated cheque list.' })
    list(@Query() query: QuerySupplierChequeDto) {
        return this.cheques.list(query);
    }

    @Get(':id')
    @RequirePermissions('supplier_cheques.view')
    @ApiOperation({ summary: 'Get one supplier cheque' })
    @ApiOkResponse({ description: 'Cheque detail.' })
    @ApiNotFoundResponse({ description: 'Cheque not found.' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.cheques.findOne(id);
    }

    @Post()
    @RequirePermissions('supplier_cheques.create')
    @ApiOperation({
        summary: 'Issue a supplier cheque (PENDING)',
        description:
            'Reserves amount against the purchase. Cannot exceed (TotalAmount − PaidAmount − pending cheques).',
    })
    @ApiCreatedResponse({ description: 'Cheque issued.' })
    @ApiBadRequestResponse({
        description: 'Amount exceeds un-committed balance, supplier inactive.',
    })
    @ApiNotFoundResponse({ description: 'Purchase not found.' })
    @ApiConflictResponse({ description: 'Purchase is not POSTED.' })
    create(
        @Body() dto: CreateSupplierChequeDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.cheques.create(dto, actorId);
    }

    @Post(':id/clear')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('supplier_cheques.clear')
    @ApiOperation({
        summary: 'Mark cheque as cleared',
        description:
            'Auto-creates a CHEQUE-method SupplierPayment and bumps Purchase.PaidAmount. PENDING → CLEARED.',
    })
    @ApiOkResponse({ description: 'Cheque cleared — payment created.' })
    @ApiNotFoundResponse({ description: 'Cheque not found.' })
    @ApiConflictResponse({ description: 'Cheque is not PENDING.' })
    clear(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ClearSupplierChequeDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.cheques.clear(id, dto, actorId);
    }

    @Post(':id/bounce')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('supplier_cheques.bounce')
    @ApiOperation({
        summary: 'Mark cheque as bounced',
        description:
            'Records the bounce reason. No payment is created; the invoice remains unpaid. PENDING → BOUNCED.',
    })
    @ApiOkResponse({ description: 'Cheque bounced.' })
    @ApiNotFoundResponse({ description: 'Cheque not found.' })
    @ApiConflictResponse({ description: 'Cheque is not PENDING.' })
    bounce(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: BounceSupplierChequeDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.cheques.bounce(id, dto, actorId);
    }

    @Post(':id/void')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('supplier_cheques.void')
    @ApiOperation({
        summary: 'Void a pending cheque',
        description:
            'Use when the cheque never left the office (wrong supplier, wrong amount). PENDING → VOIDED.',
    })
    @ApiOkResponse({ description: 'Cheque voided.' })
    @ApiNotFoundResponse({ description: 'Cheque not found.' })
    @ApiConflictResponse({ description: 'Cheque is not PENDING.' })
    void(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: VoidSupplierChequeDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.cheques.void(id, dto, actorId);
    }
}