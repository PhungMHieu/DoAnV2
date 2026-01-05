import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from './entities/group.entity';
import { GroupMember } from './entities/GroupMember.entity';

@Injectable()
export class GroupServiceService {
  constructor(
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,

    @InjectRepository(GroupMember)
    private readonly groupMemberRepository: Repository<GroupMember>,
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

    return this.groupMemberRepository.save(newMember);
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

  async leaveGroup(userId: string, groupId: string): Promise<void> {
    const member = await this.groupMemberRepository.findOne({
      where: { userId, group: { id: groupId } },
      relations: ['group'],
    });

    if (!member) {
      throw new NotFoundException('You are not a member of this group');
    }

    // Check if user is the group creator
    if (member.group.createdByUserId === userId) {
      throw new BadRequestException(
        'Group creator cannot leave. Transfer ownership or delete the group instead.',
      );
    }

    await this.groupMemberRepository.remove(member);
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

    return this.groupMemberRepository.save(newMember);
  }

  private generateGroupCode(): string {
    // TODO: random code, kiểm tra unique
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}
