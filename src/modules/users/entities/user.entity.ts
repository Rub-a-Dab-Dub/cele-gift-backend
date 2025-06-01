import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../tenant/entities/tenant-base.entity';

@Entity('users')
export class UserEntity extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;
}