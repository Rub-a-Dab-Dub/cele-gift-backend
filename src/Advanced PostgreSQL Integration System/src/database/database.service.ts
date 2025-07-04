import { Injectable, Logger } from "@nestjs/common"
import type { DataSource, QueryRunner } from "typeorm"
import type { PostgresNotificationService } from "./postgres-notification.service"
import type { ExtensionManagerService } from "./extension-manager.service"

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name)

  constructor(
    private readonly dataSource: DataSource,
    private readonly notificationService: PostgresNotificationService,
    private readonly extensionManager: ExtensionManagerService,
  ) {}

  async onModuleInit() {
    await this.initializeDatabase()
  }

  private async initializeDatabase() {
    try {
      // Check PostgreSQL version
      const version = await this.getPostgresVersion()
      this.logger.log(`Connected to PostgreSQL version: ${version}`)

      // Initialize extensions
      await this.extensionManager.initializeExtensions()

      // Set up timezone
      await this.setTimezone("UTC")

      // Initialize notification listeners
      await this.notificationService.initialize()

      this.logger.log("Database initialization completed")
    } catch (error) {
      this.logger.error("Database initialization failed", error)
      throw error
    }
  }

  async getPostgresVersion(): Promise<string> {
    const result = await this.dataSource.query("SELECT version()")
    return result[0].version
  }

  async setTimezone(timezone: string): Promise<void> {
    await this.dataSource.query(`SET timezone = '${timezone}'`)
    this.logger.log(`Timezone set to: ${timezone}`)
  }

  async getCurrentTimezone(): Promise<string> {
    const result = await this.dataSource.query("SHOW timezone")
    return result[0].TimeZone
  }

  // Advanced PostgreSQL operations
  async executeWithTransaction<T>(operation: (queryRunner: QueryRunner) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      const result = await operation(queryRunner)
      await queryRunner.commitTransaction()
      return result
    } catch (error) {
      await queryRunner.rollbackTransaction()
      throw error
    } finally {
      await queryRunner.release()
    }
  }

  // Array operations
  async findByArrayContains(table: string, column: string, value: any): Promise<any[]> {
    return this.dataSource.query(`SELECT * FROM ${table} WHERE $1 = ANY(${column})`, [value])
  }

  async findByArrayOverlap(table: string, column: string, values: any[]): Promise<any[]> {
    return this.dataSource.query(`SELECT * FROM ${table} WHERE ${column} && $1`, [values])
  }

  // JSON/JSONB operations
  async findByJsonPath(table: string, column: string, path: string, value: any): Promise<any[]> {
    return this.dataSource.query(`SELECT * FROM ${table} WHERE ${column}->>'${path}' = $1`, [value])
  }

  async findByJsonbContains(table: string, column: string, value: any): Promise<any[]> {
    return this.dataSource.query(`SELECT * FROM ${table} WHERE ${column} @> $1`, [JSON.stringify(value)])
  }

  async updateJsonbField(table: string, id: any, column: string, path: string, value: any): Promise<void> {
    await this.dataSource.query(`UPDATE ${table} SET ${column} = jsonb_set(${column}, '{${path}}', $1) WHERE id = $2`, [
      JSON.stringify(value),
      id,
    ])
  }

  // Full-text search operations
  async fullTextSearch(table: string, column: string, query: string): Promise<any[]> {
    return this.dataSource.query(
      `SELECT *, ts_rank(${column}, plainto_tsquery($1)) as rank 
       FROM ${table} 
       WHERE ${column} @@ plainto_tsquery($1) 
       ORDER BY rank DESC`,
      [query],
    )
  }

  // Geometric operations
  async findWithinDistance(
    table: string,
    pointColumn: string,
    center: { x: number; y: number },
    distance: number,
  ): Promise<any[]> {
    return this.dataSource.query(
      `SELECT *, point(${center.x}, ${center.y}) <-> ${pointColumn} as distance 
       FROM ${table} 
       WHERE point(${center.x}, ${center.y}) <-> ${pointColumn} < $1 
       ORDER BY distance`,
      [distance],
    )
  }

  // Utility functions
  async vacuum(table?: string): Promise<void> {
    const query = table ? `VACUUM ${table}` : "VACUUM"
    await this.dataSource.query(query)
    this.logger.log(`Vacuum completed for ${table || "all tables"}`)
  }

  async analyze(table?: string): Promise<void> {
    const query = table ? `ANALYZE ${table}` : "ANALYZE"
    await this.dataSource.query(query)
    this.logger.log(`Analyze completed for ${table || "all tables"}`)
  }

  async reindex(index?: string): Promise<void> {
    const query = index ? `REINDEX INDEX ${index}` : "REINDEX DATABASE CURRENT"
    await this.dataSource.query(query)
    this.logger.log(`Reindex completed for ${index || "database"}`)
  }

  async getTableSize(table: string): Promise<string> {
    const result = await this.dataSource.query(`SELECT pg_size_pretty(pg_total_relation_size($1)) as size`, [table])
    return result[0].size
  }

  async getIndexUsage(table: string): Promise<any[]> {
    return this.dataSource.query(
      `
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_tup_read,
        idx_tup_fetch,
        idx_scan
      FROM pg_stat_user_indexes 
      WHERE tablename = $1
    `,
      [table],
    )
  }
}
