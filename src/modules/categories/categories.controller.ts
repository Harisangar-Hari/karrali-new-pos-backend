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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { QueryCategoryDto } from './dto/query-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('categories')
@ApiCookieAuth('cookie-auth')
@Controller('categories')
export class CategoriesController {
    constructor(private readonly categories: CategoriesService) { }

    @Get()
    @RequirePermissions('products.view')
    @ApiOperation({
        summary: 'List categories (paginated)',
        description:
            'Use `rootOnly=true` for top-level, `ParentId=<uuid>` for children of a node.',
    })
    @ApiOkResponse({ description: 'Paginated category list.' })
    list(@Query() query: QueryCategoryDto) {
        return this.categories.list(query);
    }

    @Get(':id')
    @RequirePermissions('products.view')
    @ApiOperation({ summary: 'Get one category' })
    @ApiOkResponse({ description: 'Category detail with parent and counts.' })
    @ApiNotFoundResponse({ description: 'Category not found.' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.categories.findOne(id);
    }

    @Post()
    @RequirePermissions('categories.manage')
    @ApiOperation({ summary: 'Create a category' })
    @ApiCreatedResponse({ description: 'Category created.' })
    @ApiBadRequestResponse({ description: 'Parent invalid or inactive.' })
    @ApiConflictResponse({ description: 'Sibling name clash.' })
    create(
        @Body() dto: CreateCategoryDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.categories.create(dto, actorId);
    }

    @Patch(':id')
    @RequirePermissions('categories.manage')
    @ApiOperation({ summary: 'Update a category' })
    @ApiOkResponse({ description: 'Category updated.' })
    @ApiNotFoundResponse({ description: 'Category not found.' })
    @ApiBadRequestResponse({ description: 'Cycle or self-parent.' })
    @ApiConflictResponse({ description: 'Sibling name clash.' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateCategoryDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.categories.update(id, dto, actorId);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('categories.manage')
    @ApiOperation({ summary: 'Soft-delete a category' })
    @ApiOkResponse({ description: 'Category soft-deleted.' })
    @ApiNotFoundResponse({ description: 'Category not found.' })
    @ApiConflictResponse({ description: 'Has children or products.' })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.categories.remove(id, actorId);
    }
}