import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm"
import { MetricData } from "../../metrics/entities/metric-data.entity"

@Entity("celebrities")
export class Celebrity {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ unique: true })
  name: string

  @Column()
  category: string

  @Column({ nullable: true })
  profileImage: string

  @Column("text", { array: true, default: [] })
  socialMediaHandles: string[]

  @Column({ default: true })
  isActive: boolean

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @OneToMany(
    () => MetricData,
    (metricData) => metricData.celebrity,
  )
  metrics: MetricData[]
}
