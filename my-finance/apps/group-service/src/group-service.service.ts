import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Group } from './entities/group.entity';
import { GroupMember } from './entities/GroupMember.entity';

@Injectable()
export class GroupServiceService {
  constructor(
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,

    @InjectRepository(GroupMember)
    private readonly groupMemberRepository: Repository<GroupMember>
  ){}
  async createGroup(
    createdByUserId: string,
    name: string,
    ownerName: string,
    memberNames: string[]
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
      group: savedGroup,  // Sử dụng relation object thay vì groupId
      userId: createdByUserId,
      joined: true,
      joinedAt: new Date(),
    });

    // Tạo các member khác (chưa join)
    const otherMembers = memberNames.map((memberName) => {
      return this.groupMemberRepository.create({
        name: memberName,
        group: savedGroup,  // Sử dụng relation object thay vì groupId
      });
    });

    // Lưu tất cả members (owner + others)
    await this.groupMemberRepository.save([ownerMember, ...otherMembers]);

    // Trả về group với members
    return this.getGroupByCode(savedGroup.code);
  }

  async joinGroup(userId: string, groupCode: string): Promise<GroupMember> {
    const group = await this.groupRepository.findOne({
      where: { code: groupCode },
    });

    if (!group) {
      throw new Error('Group not found');
    }

    const groupMember = await this.groupMemberRepository.findOne({
      where: { group: { id: group.id }, userId: IsNull() },
    });

    if (!groupMember) {
      throw new Error('No available slots in the group');
    }

    groupMember.userId = userId;
    groupMember.joined = true;
    groupMember.joinedAt = new Date();

    return this.groupMemberRepository.save(groupMember);
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

  async joinGroupByCode(
    code: string,
    memberId: string,
    userId: string,
  ): Promise<GroupMember> {
    const group = await this.getGroupByCode(code);

    const member = group.members.find((m) => m.id === parseInt(memberId));
    if (!member) {
      throw new NotFoundException('Member not found in this group');
    }

    if (member.userId && member.userId !== userId) {
      throw new BadRequestException('This member is already linked to another user');
    }

    member.userId = userId;
    member.joined = true;
    member.joinedAt = new Date();

    await this.groupMemberRepository.save(member);
    return member;
  }

  async getGroupsOfUser(userId: string): Promise<Group[]> {
    // lấy tất cả group mà có member.userId = userId
    const members = await this.groupMemberRepository.find({
      where: { userId },
      relations: ['group', 'group.members'], // Load cả members của group
    });

    return members.map((m) => m.group);
  }

  async getMemberByUserIdAndGroupId(userId: string, groupId: string): Promise<GroupMember> {
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

  private generateGroupCode(): string {
    // TODO: random code, kiểm tra unique
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}
