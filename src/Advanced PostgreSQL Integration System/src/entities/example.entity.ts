import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"
import {
  PostgresArrayTransformer,
  PostgresJSONTransformer,
  PostgresHstoreTransformer,
  PostgresPointTransformer,
  type PostgresArray,
  type PostgresJSON,
  type PostgresJSONB,
  type PostgresHstore,
  type PostgresPoint,
} from "../database/types/postgres.types"

@Entity("examples")
@Index(["tags"], { using: "GIN" }) // GIN index for array operations
@Index(["metadata"], { using: "GIN" }) // GIN index for JSONB operations
@Index(["search_vector"], { using: "GIN" }) // GIN index for full-text search
export class ExampleEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "varchar", length: 255 })
  name: string

  @Column({ type: "text", nullable: true })
  description: string

  // Array column
  @Column({
    type: "text",
    array: true,
    transformer: PostgresArrayTransformer,
    nullable: true,
  })
  tags: PostgresArray<string>

  // Integer array
  @Column({
    type: "integer",
    array: true,
    nullable: true,
  })
  scores: number[]

  // JSON column
  @Column({
    type: "json",
    transformer: PostgresJSONTransformer,
    nullable: true,
  })
  settings: PostgresJSON

  // JSONB column (preferred over JSON for performance)
  @Column({
    type: "jsonb",
    transformer: PostgresJSONTransformer,
    nullable: true,
  })
  metadata: PostgresJSONB

  // HSTORE column
  @Column({
    type: "hstore",
    transformer: PostgresHstoreTransformer,
    nullable: true,
  })
  attributes: PostgresHstore

  // Geometric types
  @Column({
    type: "point",
    transformer: PostgresPointTransformer,
    nullable: true,
  })
  location: PostgresPoint

  // Network types
  @Column({ type: "inet", nullable: true })
  ipAddress: string

  @Column({ type: "macaddr", nullable: true })
  macAddress: string

  // UUID column
  @Column({ type: "uuid", nullable: true })
  externalId: string

  // Full-text search
  @Column({
    type: "tsvector",
    nullable: true,
    select: false, // Don't select by default
  })
  searchVector: string

  // Range types (PostgreSQL 9.2+)
  @Column({ type: "int4range", nullable: true })
  ageRange: string

  @Column({ type: "tsrange", nullable: true })
  timeRange: string

  // Bit string types
  @Column({ type: "bit", length: 8, nullable: true })
  flags: string

  @Column({ type: "varbit", nullable: true })
  variableBits: string

  // Money type
  @Column({ type: "money", nullable: true })
  price: string

  // Interval type
  @Column({ type: "interval", nullable: true })
  duration: string

  // Timezone-aware timestamps
  @CreateDateColumn({
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date

  @UpdateDateColumn({
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
  })
  updatedAt: Date

  // Soft delete with timezone
  @Column({
    type: "timestamptz",
    nullable: true,
  })
  deletedAt: Date

  // Version for optimistic locking
  @Column({ type: "integer", default: 1 })
  version: number
}
