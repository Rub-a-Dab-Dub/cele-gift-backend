import { Entity, Column, Index, PrimaryGeneratedColumn, CreateDateColumn } from "typeorm"

@Entity("entity_archives")
@Index(["entityType", "entityId"])
@Index(["archivedAt"])
export class EntityArchive {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ name: "entity_type" })
  @Index()
  entityType: string

  @Column({ name: "entity_id" })
  @Index()
  entityId: string

  @Column({ name: "entity_data", type: "jsonb" })
  entityData: Record<string, any>

  @Column({ name: "archived_at" })
  @Index()
  archivedAt: Date

  @Column({ name: "archived_by", nullable: true })
  archivedBy?: string

  @Column({ nullable: true })
  reason?: string

  @Column({ name: "retention_until", nullable: true })
  retentionUntil?: Date

  @Column({ name: "is_permanent", default: false })
  isPermanent: boolean

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date

  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, any>
}
