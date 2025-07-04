import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm"
import { Celebrity } from "../../dashboard/entities/celebrity.entity"

@Entity("metric_data")
@Index(["celebrityId", "metricType", "timestamp"])
@Index(["timestamp"])
export class MetricData {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  celebrityId: string

  @ManyToOne(
    () => Celebrity,
    (celebrity) => celebrity.metrics,
  )
  @JoinColumn({ name: "celebrityId" })
  celebrity: Celebrity

  @Column()
  metricType: string

  @Column("decimal", { precision: 15, scale: 2 })
  value: number

  @Column({ nullable: true })
  platform: string

  @Column("jsonb", { nullable: true })
  metadata: any

  @Column("timestamp with time zone")
  timestamp: Date

  @CreateDateColumn()
  createdAt: Date
}
