import { DataSource } from 'typeorm';

export class PostgreSQLUtilitiesService {
  constructor(private dataSource: DataSource) {}

  // Database introspection
  async getTableSize(tableName: string): Promise<number> {
    const result = await this.dataSource.query(
      `SELECT pg_total_relation_size($1) as size`,
      [tableName]
    );
    return parseInt(result[0].size);
  }

  async getIndexUsage(tableName: string): Promise<any[]> {
    return this.dataSource.query(`
      SELECT 
        indexname,
        idx_tup_read,
        idx_tup_fetch,
        CASE WHEN idx_tup_read > 0 
          THEN (idx_tup_fetch::float / idx_tup_read::float * 100)::numeric(5,2)
          ELSE 0 
        END AS hit_ratio
      FROM pg_stat_user_indexes 
      WHERE relname = $1
    `, [tableName]);
  }

  // Maintenance operations
  async analyzeTable(tableName: string): Promise<void> {
    await this.dataSource.query(`ANALYZE ${tableName}`);
  }

  async vacuumTable(tableName: string, full = false): Promise<void> {
    const command = full ? `VACUUM FULL ${tableName}` : `VACUUM ${tableName}`;
    await this.dataSource.query(command);
  }

  async reindexTable(tableName: string): Promise<void> {
    await this.dataSource.query(`REINDEX TABLE ${tableName}`);
  }

  // Advanced data operations
  async bulkUpsert(tableName: string, data: any[], conflictTarget: string[]): Promise<void> {
    if (!data.length) return;

    const columns = Object.keys(data[0]);
    const values = data.map(item => 
      columns.map(col => `'${String(item[col]).replace(/'/g, "''")}'`).join(',')
    ).map(row => `(${row})`).join(',');

    const updateSet = columns
      .filter(col => !conflictTarget.includes(col))
      .map(col => `${col} = EXCLUDED.${col}`)
      .join(',');

    const query = `
      INSERT INTO ${tableName} (${columns.join(',')})
      VALUES ${values}
      ON CONFLICT (${conflictTarget.join(',')})
      DO UPDATE SET ${updateSet}
    `;

    await this.dataSource.query(query);
  }

  // JSON operations
  async updateJsonField(
    tableName: string, 
    id: any, 
    jsonField: string, 
    path: string, 
    value: any
  ): Promise<void> {
    await this.dataSource.query(`
      UPDATE ${tableName} 
      SET ${jsonField} = jsonb_set(${jsonField}, '{${path}}', '"${value}"')
      WHERE id = $1
    `, [id]);
  }

  async appendToJsonArray(
    tableName: string,
    id: any,
    jsonField: string,
    value: any
  ): Promise<void> {
    await this.dataSource.query(`
      UPDATE ${tableName}
      SET ${jsonField} = ${jsonField} || $2::jsonb
      WHERE id = $1
    `, [id, JSON.stringify([value])]);
  }
}
