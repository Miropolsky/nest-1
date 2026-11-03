import {
  Check,
  Column,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { AvatarEntity } from '../avatars/avatar.entity.js';

@Entity()
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  login: string;

  @Column()
  age: number;

  @Column()
  description: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ type: 'varchar', nullable: true })
  refreshTokenHash: string | null;

  @DeleteDateColumn()
  deletedAt: Date | null;

  @OneToMany(() => AvatarEntity, (avatar: AvatarEntity) => avatar.user)
  avatars: Relation<AvatarEntity>[];

  @Check('balance >= 0')
  @Column({
    name: 'balance',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  balance: string;
}
