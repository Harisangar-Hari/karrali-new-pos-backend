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
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { QueryExpenseCategoryDto } from './dto/query-expense-category.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';
import { ExpenseCategoriesService } from './expense-categories.service';

@ApiTags('expense-categories')
@ApiCookieAuth('cookie-auth')
@Controller('expense-categories')
export class ExpenseCategoriesController {
    constructor(private readonly categories: ExpenseCategoriesService) {}

    @Get()
    @RequirePermissions('expense_categories.view')
    @ApiOperation({ summary: 'List expense categories' })
    @ApiOkResponse({ description: 'Paginated category list.' })
    list(@Query() query: QueryExpenseCategoryDto) {
        return this.categories.list(query);
    }

    @Get(':id')
    @RequirePermissions('expense_categories.view')
    @ApiOperation({ summary: 'Get one expense category' })
    @ApiNotFoundResponse({ description: 'Category not found.' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.categories.findOne(id);
    }

    @Post()
    @RequirePermissions('expense_categories.manage')
    @ApiOperation({ summary: 'Create an expense category' })
    @ApiCreatedResponse({ description: 'Category created.' })
    @ApiConflictResponse({ description: 'Name in use.' })
    create(
        @Body() dto: CreateExpenseCategoryDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.categories.create(dto, actorId);
    }

    @Patch(':id')
    @RequirePermissions('expense_categories.manage')
    @ApiOperation({ summary: 'Update an expense category' })
    @ApiOkResponse({ description: 'Category updated.' })
    @ApiConflictResponse({ description: 'Name in use.' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateExpenseCategoryDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.categories.update(id, dto, actorId);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('expense_categories.manage')
    @ApiOperation({ summary: 'Soft-delete an expense category' })
    @ApiOkResponse({ description: 'Category soft-deleted.' })
    @ApiConflictResponse({ description: 'Referenced by expenses.' })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.categories.remove(id, actorId);
    }
}