//src/modules/quotations/quotations.controller.ts
import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiConflictResponse,
    ApiCookieAuth,
    ApiCreatedResponse,
    ApiForbiddenResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { JwtUser } from '../auth/strategies/jwt.strategy';
import { ChangeQuotationStatusDto } from './dto/change-quotation-status.dto';
import { ConvertQuotationDto } from './dto/convert-quotation.dto';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { QueryQuotationDto } from './dto/query-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QuotationsService } from './quotations.service';

@ApiTags('quotations')
@ApiCookieAuth('cookie-auth')
@Controller('quotations')
export class QuotationsController {
    constructor(private readonly quotations: QuotationsService) {}

    @Get()
    @RequirePermissions('quotations.view')
    @ApiOperation({
        summary: 'List quotations (paginated)',
        description:
            'Each row includes an EffectiveStatus — EXPIRED when status is DRAFT/SENT and ValidUntil has passed.',
    })
    @ApiOkResponse({ description: 'Paginated quotation list.' })
    list(@Query() query: QueryQuotationDto) {
        return this.quotations.list(query);
    }

    @Get(':id')
    @RequirePermissions('quotations.view')
    @ApiOperation({ summary: 'Get one quotation with items' })
    @ApiOkResponse({ description: 'Quotation detail.' })
    @ApiNotFoundResponse({ description: 'Quotation not found.' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.quotations.findOne(id);
    }

    @Post()
    @RequirePermissions('quotations.create')
    @ApiOperation({
        summary: 'Create a quotation (DRAFT)',
        description:
            'Line discounts require sales.discount permission. Unit prices are frozen at creation.',
    })
    @ApiCreatedResponse({ description: 'Quotation created.' })
    @ApiBadRequestResponse({ description: 'Invalid customer or product.' })
    @ApiForbiddenResponse({ description: 'Discount permission missing.' })
    create(
        @Body() dto: CreateQuotationDto,
        @CurrentUser() user: JwtUser,
    ) {
        return this.quotations.create(dto, user.userId, {
            hasDiscountPermission: user.permissions.includes('sales.discount'),
        });
    }

    @Patch(':id')
    @RequirePermissions('quotations.update')
    @ApiOperation({
        summary: 'Update a quotation',
        description:
            'DRAFT — all fields + items editable. SENT — only Notes and ValidUntil. Beyond SENT — read-only.',
    })
    @ApiOkResponse({ description: 'Quotation updated.' })
    @ApiNotFoundResponse({ description: 'Quotation not found.' })
    @ApiBadRequestResponse({ description: 'Field not editable in current status.' })
    @ApiConflictResponse({ description: 'Status does not allow updates.' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateQuotationDto,
        @CurrentUser() user: JwtUser,
    ) {
        return this.quotations.update(id, dto, user.userId, {
            hasDiscountPermission: user.permissions.includes('sales.discount'),
        });
    }

    @Post(':id/send')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('quotations.update')
    @ApiOperation({ summary: 'Mark as SENT (DRAFT → SENT)' })
    @ApiOkResponse({ description: 'Quotation sent.' })
    @ApiConflictResponse({ description: 'Not in DRAFT status.' })
    send(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.quotations.send(id, actorId);
    }

    @Post(':id/accept')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('quotations.update')
    @ApiOperation({ summary: 'Mark as ACCEPTED (SENT → ACCEPTED)' })
    @ApiOkResponse({ description: 'Quotation accepted.' })
    @ApiConflictResponse({ description: 'Not in SENT status.' })
    accept(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.quotations.accept(id, actorId);
    }

    @Post(':id/reject')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('quotations.update')
    @ApiOperation({ summary: 'Mark as REJECTED (SENT → REJECTED)' })
    @ApiOkResponse({ description: 'Quotation rejected.' })
    @ApiConflictResponse({ description: 'Not in SENT status.' })
    reject(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ChangeQuotationStatusDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.quotations.reject(id, dto, actorId);
    }

    @Post(':id/cancel')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('quotations.update')
    @ApiOperation({ summary: 'Cancel (DRAFT or SENT → CANCELLED)' })
    @ApiOkResponse({ description: 'Quotation cancelled.' })
    @ApiConflictResponse({ description: 'Already terminal.' })
    cancel(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ChangeQuotationStatusDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.quotations.cancel(id, dto, actorId);
    }

    @Post(':id/convert')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('quotations.convert')
    @ApiOperation({
        summary: 'Convert an ACCEPTED quotation to a sale',
        description:
            'Atomically creates the sale (with payments) and marks the quotation CONVERTED. Sale uses the terminal\'s warehouse. Requires sales.discount permission if any line has a discount.',
    })
    @ApiOkResponse({ description: 'Quotation converted — response includes Sale.' })
    @ApiNotFoundResponse({ description: 'Quotation not found.' })
    @ApiConflictResponse({ description: 'Quotation is not ACCEPTED.' })
    @ApiBadRequestResponse({ description: 'Payment mismatch or bad product.' })
    @ApiForbiddenResponse({ description: 'Discount permission missing.' })
    convert(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ConvertQuotationDto,
        @CurrentUser() user: JwtUser,
    ) {
        return this.quotations.convert(id, dto, user.userId, {
            hasDiscountPermission: user.permissions.includes('sales.discount'),
        });
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('quotations.delete')
    @ApiOperation({
        summary: 'Soft-delete a DRAFT quotation',
        description:
            'Only DRAFT. Once SENT, use cancel. Once ACCEPTED, use convert or cancel.',
    })
    @ApiOkResponse({ description: 'Quotation deleted.' })
    @ApiNotFoundResponse({ description: 'Quotation not found.' })
    @ApiConflictResponse({ description: 'Not in DRAFT status.' })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.quotations.remove(id, actorId);
    }
}