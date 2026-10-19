//src/modules/users/dto/assign-roles.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class AssignRolesDto {
    @ApiProperty({
        type: [String],
        description:
            'Complete set of Role IDs for this user. Replaces existing assignments — empty array clears all roles.',
    })
    @IsArray()
    @IsUUID(undefined, { each: true })
    RoleIds!: string[];
}