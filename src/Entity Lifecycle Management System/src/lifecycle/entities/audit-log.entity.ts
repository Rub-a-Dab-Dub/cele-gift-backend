import { Entity, Column, Index, PrimaryGeneratedColumn, CreateDateColumn } from "typeorm"

export enum AuditAction {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  RESTORE = "RESTORE",
  ARCHIVE = "ARCHIVE",
  UNARCHIVE = "UNARCHIVE",
  LOCK = "LOCK",
  UNLOCK = "UNLOCK",
}

@Entity("audit_logs")
@Index(["entityType", "entityId"])
@Index(["action", "createdAt"])
@Index(["userId", "createdAt"])
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ name: "entity_type" })
  @Index()
  entityType: string

  @Column({ name: "entity_id" })
  @Index()
  entityId: string

  @Column({ type: "enum", enum: AuditAction })
  @Index()
  action: AuditAction

  @Column({ name: "old_values", type: "jsonb", nullable: true })
  oldValues?: Record<string, any>

  @Column({ name: "new_values", type: "jsonb", nullable: true })
  newValues?: Record<string, any>

  @Column({ name: "changed_fields", type: "text", array: true, nullable: true })
  changedFields?: string[]

  @Column({ name: "user_id", nullable: true })
  @Index()
  userId?: string

  @Column({ name: "ip_address", nullable: true })
  ipAddress?: string

  @Column({ name: "user_agent", nullable: true })
  userAgent?: string

  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, any>

  @CreateDateColumn({ name: "created_at" })
  @Index()
  createdAt: Date

  @Column({ nullable: true })
  reason?: string
}
