import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Column,
  VersionColumn,
  BeforeInsert,
  BeforeUpdate,
  BeforeRemove,
} from "typeorm"
import { Exclude } from "class-transformer"

export abstract class BaseLifecycleEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date

  @DeleteDateColumn({ name: "deleted_at" })
  @Exclude()
  deletedAt?: Date

  @VersionColumn()
  version: number

  @Column({ name: "created_by", nullable: true })
  createdBy?: string

  @Column({ name: "updated_by", nullable: true })
  updatedBy?: string

  @Column({ name: "deleted_by", nullable: true })
  @Exclude()
  deletedBy?: string

  @Column({ name: "archived_at", nullable: true })
  @Exclude()
  archivedAt?: Date

  @Column({ name: "archived_by", nullable: true })
  @Exclude()
  archivedBy?: string

  // Lifecycle flags
  @Column({ name: "is_locked", default: false })
  isLocked: boolean

  @Column({ name: "lock_reason", nullable: true })
  lockReason?: string

  @Column({ name: "metadata", type: "jsonb", nullable: true })
  metadata?: Record<string, any>

  // Computed properties
  get isDeleted(): boolean {
    return !!this.deletedAt
  }

  get isArchived(): boolean {
    return !!this.archivedAt
  }

  get isActive(): boolean {
    return !this.isDeleted && !this.isArchived && !this.isLocked
  }

  // Lifecycle hooks
  @BeforeInsert()
  beforeInsert() {
    this.validateBeforeInsert()
  }

  @BeforeUpdate()
  beforeUpdate() {
    this.validateBeforeUpdate()
  }

  @BeforeRemove()
  beforeRemove() {
    this.validateBeforeRemove()
  }

  protected validateBeforeInsert(): void {
    // Override in child classes for custom validation
  }

  protected validateBeforeUpdate(): void {
    if (this.isLocked) {
      throw new Error(`Entity ${this.id} is locked: ${this.lockReason}`)
    }
  }

  protected validateBeforeRemove(): void {
    if (this.isLocked) {
      throw new Error(`Cannot delete locked entity ${this.id}: ${this.lockReason}`)
    }
  }
}
