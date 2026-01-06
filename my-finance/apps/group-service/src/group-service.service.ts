import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Group } from './entities/group.entity';
import { GroupMember } from './entities/GroupMember.entity';
@Injectable()
export class GroupServiceService {
  constructor(
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,

    @InjectRepository(GroupMember)
    private readonly groupMemberRepository: Repository<GroupMember>,

    private readonly dataSource: DataSource,
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
    return this.getGroupByCode(savedGroup.code);
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

    return savedMember;
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

      return {
        newOwnerId: newOwnerUserId,
        newOwnerName: newOwnerMember.name,
      };
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
  }

  private generateGroupCode(): string {
    // TODO: random code, kiểm tra unique
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}
