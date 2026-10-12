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
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@ApiCookieAuth('cookie-auth')
@Controller('products')
export class ProductsController {
    constructor(private readonly products: ProductsService) {}

    @Get()
    @RequirePermissions('products.view')
    @ApiOperation({
        summary: 'List products (paginated)',
        description:
            'Filters: CategoryId, BrandId, IsActive, lowStock, minPrice, maxPrice, search.',
    })
    @ApiOkResponse({ description: 'Paginated product list.' })
    list(@Query() query: QueryProductDto) {
        return this.products.list(query);
    }

    @Get(':id')
    @RequirePermissions('products.view')
    @ApiOperation({ summary: 'Get one product with per-warehouse stock' })
    @ApiOkResponse({ description: 'Product detail.' })
    @ApiNotFoundResponse({ description: 'Product not found.' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.products.findOne(id);
    }

    @Post()
    @RequirePermissions('products.create')
    @ApiOperation({ summary: 'Create a product (optionally with opening stock)' })
    @ApiCreatedResponse({ description: 'Product created.' })
    @ApiBadRequestResponse({
        description: 'Invalid category/brand/warehouse or opening-stock pairing.',
    })
    @ApiConflictResponse({ description: 'SKU or Barcode already in use.' })
    create(
        @Body() dto: CreateProductDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.products.create(dto, actorId);
    }

    @Patch(':id')
    @RequirePermissions('products.update')
    @ApiOperation({ summary: 'Update a product' })
    @ApiOkResponse({ description: 'Product updated.' })
    @ApiNotFoundResponse({ description: 'Product not found.' })
    @ApiBadRequestResponse({ description: 'Invalid category/brand.' })
    @ApiConflictResponse({ description: 'SKU or Barcode already in use.' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateProductDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.products.update(id, dto, actorId);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('products.delete')
    @ApiOperation({ summary: 'Soft-delete a product' })
    @ApiOkResponse({ description: 'Product soft-deleted.' })
    @ApiNotFoundResponse({ description: 'Product not found.' })
    @ApiConflictResponse({ description: 'Non-zero stock on one or more warehouses.' })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.products.remove(id, actorId);
    }
}