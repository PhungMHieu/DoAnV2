import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Group } from './entities/group.entity';
import { GroupMember } from './entities/GroupMember.entity';
import { GroupInvitation, InvitationStatus } from './entities/group-invitation.entity';
import { GroupWebSocketGateway } from '@app/websocket-common';

@Injectable()
export class GroupServiceService {
  constructor(
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,

    @InjectRepository(GroupMember)
    private readonly groupMemberRepository: Repository<GroupMember>,

    @InjectRepository(GroupInvitation)
    private readonly invitationRepository: Repository<GroupInvitation>,

    private readonly dataSource: DataSource,

    private readonly wsGateway: GroupWebSocketGateway,
  ) {}
  async createGroup(
    createdByUserId: string,
    name: string,
    ownerName: string,
  ): Promise<Group> {
    const group = this.groupRepository.create({
      name,
      createdByUserId,
      code: this.generateGroupCode(),
    });

    const savedGroup = await this.groupRepository.save(group);

    // Tạo member cho owner (người tạo) - đã join sẵn
    const ownerMember = this.groupMemberRepository.create({
      name: ownerName,
      group: savedGroup,
      userId: createdByUserId,
      joined: true,
      joinedAt: new Date(),
    });

    await this.groupMemberRepository.save(ownerMember);

    // Trả về group với members
    const fullGroup = await this.getGroupByCode(savedGroup.code);

    return fullGroup;
  }

