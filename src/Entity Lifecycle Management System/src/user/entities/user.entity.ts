import { Entity, Column } from "typeorm"
import { BaseLifecycleEntity } from "../../lifecycle/entities/base-lifecycle.entity"

@Entity("users")
export class User extends BaseLifecycleEntity {
  @Column({ unique: true })
  email: string

  @Column()
  firstName: string

  @Column()
  lastName: string

  @Column({ nullable: true })
  phone?: string

  @Column({ default: true })
  isActive: boolean

  @Column({ type: "jsonb", nullable: true })
  preferences?: Record<string, any>

  // Custom validation for User entity
  protected validateBeforeInsert(): void {
    super.validateBeforeInsert()

    if (!this.email || !this.email.includes("@")) {
      throw new Error("Valid email is required")
    }

    if (!this.firstName || !this.lastName) {
      throw new Error("First name and last name are required")
    }
  }

  protected validateBeforeUpdate(): void {
    super.validateBeforeUpdate()

    if (this.email && !this.email.includes("@")) {
      throw new Error("Valid email is required")
    }
  }
}
