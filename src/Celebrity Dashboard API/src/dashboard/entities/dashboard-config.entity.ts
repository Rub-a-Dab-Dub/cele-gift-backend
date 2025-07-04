import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm"
import { Celebrity } from "./celebrity.entity"

@Entity("dashboard_configs")
export class DashboardConfig {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  name: string

  @Column("jsonb")
  layout: any

  @Column("jsonb")
  widgets: any[]

  @Column("jsonb")
  filters: any

  @Column("jsonb")
  customizations: any

  @Column()
  celebrityId: string

  @ManyToOne(() => Celebrity)
  @JoinColumn({ name: "celebrityId" })
  celebrity: Celebrity

  @Column({ default: true })
  isActive: boolean

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