  async joinGroup(
    userId: string,
    groupCode: string,
    memberName: string,
  ): Promise<GroupMember> {
    const group = await this.groupRepository.findOne({
      where: { code: groupCode },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check if user already joined this group
    const existingMember = await this.groupMemberRepository.findOne({
      where: { group: { id: group.id }, userId },
    });

    if (existingMember) {
      throw new BadRequestException('You have already joined this group');
    }

    // Create new member
    const newMember = this.groupMemberRepository.create({
      name: memberName,
      group,
      userId,
      joined: true,
      joinedAt: new Date(),
    });

    const savedMember = await this.groupMemberRepository.save(newMember);

    // Emit WebSocket event for member joined
    this.wsGateway.emitMemberJoined({
      groupId: group.id,
      memberId: String(savedMember.id),
      memberName: savedMember.name,
      userId: savedMember.userId,
      action: 'joined',
      timestamp: new Date(),
    });

    return savedMember;
  }

  async getGroupByCode(code: string): Promise<Group> {
    const group = await this.groupRepository.findOne({
      where: { code },
      relations: ['members'],
    });
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    return group;
  }

  async getGroupsOfUser(userId: string): Promise<Group[]> {
    // lấy tất cả group mà có member.userId = userId
    const members = await this.groupMemberRepository.find({
      where: { userId },
      relations: ['group', 'group.members'], // Load cả members của group
    });

    return members.map((m) => m.group);
  }

  async getMemberByUserIdAndGroupId(
    userId: string,
    groupId: string,
  ): Promise<GroupMember> {
    const member = await this.groupMemberRepository.findOne({
      where: {
        userId,
        group: { id: groupId },
      },
    });

    if (!member) {
      throw new NotFoundException('You are not a member of this group');
    }

    return member;
  }

  async getMemberById(memberId: string): Promise<GroupMember> {
    const member = await this.groupMemberRepository.findOne({
      where: { id: parseInt(memberId) },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    return member;
  }

  async getMemberByIdWithGroup(memberId: string): Promise<GroupMember> {
    const member = await this.groupMemberRepository.findOne({
      where: { id: parseInt(memberId) },
      relations: ['group'],
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    return member;
  }

  async leaveGroup(userId: string, groupId: string): Promise<{ transferred?: boolean; newOwnerId?: string; newOwnerName?: string; deleted?: boolean }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Lock the group row to prevent race conditions
      const group = await queryRunner.manager.findOne(Group, {
        where: { id: groupId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!group) {
        throw new NotFoundException('Group not found');
      }

      // Find member with lock
      const member = await queryRunner.manager.findOne(GroupMember, {
        where: { userId, group: { id: groupId } },
        lock: { mode: 'pessimistic_write' },
      });

      if (!member) {
        throw new NotFoundException('You are not a member of this group');
      }

      const isOwner = group.createdByUserId === userId;

      // Remove current member
      await queryRunner.manager.remove(member);

      let result: { transferred?: boolean; newOwnerId?: string; newOwnerName?: string; deleted?: boolean } = {};

      // If user is the group creator, transfer ownership or delete group
      if (isOwner) {
        // Find another joined member to transfer ownership (must have userId)
        const otherMembers = await queryRunner.manager.find(GroupMember, {
          where: { group: { id: groupId }, joined: true },
          order: { joinedAt: 'ASC' }, // Oldest member first
          lock: { mode: 'pessimistic_write' },
        });

        // Filter members with valid userId
        const eligibleMembers = otherMembers.filter((m) => m.userId);

        if (eligibleMembers.length > 0) {
          // Transfer ownership to the oldest eligible member
          const newOwner = eligibleMembers[0];
          group.createdByUserId = newOwner.userId!;
          await queryRunner.manager.save(group);

          result = { transferred: true, newOwnerId: newOwner.userId!, newOwnerName: newOwner.name };
        } else {
          // No eligible members left, delete all remaining members and the group
          const remainingMembers = await queryRunner.manager.find(GroupMember, {
            where: { group: { id: groupId } },
          });

          if (remainingMembers.length > 0) {
            await queryRunner.manager.remove(remainingMembers);
          }
          await queryRunner.manager.remove(group);

          result = { deleted: true };
        }
      }

      await queryRunner.commitTransaction();

      // Emit WebSocket events after successful transaction
      if (result.deleted) {
        this.wsGateway.emitGroupDeleted({
          groupId,
          deletedByUserId: userId,
          timestamp: new Date(),
        });
      } else if (result.transferred) {
        this.wsGateway.emitOwnershipTransferred({
          groupId,
          previousOwnerId: userId,
          newOwnerId: result.newOwnerId!,
          newOwnerMemberId: '', // Not available here
          newOwnerName: result.newOwnerName!,
          timestamp: new Date(),
        });
      }

      // Emit member left event
      this.wsGateway.emitMemberLeft({
        groupId,
        memberId: String(member.id),
        memberName: member.name,
        userId: member.userId,
        action: 'left',
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async addMemberToGroup(
    groupId: string,
    memberName: string,
    userId?: string,
    addedByUserId?: string,
    addedByMemberName?: string,
  ): Promise<GroupMember> {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // If userId is provided, check if user already has a member in this group
    if (userId) {
      const existingMember = await this.groupMemberRepository.findOne({
        where: { group: { id: groupId }, userId },
      });

      if (existingMember) {
        throw new BadRequestException('User is already a member of this group');
      }
    }

    // Create new member
    const newMember = this.groupMemberRepository.create({
      name: memberName,
      group,
      userId: userId || null,
      joined: !!userId, // If userId provided, mark as joined
      joinedAt: userId ? new Date() : null,
    });

    const savedMember = await this.groupMemberRepository.save(newMember);

    // Emit WebSocket event for member added (to group room)
    this.wsGateway.emitMemberAdded({
      groupId,
      memberId: String(savedMember.id),
      memberName: savedMember.name,
      userId: savedMember.userId,
      action: 'added',
      timestamp: new Date(),
    });

    // Emit event to the added user's personal room (if they have userId)
    if (savedMember.userId) {
      this.wsGateway.emitUserAddedToGroup({
        userId: savedMember.userId,
        groupId: group.id,
        groupName: group.name,
        groupCode: group.code,
        memberId: String(savedMember.id),
        memberName: savedMember.name,
        addedByUserId: addedByUserId || '',
        addedByMemberName: addedByMemberName,
        timestamp: new Date(),
      });
    }

    return savedMember;
  }

  async removeMemberFromGroup(
    requestingUserId: string,
    groupId: string,
    memberId: number,
  ): Promise<{ removedMemberId: number; removedMemberName: string }> {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      relations: ['members'],
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Only group owner can remove members
    if (group.createdByUserId !== requestingUserId) {
      throw new BadRequestException('Only the group owner can remove members');
    }

    // Find the member to remove
    const memberToRemove = group.members.find((m) => m.id === memberId);
    if (!memberToRemove) {
      throw new NotFoundException('Member not found in this group');
    }

    // Cannot remove yourself (use leave endpoint instead)
    if (memberToRemove.userId === requestingUserId) {
      throw new BadRequestException(
        'Cannot remove yourself. Use the leave endpoint instead.',
      );
    }

    const removedMemberName = memberToRemove.name;

    // Remove the member
    await this.groupMemberRepository.remove(memberToRemove);

    // Emit WebSocket event for member removed
    this.wsGateway.emitMemberRemoved({
      groupId,
      memberId: String(memberId),
      memberName: removedMemberName,
      userId: memberToRemove.userId,
      action: 'removed',
      timestamp: new Date(),
    });

    return {
      removedMemberId: memberId,
      removedMemberName,
    };
  }

  async transferOwnership(
    currentOwnerId: string,
    groupId: string,
    newOwnerUserId: string,
  ): Promise<{ newOwnerId: string; newOwnerName: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Lock the group row to prevent race conditions
      const group = await queryRunner.manager.findOne(Group, {
        where: { id: groupId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!group) {
        throw new NotFoundException('Group not found');
      }

      // Check if current user is the owner
      if (group.createdByUserId !== currentOwnerId) {
        throw new BadRequestException('Only the group owner can transfer ownership');
      }

      // Check if new owner is different from current owner
      if (currentOwnerId === newOwnerUserId) {
        throw new BadRequestException('Cannot transfer ownership to yourself');
      }

      // Find new owner member in this group
      const newOwnerMember = await queryRunner.manager.findOne(GroupMember, {
        where: { userId: newOwnerUserId, group: { id: groupId }, joined: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!newOwnerMember) {
        throw new NotFoundException('New owner is not a joined member of this group');
      }

      // Transfer ownership
      group.createdByUserId = newOwnerUserId;
      await queryRunner.manager.save(group);

      await queryRunner.commitTransaction();

      const result = {
        newOwnerId: newOwnerUserId,
        newOwnerName: newOwnerMember.name,
      };

      // Emit WebSocket event for ownership transferred
      this.wsGateway.emitOwnershipTransferred({
        groupId,
        previousOwnerId: currentOwnerId,
        newOwnerId: newOwnerUserId,
        newOwnerMemberId: String(newOwnerMember.id),
        newOwnerName: newOwnerMember.name,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async deleteGroup(userId: string, groupId: string): Promise<void> {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      relations: ['members'],
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Only group creator can delete the group
    if (group.createdByUserId !== userId) {
      throw new BadRequestException(
        'Only the group creator can delete this group',
      );
    }

    // Delete all members first
    if (group.members && group.members.length > 0) {
      await this.groupMemberRepository.remove(group.members);
    }

    // Delete the group
    await this.groupRepository.remove(group);

    // Emit WebSocket event for group deleted
    this.wsGateway.emitGroupDeleted({
      groupId,
      deletedByUserId: userId,
      timestamp: new Date(),
    });
  }

  private generateGroupCode(): string {
    // TODO: random code, kiểm tra unique
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // ========== Invitation Methods ==========

  /**
   * Send an invitation to a user to join a group
   */
  async inviteUserToGroup(
    groupId: string,
    invitedUserId: string,
    suggestedMemberName: string,
    invitedByUserId: string,
    invitedByMemberName?: string,
    expiresInDays?: number,
  ): Promise<GroupInvitation> {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check if user is already a member
    const existingMember = await this.groupMemberRepository.findOne({
      where: { group: { id: groupId }, userId: invitedUserId },
    });

    if (existingMember) {
      throw new BadRequestException('User is already a member of this group');
    }

    // Check if there's already a pending invitation
    const existingInvitation = await this.invitationRepository.findOne({
      where: {
        group: { id: groupId },
        invitedUserId,
        status: InvitationStatus.PENDING,
      },
    });

    if (existingInvitation) {
      throw new BadRequestException('User already has a pending invitation to this group');
    }

    // Create invitation
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const invitation = this.invitationRepository.create({
      group,
      invitedUserId,
      suggestedMemberName,
      invitedByUserId,
      invitedByMemberName: invitedByMemberName || null,
      status: InvitationStatus.PENDING,
      expiresAt,
    });

    const savedInvitation = await this.invitationRepository.save(invitation);

    // Emit WebSocket event to the invited user
    this.wsGateway.emitGroupInvitation({
      invitationId: savedInvitation.id,
      userId: invitedUserId,
      groupId: group.id,
      groupName: group.name,
      groupCode: group.code,
      suggestedMemberName,
      invitedByUserId,
      invitedByMemberName,
      expiresAt: expiresAt || undefined,
      timestamp: new Date(),
    });

    return savedInvitation;
  }

  /**
   * Accept an invitation and join the group
   */
  async acceptInvitation(
    invitationId: number,
    userId: string,
    memberName?: string,
  ): Promise<GroupMember> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId },
      relations: ['group'],
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.invitedUserId !== userId) {
      throw new BadRequestException('This invitation is not for you');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(`Invitation has already been ${invitation.status}`);
    }

    // Check if invitation expired
    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      invitation.status = InvitationStatus.EXPIRED;
      await this.invitationRepository.save(invitation);
      throw new BadRequestException('Invitation has expired');
    }

    // Check if user is already a member (edge case)
    const existingMember = await this.groupMemberRepository.findOne({
      where: { group: { id: invitation.group.id }, userId },
    });

    if (existingMember) {
      throw new BadRequestException('You are already a member of this group');
    }

    // Update invitation status
    invitation.status = InvitationStatus.ACCEPTED;
    invitation.respondedAt = new Date();
    await this.invitationRepository.save(invitation);

    // Create the member
    const newMember = this.groupMemberRepository.create({
      name: memberName || invitation.suggestedMemberName,
      group: invitation.group,
      userId,
      joined: true,
      joinedAt: new Date(),
    });

    const savedMember = await this.groupMemberRepository.save(newMember);

    // Emit WebSocket events
    // 1. To group room - new member joined
    this.wsGateway.emitMemberJoined({
      groupId: invitation.group.id,
      memberId: String(savedMember.id),
      memberName: savedMember.name,
      userId: savedMember.userId,
      action: 'joined',
      timestamp: new Date(),
    });

    // 2. To group room - invitation accepted
    this.wsGateway.emitInvitationAccepted({
      invitationId: invitation.id,
      groupId: invitation.group.id,
      memberId: String(savedMember.id),
      memberName: savedMember.name,
      userId,
      timestamp: new Date(),
    });

    return savedMember;
  }

  /**
   * Reject an invitation
   */
  async rejectInvitation(invitationId: number, userId: string): Promise<void> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId },
      relations: ['group'],
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.invitedUserId !== userId) {
      throw new BadRequestException('This invitation is not for you');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(`Invitation has already been ${invitation.status}`);
    }

    // Update invitation status
    invitation.status = InvitationStatus.REJECTED;
    invitation.respondedAt = new Date();
    await this.invitationRepository.save(invitation);

    // Emit WebSocket event to group room
    this.wsGateway.emitInvitationRejected({
      invitationId: invitation.id,
      groupId: invitation.group.id,
      userId,
      suggestedMemberName: invitation.suggestedMemberName,
      timestamp: new Date(),
    });
  }

  /**
   * Cancel a pending invitation (by the inviter or group owner)
   */
  async cancelInvitation(
    invitationId: number,
    cancelledByUserId: string,
  ): Promise<void> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId },
      relations: ['group'],
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    // Only inviter or group owner can cancel
    if (
      invitation.invitedByUserId !== cancelledByUserId &&
      invitation.group.createdByUserId !== cancelledByUserId
    ) {
      throw new BadRequestException('Only the inviter or group owner can cancel this invitation');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(`Invitation has already been ${invitation.status}`);
    }

    // Delete the invitation
    const groupId = invitation.group.id;
    const groupName = invitation.group.name;
    const invitedUserId = invitation.invitedUserId;

    await this.invitationRepository.remove(invitation);

    // Emit WebSocket event to invited user
    this.wsGateway.emitInvitationCancelled({
      invitationId,
      userId: invitedUserId,
      groupId,
      groupName,
      cancelledByUserId,
      timestamp: new Date(),
    });
  }

  /**
   * Get all pending invitations for a user
   */
  async getPendingInvitationsForUser(userId: string): Promise<GroupInvitation[]> {
    return this.invitationRepository.find({
      where: {
        invitedUserId: userId,
        status: InvitationStatus.PENDING,
      },
      relations: ['group'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get all pending invitations for a group
   */
  async getPendingInvitationsForGroup(groupId: string): Promise<GroupInvitation[]> {
    return this.invitationRepository.find({
      where: {
        group: { id: groupId },
        status: InvitationStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get invitation by ID
   */
  async getInvitationById(invitationId: number): Promise<GroupInvitation> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId },
      relations: ['group'],
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    return invitation;
  }
}
