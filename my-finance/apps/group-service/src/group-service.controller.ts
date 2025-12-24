import { BadRequestException, Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { GroupServiceService } from './group-service.service';
import { getUserIdFromRequest } from '@app/common/middleware/jwt-extract.middleware';
import { CreateGroupDto, JoinGroupDto } from './dto';
import type { Request } from 'express';
@ApiTags('Groups')
@ApiBearerAuth('access-token')
@Controller()
export class GroupServiceController {
   constructor(private readonly groupsService: GroupServiceService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new group',
    description: 'Creates a new group with the specified name, owner name, and member names. Requires JWT authentication.'
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
    description: 'Unauthorized - Missing or invalid JWT token',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Unauthorized' },
        statusCode: { type: 'number', example: 401 }
      }
    }
  })
  async createGroup(@Body() dto: CreateGroupDto, @Req() req: Request) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    return this.groupsService.createGroup(
      userId,
      dto.name.trim(),
      dto.ownerName.trim()
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
    description: 'Join an existing group using group code and your display name'
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully joined the group',
    schema: {
      type: 'object',
      properties: {
        groupId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        memberId: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Alice' },
        userId: { type: 'string', example: 'user-123' },
        joined: { type: 'boolean', example: true },
        joinedAt: { type: 'string', format: 'date-time', example: '2024-12-09T12:00:00Z' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid input data or already joined this group' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  async joinGroup(@Body() dto: JoinGroupDto, @Req() req: Request) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    const member = await this.groupsService.joinGroup(
      userId,
      dto.groupCode.trim(),
      dto.memberName.trim()
    );

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
    description: 'Retrieves all groups that the current user is a member of, including member count'
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
          code: { type: 'string', example: 'ABC123' },
          memberCount: { type: 'number', example: 5, description: 'Total number of members (joined + not joined)' },
          joinedMemberCount: { type: 'number', example: 3, description: 'Number of members who have joined' }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  async getMyGroups(@Req() req: Request) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    const groups = await this.groupsService.getGroupsOfUser(userId);
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      code: g.code,
      memberCount: g.members?.length || 0,
      joinedMemberCount: g.members?.filter((m) => m.joined).length || 0,
    }));
  }

  @Get(':groupId/my-member-id')
  @ApiOperation({
    summary: 'Get my member ID in a group',
    description: 'Returns the member ID for the current user in the specified group'
  })
  @ApiParam({
    name: 'groupId',
    description: 'Group ID',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'Member ID retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        memberId: { type: 'number', example: 1 },
        name: { type: 'string', example: 'John' },
        joined: { type: 'boolean', example: true }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Member not found in this group' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  async getMyMemberId(@Param('groupId') groupId: string, @Req() req: Request) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    const member = await this.groupsService.getMemberByUserIdAndGroupId(userId, groupId);

    return {
      memberId: member.id,
      name: member.name,
      joined: member.joined,
    };
  }

  @Get('members/:memberId/user-id')
  @ApiOperation({
    summary: 'Get userId for a member',
    description: 'Returns the userId associated with a member ID (null if not joined)'
  })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  @ApiResponse({
    status: 200,
    description: 'UserId retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', nullable: true, example: 'user-123' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async getUserIdByMemberId(@Param('memberId') memberId: string) {
    const member = await this.groupsService.getMemberById(memberId);
    return { userId: member.userId };
  }

  @Get(':groupId/members/:memberId')
  @ApiOperation({
    summary: 'Get member info by member ID',
    description: 'Returns member information including id, name, and userId'
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  @ApiResponse({
    status: 200,
    description: 'Member info retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Nam' },
        userId: { type: 'string', nullable: true, example: 'user-123' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async getMemberInfo(
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string
  ) {
    // Get member with group relation to verify groupId
    const member = await this.groupsService.getMemberByIdWithGroup(memberId);

    // Verify member belongs to this group
    if (member.group.id !== groupId) {
      throw new Error('Member does not belong to this group');
    }

    return {
      id: member.id,
      name: member.name,
      userId: member.userId,
    };
  }
}
