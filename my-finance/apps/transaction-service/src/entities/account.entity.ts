import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('accounts')
@Index(['userId'], { unique: true })
export class AccountEntity {
  @ApiProperty({ description: 'Account ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'User ID owner of this account' })
  @Column({ type: 'uuid' })
  userId: string;

  @ApiProperty({ description: 'Account name', example: 'money' })
  @Column({ type: 'varchar', length: 50 })
  name: string;

  @ApiProperty({ description: 'Account balance', type: Number })
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: {
      to: (v) => v,
      from: (v: string) => parseFloat(v),
    },
  })
  balance: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
