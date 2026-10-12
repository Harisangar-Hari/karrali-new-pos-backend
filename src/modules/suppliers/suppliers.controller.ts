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
    ApiCookieAuth,
    ApiCreatedResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { QuerySupplierDto } from './dto/query-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersService } from './suppliers.service';

@ApiTags('suppliers')
@ApiCookieAuth('cookie-auth')
@Controller('suppliers')
export class SuppliersController {
    constructor(private readonly suppliers: SuppliersService) { }

    @Get()
    @RequirePermissions('suppliers.view')
    @ApiOperation({ summary: 'List suppliers (paginated)' })
    @ApiOkResponse({ description: 'Paginated supplier list.' })
    list(@Query() query: QuerySupplierDto) {
        return this.suppliers.list(query);
    }

    @Get(':id')
    @RequirePermissions('suppliers.view')
    @ApiOperation({ summary: 'Get one supplier' })
    @ApiOkResponse({ description: 'Supplier detail.' })
    @ApiNotFoundResponse({ description: 'Supplier not found.' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.suppliers.findOne(id);
    }

    @Post()
    @RequirePermissions('suppliers.manage')
    @ApiOperation({ summary: 'Create a supplier (Code is auto-generated)' })
    @ApiCreatedResponse({ description: 'Supplier created.' })
    create(
        @Body() dto: CreateSupplierDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.suppliers.create(dto, actorId);
    }

    @Patch(':id')
    @RequirePermissions('suppliers.manage')
    @ApiOperation({ summary: 'Update a supplier' })
    @ApiOkResponse({ description: 'Supplier updated.' })
    @ApiNotFoundResponse({ description: 'Supplier not found.' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateSupplierDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.suppliers.update(id, dto, actorId);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('suppliers.manage')
    @ApiOperation({ summary: 'Soft-delete a supplier' })
    @ApiOkResponse({ description: 'Supplier soft-deleted.' })
    @ApiNotFoundResponse({ description: 'Supplier not found.' })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.suppliers.remove(id, actorId);
    }
}