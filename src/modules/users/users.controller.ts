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
import { AssignRolesDto } from './dto/assign-roles.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiCookieAuth('cookie-auth')
@Controller('users')
export class UsersController {
    constructor(private readonly users: UsersService) {}

    @Get()
    @RequirePermissions('users.view')
    @ApiOperation({
        summary: 'List users (paginated)',
        description: 'Filters: IsActive, RoleId, search, includeDeleted.',
    })
    @ApiOkResponse({ description: 'Paginated user list.' })
    list(@Query() query: QueryUserDto) {
        return this.users.list(query);
    }

    @Get('roles')
    @RequirePermissions('users.view')
    @ApiOperation({
        summary: 'List available roles (for user form dropdowns)',
    })
    @ApiOkResponse({ description: 'Role list.' })
    listRoles() {
        return this.users.listRoles();
    }

    @Get(':id')
    @RequirePermissions('users.view')
    @ApiOperation({ summary: 'Get one user with roles' })
    @ApiOkResponse({ description: 'User detail.' })
    @ApiNotFoundResponse({ description: 'User not found.' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.users.findOne(id);
    }

    @Post()
    @RequirePermissions('users.create')
    @ApiOperation({
        summary: 'Create a user',
        description:
            'At least one role required. Username is immutable after creation.',
    })
    @ApiCreatedResponse({ description: 'User created.' })
    @ApiBadRequestResponse({ description: 'Invalid role IDs.' })
    @ApiConflictResponse({ description: 'Username or email in use.' })
    create(
        @Body() dto: CreateUserDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.users.create(dto, actorId);
    }

    @Patch(':id')
    @RequirePermissions('users.update')
    @ApiOperation({
        summary: 'Update user basic fields',
        description:
            'FullName, Email, IsActive only. Deactivation bumps SessionVersion — user is logged out.',
    })
    @ApiOkResponse({ description: 'User updated.' })
    @ApiNotFoundResponse({ description: 'User not found.' })
    @ApiConflictResponse({ description: 'Email in use.' })
    @ApiForbiddenResponse({ description: 'Cannot deactivate self or superadmin.' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateUserDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.users.update(id, dto, actorId);
    }

    @Post(':id/roles')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('users.update')
    @ApiOperation({
        summary: 'Assign roles (replaces existing set)',
        description:
            'Bumps SessionVersion — target user is logged out so the new permissions take effect. Guards against removing the last ADMIN or your own ADMIN role.',
    })
    @ApiOkResponse({ description: 'Roles assigned.' })
    @ApiNotFoundResponse({ description: 'User not found.' })
    @ApiBadRequestResponse({ description: 'Invalid role IDs.' })
    @ApiForbiddenResponse({ description: 'Last-admin or self-admin guard.' })
    assignRoles(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: AssignRolesDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.users.assignRoles(id, dto, actorId);
    }

    @Post('me/change-password')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Change your own password',
        description:
            'Requires the current password. Bumps SessionVersion — every session for this user is invalidated. Frontend must redirect to login.',
    })
    @ApiOkResponse({ description: 'Password changed.' })
    @ApiBadRequestResponse({ description: 'Old password incorrect.' })
    changeOwnPassword(
        @Body() dto: ChangePasswordDto,
        @CurrentUser('userId') userId: string,
    ) {
        return this.users.changeOwnPassword(userId, dto);
    }

    @Post(':id/reset-password')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('users.update')
    @ApiOperation({
        summary: 'Reset another user\'s password (admin)',
        description:
            'Does not require the old password. Bumps SessionVersion — target user is logged out.',
    })
    @ApiOkResponse({ description: 'Password reset.' })
    @ApiNotFoundResponse({ description: 'User not found.' })
    resetPassword(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ResetPasswordDto,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.users.resetPassword(id, dto, actorId);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @RequirePermissions('users.delete')
    @ApiOperation({
        summary: 'Soft-delete a user',
        description:
            'Revokes all sessions. Guards: cannot delete self, cannot delete superadmin, cannot delete the last ADMIN.',
    })
    @ApiOkResponse({ description: 'User deleted.' })
    @ApiNotFoundResponse({ description: 'User not found.' })
    @ApiForbiddenResponse({ description: 'Self, superadmin, or last-admin guard.' })
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('userId') actorId: string,
    ) {
        return this.users.remove(id, actorId);
    }
}