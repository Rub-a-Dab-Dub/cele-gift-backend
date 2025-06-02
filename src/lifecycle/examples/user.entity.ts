import { Entity, Column } from 'typeorm';
import { BaseLifecycleEntity } from '../base/base-lifecycle.entity';

@Entity('users')
export class User extends BaseLifecycleEntity {
  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  department?: string;
}