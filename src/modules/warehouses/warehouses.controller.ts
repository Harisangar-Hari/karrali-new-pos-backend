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
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { QueryWarehouseDto } from './dto/query-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehousesService } from './warehouses.service';

@ApiTags('warehouses')
@ApiCookieAuth('cookie-auth')
@Controller('warehouses')
export class WarehousesController {
    constructor(private readonly warehouses: WarehousesService) { }

    @Get()
    @RequirePermissions('warehouses.view')
    @ApiOperation({ summary: 'List warehouses (paginated)' })
    @ApiOkResponse({ description: 'Paginated warehouse list.' })
    list(@Query() query: QueryWarehouseDto) {
        return this.warehouses.list(query);
    }

    @Get(':id')
    @RequirePermissions('warehouses.view')
    @ApiOperation({ summary: 'Get one warehouse' })
    @ApiOkResponse({ description: 'Warehouse detail.' })
    @ApiNotFoundResponse({ description: 'Warehouse not found.' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.warehouses.findOne(id);
    }

    @Post()
    @RequirePermissions('warehouses.manage')
    @ApiOperation({ summary: 'Create a warehouse' })
    @ApiCreatedResponse({ description: 'Warehouse created.' })
    @ApiConflictResponse({ description: 'Code already in use.' })
    create(
        @Body() dto: CreateWarehouseDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.warehouses.create(dto, actorId);
    }

    @Patch(':id')
    @RequirePermissions('warehouses.manage')
    @ApiOperation({ summary: 'Update a warehouse' })
    @ApiOkResponse({ description: 'Warehouse updated.' })
    @ApiNotFoundResponse({ description: 'Warehouse not found.' })
    @ApiConflictResponse({
        description: 'Code conflict or attempting to unset the only default.',
    })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateWarehouseDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.warehouses.update(id, dto, actorId);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('warehouses.manage')
    @ApiOperation({ summary: 'Soft-delete a warehouse' })
    @ApiOkResponse({ description: 'Warehouse soft-deleted.' })
    @ApiNotFoundResponse({ description: 'Warehouse not found.' })
    @ApiConflictResponse({
        description: 'Default warehouse, live terminals, or non-zero stock.',
    })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.warehouses.remove(id, actorId);
    }
}