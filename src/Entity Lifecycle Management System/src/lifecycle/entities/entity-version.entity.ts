import { Entity, Column, Index, PrimaryGeneratedColumn, CreateDateColumn } from "typeorm"

@Entity("entity_versions")
@Index(["entityType", "entityId", "version"])
@Index(["createdAt"])
export class EntityVersion {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ name: "entity_type" })
  @Index()
  entityType: string

  @Column({ name: "entity_id" })
  @Index()
  entityId: string

  @Column()
  version: number

  @Column({ name: "entity_data", type: "jsonb" })
  entityData: Record<string, any>

  @Column({ name: "change_summary", nullable: true })
  changeSummary?: string

  @Column({ name: "changed_by", nullable: true })
  changedBy?: string

  @CreateDateColumn({ name: "created_at" })
  @Index()
  createdAt: Date

  @Column({ name: "is_major_version", default: false })
  isMajorVersion: boolean

  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, any>
}
