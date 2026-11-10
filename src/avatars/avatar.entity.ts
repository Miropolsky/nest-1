import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { UserEntity } from '../users/user.entity.js';

@Entity()
export class AvatarEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => UserEntity, (user: UserEntity) => user.avatars, {
    nullable: false,
  })
  @JoinColumn({ name: 'user_id' })
  user: Relation<UserEntity>;

  @Column()
  fileName: string;

  @CreateDateColumn({ type: 'timestamptz' })
  uploadedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
