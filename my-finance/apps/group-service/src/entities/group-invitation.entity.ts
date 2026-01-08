import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Group } from './group.entity';

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

@Entity('group_invitations')
export class GroupInvitation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: Group;

  // The user being invited
  @Column({ name: 'invited_user_id', type: 'varchar' })
  @Index()
  invitedUserId: string;

  // Name suggested for the invited user in this group
  @Column({ name: 'suggested_member_name', type: 'varchar', length: 100 })
  suggestedMemberName: string;

  // Who sent the invitation
  @Column({ name: 'invited_by_user_id', type: 'varchar' })
  invitedByUserId: string;

  @Column({ name: 'invited_by_member_name', type: 'varchar', length: 100, nullable: true })
  invitedByMemberName: string | null;

  @Column({
    type: 'enum',
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  status: InvitationStatus;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
