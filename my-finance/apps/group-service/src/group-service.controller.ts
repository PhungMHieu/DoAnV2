import { BadRequestException, Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiHeader } from '@nestjs/swagger';
import { GroupServiceService } from './group-service.service';

@ApiTags('Groups')
@ApiHeader({
  name: 'x-user-id',
  description: 'User ID for authentication',
  required: true,
  schema: { type: 'string' }
})
@Controller()
export class GroupServiceController {
   constructor(private readonly groupsService: GroupServiceService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create a new group',
    description: 'Creates a new group with the specified name, owner name, and member names. Requires x-user-id header for authentication.'
  })
  @ApiBody({
    description: 'Group creation data',
    schema: {
      type: 'object',
      properties: {
        name: { 
          type: 'string', 
          example: 'Family Budget Group',
          description: 'Name of the group (required, non-empty string)'
        },
        ownerName: {
          type: 'string',
          example: 'Admin User',
          description: 'Display name of the group owner/creator (required, non-empty string)'
        },
        memberNames: { 
          type: 'array', 
          items: { type: 'string' },
          example: ['John Doe', 'Jane Smith', 'Bob Wilson'],
          description: 'Array of member names to add to the group (required, non-empty array of non-empty strings)',
          minItems: 1
        }
      },
      required: ['name', 'ownerName', 'memberNames']
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Group created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        name: { type: 'string', example: 'Family Budget Group' },
        code: { type: 'string', example: 'ABC123' },
        createdByUserId: { type: 'string', example: 'user-123' },
        isLocked: { type: 'boolean', example: false }
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad Request - Invalid input data',
    schema: {
      type: 'object',
      properties: {
        message: { 
          type: 'string', 
          example: 'name is required'
        },
        statusCode: { type: 'number', example: 400 }
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Missing or invalid x-user-id header',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Unauthorized' },
        statusCode: { type: 'number', example: 401 }
      }
    }
  })
  async createGroup(@Body() body: any, @Req() req: Request) {
    const userId = req.headers['x-user-id'] as string;

    const name = body?.name;
    const ownerName = body?.ownerName;
    const memberNames = body?.memberNames;

    if (typeof name !== 'string' || !name.trim()) {
      throw new BadRequestException('name is required');
    }
    if (typeof ownerName !== 'string' || !ownerName.trim()) {
      throw new BadRequestException('ownerName is required');
    }
    if (!Array.isArray(memberNames) || memberNames.length === 0) {
      throw new BadRequestException('memberNames must be a non-empty array');
    }
    if (memberNames.some((x) => typeof x !== 'string' || !x.trim())) {
      throw new BadRequestException('memberNames must be array of non-empty strings');
    }

    return this.groupsService.createGroup(
      userId, 
      name.trim(), 
      ownerName.trim(),
      memberNames.map((x) => x.trim())
    );
  }

  @Get('join/:code')
  @ApiOperation({ 
    summary: 'Get group by code',
    description: 'Retrieves group information by its unique code for joining purposes'
  })
  @ApiParam({
    name: 'code',
    description: 'Unique group code',
    example: 'ABC123'
  })
  @ApiResponse({
    status: 200,
    description: 'Group information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        groupId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        name: { type: 'string', example: 'Family Budget Group' },
        code: { type: 'string', example: 'ABC123' },
        isLocked: { type: 'boolean', example: false },
        members: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 1 },
              name: { type: 'string', example: 'John' },
              userId: { type: 'string', example: 'user-123', nullable: true },
              joined: { type: 'boolean', example: true }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Group not found' })
  async getGroupByCode(@Param('code') code: string) {
    const group = await this.groupsService.getGroupByCode(code);

    return {
      groupId: group.id,
      name: group.name,
      code: group.code,
      isLocked: group.isLocked,
      members: group.members.map((m) => ({
        id: m.id,
        name: m.name,
        userId: m.userId,
        joined: m.joined,
      })),
    };
  }

  @Post('join')
  @ApiOperation({ 
    summary: 'Join a group',
    description: 'Join an existing group using group code and member ID'
  })
  @ApiBody({
    description: 'Join group data',
    schema: {
      type: 'object',
      properties: {
        groupCode: { 
          type: 'string', 
          example: 'ABC123',
          description: 'Unique code of the group to join'
        },
        memberId: { 
          type: 'string', 
          example: '1',
          description: 'ID of the member slot to occupy in the group'
        }
      },
      required: ['groupCode', 'memberId']
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully joined the group',
    schema: {
      type: 'object',
      properties: {
        groupId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        memberId: { type: 'number', example: 1 },
        name: { type: 'string', example: 'John' },
        userId: { type: 'string', example: 'user-123' },
        joined: { type: 'boolean', example: true },
        joinedAt: { type: 'string', format: 'date-time', example: '2024-12-09T12:00:00Z' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid input data or member slot already taken' })
  @ApiResponse({ status: 404, description: 'Group or member not found' })
  @ApiResponse({ status: 401, description: 'Missing x-user-id header' })
  async joinGroup(@Body() body: any, @Req() req: Request) {
    const userId = req.headers['x-user-id'] as string;

    const groupCode = body?.groupCode;
    const memberId = body?.memberId;

    if (typeof groupCode !== 'string' || !groupCode.trim()) {
      throw new BadRequestException('groupCode is required');
    }
    if (typeof memberId !== 'string' || !memberId.trim()) {
      throw new BadRequestException('memberId is required');
    }

    const member = await this.groupsService.joinGroupByCode(groupCode.trim(), memberId.trim(), userId);

    return {
      groupId: member.group?.id,
      memberId: member.id,
      name: member.name,
      userId: member.userId,
      joined: member.joined,
      joinedAt: member.joinedAt,
    };
  }

  @Get('my')
  @ApiOperation({ 
    summary: 'Get my groups',
    description: 'Retrieves all groups that the current user is a member of'
  })
  @ApiResponse({
    status: 200,
    description: 'User groups retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
          name: { type: 'string', example: 'Family Budget Group' },
          code: { type: 'string', example: 'ABC123' }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Missing x-user-id header' })
  async getMyGroups(@Req() req: Request) {
    const userId = req.headers['x-user-id'] as string;
    const groups = await this.groupsService.getGroupsOfUser(userId);
    return groups.map((g) => ({ id: g.id, name: g.name, code: g.code }));
  }
}
