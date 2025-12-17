import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn, JoinColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Group } from "./group.entity";

@Entity('group_members')
export class GroupMember {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Group, (group) => group.members, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'group_id' })
    group: Group;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    // Liên kết đến user thật sự (join rồi mới có)
    @Column({ name: 'user_id', type: 'varchar', nullable: true })
    @Index()
    userId: string | null;

    @Column({ default: false })
    joined: boolean;

    @Column({ name: 'joined_at', type: 'timestamptz', nullable: true })
    joinedAt: Date | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}