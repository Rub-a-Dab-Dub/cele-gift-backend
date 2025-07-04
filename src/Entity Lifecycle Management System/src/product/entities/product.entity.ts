import { Entity, Column, ManyToOne, JoinColumn } from "typeorm"
import { BaseLifecycleEntity } from "../../lifecycle/entities/base-lifecycle.entity"
import { User } from "../../user/entities/user.entity"

@Entity("products")
export class Product extends BaseLifecycleEntity {
  @Column()
  name: string

  @Column({ type: "text", nullable: true })
  description?: string

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price: number

  @Column({ default: 0 })
  stock: number

  @Column({ default: true })
  isActive: boolean

  @Column({ nullable: true })
  category?: string

  @Column({ type: "text", array: true, default: [] })
  tags: string[]

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "owner_id" })
  owner?: User

  @Column({ name: "owner_id", nullable: true })
  ownerId?: string

  // Custom validation for Product entity
  protected validateBeforeInsert(): void {
    super.validateBeforeInsert()

    if (!this.name || this.name.trim().length === 0) {
      throw new Error("Product name is required")
    }

    if (this.price < 0) {
      throw new Error("Product price cannot be negative")
    }

    if (this.stock < 0) {
      throw new Error("Product stock cannot be negative")
    }
  }

  protected validateBeforeUpdate(): void {
    super.validateBeforeUpdate()

    if (this.name && this.name.trim().length === 0) {
      throw new Error("Product name cannot be empty")
    }

    if (this.price !== undefined && this.price < 0) {
      throw new Error("Product price cannot be negative")
    }

    if (this.stock !== undefined && this.stock < 0) {
      throw new Error("Product stock cannot be negative")
    }
  }
}
