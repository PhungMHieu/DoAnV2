import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
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
    description:
      'Creates a new group with the specified name, owner name, and member names. Requires JWT authentication.',
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
        isLocked: { type: 'boolean', example: false },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'name is required',
        },
        statusCode: { type: 'number', example: 400 },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid JWT token',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Unauthorized' },
        statusCode: { type: 'number', example: 401 },
      },
    },
  })
  async createGroup(@Body() dto: CreateGroupDto, @Req() req: Request) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    return this.groupsService.createGroup(
      userId,
      dto.name.trim(),
      dto.ownerName.trim(),
    );
  }

  @Get('join/:code')
  @ApiOperation({
    summary: 'Get group by code',
    description:
      'Retrieves group information by its unique code for joining purposes',
  })
  @ApiParam({
    name: 'code',
    description: 'Unique group code',
    example: 'ABC123',
  })
  @ApiResponse({
    status: 200,
    description: 'Group information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        groupId: {
          type: 'string',
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
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
              joined: { type: 'boolean', example: true },
            },
          },
        },
      },
    },
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
    description:
      'Join an existing group using group code and your display name',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully joined the group',
    schema: {
      type: 'object',
      properties: {
        groupId: {
          type: 'string',
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
        memberId: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Alice' },
        userId: { type: 'string', example: 'user-123' },
        joined: { type: 'boolean', example: true },
        joinedAt: {
          type: 'string',
          format: 'date-time',
          example: '2024-12-09T12:00:00Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or already joined this group',
  })
  @ApiResponse({ status: 404, description: 'Group not found' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  async joinGroup(@Body() dto: JoinGroupDto, @Req() req: Request) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    const member = await this.groupsService.joinGroup(
      userId,
      dto.groupCode.trim(),
      dto.memberName.trim(),
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
    description:
      'Retrieves all groups that the current user is a member of, including member count',
  })
  @ApiResponse({
    status: 200,
    description: 'User groups retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: '123e4567-e89b-12d3-a456-426614174000',
          },
          name: { type: 'string', example: 'Family Budget Group' },
          code: { type: 'string', example: 'ABC123' },
          createdByUserId: {
            type: 'string',
            example: 'user-123',
            description: 'User ID of the group creator',
          },
          memberCount: {
            type: 'number',
            example: 5,
            description: 'Total number of members (joined + not joined)',
          },
          joinedMemberCount: {
            type: 'number',
            example: 3,
            description: 'Number of members who have joined',
          },
          members: {
            type: 'array',
            description: 'List of all members in the group',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number', example: 1 },
                name: { type: 'string', example: 'John' },
                userId: { type: 'string', nullable: true, example: 'user-123' },
                joined: { type: 'boolean', example: true },
                joinedAt: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true,
                  example: '2024-12-09T12:00:00Z',
                },
              },
            },
          },
        },
      },
    },
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
      createdByUserId: g.createdByUserId,
      memberCount: g.members?.length || 0,
      joinedMemberCount: g.members?.filter((m) => m.joined).length || 0,
      members:
        g.members?.map((m) => ({
          id: m.id,
          name: m.name,
          userId: m.userId,
          joined: m.joined,
          joinedAt: m.joinedAt,
        })) || [],
    }));
  }

  @Get(':groupId/my-member-id')
  @ApiOperation({
    summary: 'Get my member ID in a group',
    description:
      'Returns the member ID for the current user in the specified group',
  })
  @ApiParam({
    name: 'groupId',
    description: 'Group ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Member ID retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        memberId: { type: 'number', example: 1 },
        name: { type: 'string', example: 'John' },
        joined: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Member not found in this group' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  async getMyMemberId(@Param('groupId') groupId: string, @Req() req: Request) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    const member = await this.groupsService.getMemberByUserIdAndGroupId(
      userId,
      groupId,
    );

    return {
      memberId: member.id,
      name: member.name,
      joined: member.joined,
    };
  }

  @Get('members/:memberId/user-id')
  @ApiOperation({
    summary: 'Get userId for a member',
    description:
      'Returns the userId associated with a member ID (null if not joined)',
  })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  @ApiResponse({
    status: 200,
    description: 'UserId retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', nullable: true, example: 'user-123' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async getUserIdByMemberId(@Param('memberId') memberId: string) {
    const member = await this.groupsService.getMemberById(memberId);
    return { userId: member.userId };
  }

  @Get(':groupId/members/:memberId')
  @ApiOperation({
    summary: 'Get member info by member ID',
    description: 'Returns member information including id, name, and userId',
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
        userId: { type: 'string', nullable: true, example: 'user-123' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async getMemberInfo(
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
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

  @Post(':groupId/members')
  @ApiOperation({
    summary: 'Add a member to a group',
    description:
      'Adds a new member to a group. Can optionally link to an existing user.',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({
    status: 201,
    description: 'Member added successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'John Doe' },
        userId: { type: 'string', nullable: true, example: 'user-123' },
        joined: { type: 'boolean', example: true },
        joinedAt: { type: 'string', format: 'date-time', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'User is already a member' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  async addMember(
    @Param('groupId') groupId: string,
    @Body('memberName') memberName: string,
    @Body('userId') memberUserId: string | undefined,
    @Body('addedByMemberName') addedByMemberName: string | undefined,
    @Req() req: Request,
  ) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    if (!memberName || !memberName.trim()) {
      throw new BadRequestException('memberName is required');
    }

    const member = await this.groupsService.addMemberToGroup(
      groupId,
      memberName.trim(),
      memberUserId,
      userId, // addedByUserId - the current user adding the member
      addedByMemberName,
    );

    return {
      id: member.id,
      name: member.name,
      userId: member.userId,
      joined: member.joined,
      joinedAt: member.joinedAt,
    };
  }

  @Delete(':groupId/members/:memberId')
  @ApiOperation({
    summary: 'Remove a member from group',
    description:
      'Remove a member from the group. Only the group owner can remove members. Cannot remove yourself (use leave endpoint instead).',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiParam({ name: 'memberId', description: 'Member ID to remove' })
  @ApiResponse({
    status: 200,
    description: 'Member removed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Member removed successfully' },
        removedMemberId: { type: 'number', example: 123 },
        removedMemberName: { type: 'string', example: 'John' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Cannot remove yourself or not authorized' })
  @ApiResponse({ status: 404, description: 'Group or member not found' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  async removeMember(
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
    @Req() req: Request,
  ) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    const result = await this.groupsService.removeMemberFromGroup(
      userId,
      groupId,
      parseInt(memberId, 10),
    );

    return {
      message: 'Member removed successfully',
      ...result,
    };
  }

  @Post(':groupId/transfer-ownership')
  @ApiOperation({
    summary: 'Transfer group ownership',
    description:
      'Transfer ownership of the group to another joined member. Only the current owner can do this.',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({
    status: 200,
    description: 'Ownership transferred successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Ownership transferred successfully' },
        newOwnerId: { type: 'string', example: 'user-456' },
        newOwnerName: { type: 'string', example: 'Alice' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Only the group owner can transfer ownership' })
  @ApiResponse({ status: 404, description: 'Group or new owner not found' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  async transferOwnership(
    @Param('groupId') groupId: string,
    @Body('newOwnerUserId') newOwnerUserId: string,
    @Req() req: Request,
  ) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    if (!newOwnerUserId || !newOwnerUserId.trim()) {
      throw new BadRequestException('newOwnerUserId is required');
    }

    const result = await this.groupsService.transferOwnership(
      userId,
      groupId,
      newOwnerUserId.trim(),
    );

    return {
      message: 'Ownership transferred successfully',
      ...result,
    };
  }

  @Delete(':groupId/leave')
  @ApiOperation({
    summary: 'Leave a group',
    description:
      'Current user leaves the specified group. If the owner leaves, ownership transfers to the next oldest member. If no members remain, the group is deleted.',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({
    status: 200,
    description: 'Successfully left the group',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Successfully left the group' },
        transferred: { type: 'boolean', example: false, description: 'Whether ownership was transferred' },
        newOwnerId: { type: 'string', nullable: true, description: 'New owner userId if transferred' },
        deleted: { type: 'boolean', example: false, description: 'Whether the group was deleted' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Not a member of this group' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  async leaveGroup(@Param('groupId') groupId: string, @Req() req: Request) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    const result = await this.groupsService.leaveGroup(userId, groupId);

    return {
      message: result.deleted
        ? 'Group deleted (no members remaining)'
        : result.transferred
          ? 'Successfully left the group and ownership transferred'
          : 'Successfully left the group',
      ...result,
    };
  }

  @Delete(':groupId')
  @ApiOperation({
    summary: 'Delete a group',
    description:
      'Deletes the specified group and all its members. Only the group creator can delete.',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({
    status: 200,
    description: 'Group deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Group deleted successfully' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Only the group creator can delete this group',
  })
  @ApiResponse({ status: 404, description: 'Group not found' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  async deleteGroup(@Param('groupId') groupId: string, @Req() req: Request) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    await this.groupsService.deleteGroup(userId, groupId);

    return { message: 'Group deleted successfully' };
  }

  // ========== Invitation Endpoints ==========

  @Post(':groupId/invitations')
  @ApiOperation({
    summary: 'Invite a user to a group',
    description:
      'Send an invitation to a user to join a group. The invited user can accept or reject.',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({
    status: 201,
    description: 'Invitation sent successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        invitedUserId: { type: 'string', example: 'user-456' },
        suggestedMemberName: { type: 'string', example: 'John Doe' },
        status: { type: 'string', example: 'pending' },
        expiresAt: { type: 'string', format: 'date-time', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'User is already a member or has pending invitation' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  async inviteUserToGroup(
    @Param('groupId') groupId: string,
    @Body('invitedUserId') invitedUserId: string,
    @Body('suggestedMemberName') suggestedMemberName: string,
    @Body('invitedByMemberName') invitedByMemberName: string | undefined,
    @Body('expiresInDays') expiresInDays: number | undefined,
    @Req() req: Request,
  ) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    if (!invitedUserId || !invitedUserId.trim()) {
      throw new BadRequestException('invitedUserId is required');
    }

    if (!suggestedMemberName || !suggestedMemberName.trim()) {
      throw new BadRequestException('suggestedMemberName is required');
    }

    const invitation = await this.groupsService.inviteUserToGroup(
      groupId,
      invitedUserId.trim(),
      suggestedMemberName.trim(),
      userId,
      invitedByMemberName?.trim(),
      expiresInDays,
    );

    return {
      id: invitation.id,
      invitedUserId: invitation.invitedUserId,
      suggestedMemberName: invitation.suggestedMemberName,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    };
  }

  @Get(':groupId/invitations')
  @ApiOperation({
    summary: 'Get pending invitations for a group',
    description: 'Returns all pending invitations for the specified group.',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({
    status: 200,
    description: 'Pending invitations retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number', example: 1 },
          invitedUserId: { type: 'string', example: 'user-456' },
          suggestedMemberName: { type: 'string', example: 'John Doe' },
          invitedByUserId: { type: 'string', example: 'user-123' },
          invitedByMemberName: { type: 'string', nullable: true, example: 'Alice' },
          status: { type: 'string', example: 'pending' },
          expiresAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  async getGroupInvitations(@Param('groupId') groupId: string) {
    const invitations = await this.groupsService.getPendingInvitationsForGroup(groupId);

    return invitations.map((inv) => ({
      id: inv.id,
      invitedUserId: inv.invitedUserId,
      suggestedMemberName: inv.suggestedMemberName,
      invitedByUserId: inv.invitedByUserId,
      invitedByMemberName: inv.invitedByMemberName,
      status: inv.status,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    }));
  }

  @Delete(':groupId/invitations/:invitationId')
  @ApiOperation({
    summary: 'Cancel an invitation',
    description:
      'Cancel a pending invitation. Only the inviter or group owner can cancel.',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiParam({ name: 'invitationId', description: 'Invitation ID' })
  @ApiResponse({
    status: 200,
    description: 'Invitation cancelled successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Invitation cancelled successfully' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Not authorized or invitation already responded' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  async cancelInvitation(
    @Param('groupId') _groupId: string,
    @Param('invitationId') invitationId: string,
    @Req() req: Request,
  ) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    await this.groupsService.cancelInvitation(parseInt(invitationId, 10), userId);

    return { message: 'Invitation cancelled successfully' };
  }

  @Get('invitations/my')
  @ApiOperation({
    summary: 'Get my pending invitations',
    description: 'Returns all pending invitations for the current user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Pending invitations retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number', example: 1 },
          groupId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
          groupName: { type: 'string', example: 'Family Budget Group' },
          groupCode: { type: 'string', example: 'ABC123' },
          suggestedMemberName: { type: 'string', example: 'John Doe' },
          invitedByUserId: { type: 'string', example: 'user-123' },
          invitedByMemberName: { type: 'string', nullable: true, example: 'Alice' },
          status: { type: 'string', example: 'pending' },
          expiresAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  async getMyInvitations(@Req() req: Request) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    const invitations = await this.groupsService.getPendingInvitationsForUser(userId);

    return invitations.map((inv) => ({
      id: inv.id,
      groupId: inv.group.id,
      groupName: inv.group.name,
      groupCode: inv.group.code,
      suggestedMemberName: inv.suggestedMemberName,
      invitedByUserId: inv.invitedByUserId,
      invitedByMemberName: inv.invitedByMemberName,
      status: inv.status,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    }));
  }

  @Post('invitations/:invitationId/accept')
  @ApiOperation({
    summary: 'Accept an invitation',
    description:
      'Accept a pending invitation and join the group. Optionally provide a custom member name.',
  })
  @ApiParam({ name: 'invitationId', description: 'Invitation ID' })
  @ApiResponse({
    status: 200,
    description: 'Invitation accepted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Successfully joined the group' },
        groupId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        memberId: { type: 'number', example: 1 },
        memberName: { type: 'string', example: 'John Doe' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invitation not for you, expired, or already responded' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  async acceptInvitation(
    @Param('invitationId') invitationId: string,
    @Body('memberName') memberName: string | undefined,
    @Req() req: Request,
  ) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    const member = await this.groupsService.acceptInvitation(
      parseInt(invitationId, 10),
      userId,
      memberName?.trim(),
    );

    return {
      message: 'Successfully joined the group',
      groupId: member.group?.id,
      memberId: member.id,
      memberName: member.name,
    };
  }

  @Post('invitations/:invitationId/reject')
  @ApiOperation({
    summary: 'Reject an invitation',
    description: 'Reject a pending invitation.',
  })
  @ApiParam({ name: 'invitationId', description: 'Invitation ID' })
  @ApiResponse({
    status: 200,
    description: 'Invitation rejected successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Invitation rejected' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invitation not for you or already responded' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  async rejectInvitation(
    @Param('invitationId') invitationId: string,
    @Req() req: Request,
  ) {
    const userId = getUserIdFromRequest(req);
    if (!userId) throw new BadRequestException('Missing or invalid JWT token');

    await this.groupsService.rejectInvitation(parseInt(invitationId, 10), userId);

    return { message: 'Invitation rejected' };
  }
}
