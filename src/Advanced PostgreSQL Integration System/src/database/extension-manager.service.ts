import { Injectable, Logger } from "@nestjs/common"
import type { DataSource } from "typeorm"

export interface PostgresExtension {
  name: string
  version?: string
  schema?: string
  cascade?: boolean
  required?: boolean
}

@Injectable()
export class ExtensionManagerService {
  private readonly logger = new Logger(ExtensionManagerService.name)

  // Common PostgreSQL extensions
  private readonly defaultExtensions: PostgresExtension[] = [
    { name: "uuid-ossp", required: true },
    { name: "hstore", required: false },
    { name: "pg_trgm", required: false },
    { name: "btree_gin", required: false },
    { name: "btree_gist", required: false },
    { name: "postgis", required: false },
    { name: "pg_stat_statements", required: false },
    { name: "pgcrypto", required: false },
    { name: "citext", required: false },
    { name: "ltree", required: false },
  ]

  private dataSource: DataSource

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource
    this.logger.log("Initializing PostgreSQL extensions...")
  }

  async initializeExtensions(): Promise<void> {
    for (const extension of this.defaultExtensions) {
      try {
        await this.createExtension(extension)
      } catch (error) {
        if (extension.required) {
          this.logger.error(`Failed to create required extension: ${extension.name}`, error)
          throw error
        } else {
          this.logger.warn(`Failed to create optional extension: ${extension.name}`, error.message)
        }
      }
    }

    this.logger.log("Extension initialization completed")
  }

  async createExtension(extension: PostgresExtension): Promise<void> {
    const exists = await this.extensionExists(extension.name)

    if (exists) {
      this.logger.debug(`Extension ${extension.name} already exists`)
      return
    }

    let query = `CREATE EXTENSION IF NOT EXISTS "${extension.name}"`

    if (extension.version) {
      query += ` VERSION '${extension.version}'`
    }

    if (extension.schema) {
      query += ` SCHEMA ${extension.schema}`
    }

    if (extension.cascade) {
      query += ` CASCADE`
    }

    await this.dataSource.query(query)
    this.logger.log(`Created extension: ${extension.name}`)
  }

  async dropExtension(name: string, cascade = false): Promise<void> {
    const query = `DROP EXTENSION IF EXISTS "${name}"${cascade ? " CASCADE" : ""}`
    await this.dataSource.query(query)
    this.logger.log(`Dropped extension: ${name}`)
  }

  async extensionExists(name: string): Promise<boolean> {
    const result = await this.dataSource.query("SELECT 1 FROM pg_extension WHERE extname = $1", [name])
    return result.length > 0
  }

  async getInstalledExtensions(): Promise<any[]> {
    return this.dataSource.query(`
      SELECT 
        e.extname as name,
        e.extversion as version,
        n.nspname as schema,
        e.extrelocatable as relocatable
      FROM pg_extension e
      JOIN pg_namespace n ON e.extnamespace = n.oid
      ORDER BY e.extname
    `)
  }

  async getAvailableExtensions(): Promise<any[]> {
    return this.dataSource.query(`
      SELECT 
        name,
        default_version,
        installed_version,
        comment
      FROM pg_available_extensions
      ORDER BY name
    `)
  }

  async updateExtension(name: string, version?: string): Promise<void> {
    let query = `ALTER EXTENSION "${name}" UPDATE`

    if (version) {
      query += ` TO '${version}'`
    }

    await this.dataSource.query(query)
    this.logger.log(`Updated extension: ${name}${version ? ` to version ${version}` : ""}`)
  }

  // Extension-specific utility methods
  async enableUuidGeneration(): Promise<void> {
    await this.createExtension({ name: "uuid-ossp", required: true })
  }

  async enableFullTextSearch(): Promise<void> {
    await this.createExtension({ name: "pg_trgm", required: false })
  }

  async enablePostGIS(): Promise<void> {
    await this.createExtension({ name: "postgis", required: false })
  }

  async enableHstore(): Promise<void> {
    await this.createExtension({ name: "hstore", required: false })
  }

  async enableCrypto(): Promise<void> {
    await this.createExtension({ name: "pgcrypto", required: false })
  }

  async enableStatStatements(): Promise<void> {
    await this.createExtension({ name: "pg_stat_statements", required: false })
  }

  // Version compatibility checks
  async checkPostgresVersion(): Promise<{ version: string; majorVersion: number }> {
    const result = await this.dataSource.query("SELECT version()")
    const versionString = result[0].version
    const majorVersion = Number.parseInt(versionString.match(/PostgreSQL (\d+)/)?.[1] || "0")

    return { version: versionString, majorVersion }
  }

  async isVersionCompatible(minVersion: number): Promise<boolean> {
    const { majorVersion } = await this.checkPostgresVersion()
    return majorVersion >= minVersion
  }
}
