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
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { QueryBrandDto } from './dto/query-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@ApiTags('brands')
@ApiCookieAuth('cookie-auth')
@Controller('brands')
export class BrandsController {
    constructor(private readonly brands: BrandsService) { }

    @Get()
    @RequirePermissions('products.view')
    @ApiOperation({ summary: 'List brands (paginated)' })
    @ApiOkResponse({ description: 'Paginated brand list.' })
    list(@Query() query: QueryBrandDto) {
        return this.brands.list(query);
    }

    @Get(':id')
    @RequirePermissions('products.view')
    @ApiOperation({ summary: 'Get one brand' })
    @ApiOkResponse({ description: 'Brand detail with product count.' })
    @ApiNotFoundResponse({ description: 'Brand not found.' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.brands.findOne(id);
    }

    @Post()
    @RequirePermissions('brands.manage')
    @ApiOperation({ summary: 'Create a brand' })
    @ApiCreatedResponse({ description: 'Brand created.' })
    @ApiConflictResponse({ description: 'Name already in use.' })
    create(
        @Body() dto: CreateBrandDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.brands.create(dto, actorId);
    }

    @Patch(':id')
    @RequirePermissions('brands.manage')
    @ApiOperation({ summary: 'Update a brand' })
    @ApiOkResponse({ description: 'Brand updated.' })
    @ApiNotFoundResponse({ description: 'Brand not found.' })
    @ApiConflictResponse({ description: 'Name already in use.' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateBrandDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.brands.update(id, dto, actorId);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('brands.manage')
    @ApiOperation({ summary: 'Soft-delete a brand' })
    @ApiOkResponse({ description: 'Brand soft-deleted.' })
    @ApiNotFoundResponse({ description: 'Brand not found.' })
    @ApiConflictResponse({ description: 'Products still reference it.' })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.brands.remove(id, actorId);
    }
}