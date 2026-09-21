import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

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
}
