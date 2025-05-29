export class CreateSearchTables1640000002 implements MigrationInterface {
    name = 'CreateSearchTables1640000002';
  
    public async up(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`
        CREATE TABLE "search_configurations" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "entity_name" character varying NOT NULL,
          "searchable_fields" text[] NOT NULL,
          "weights" jsonb NOT NULL,
          "language" character varying NOT NULL DEFAULT 'english',
          "is_active" boolean NOT NULL DEFAULT true,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_search_configurations" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_search_configurations_entity" UNIQUE ("entity_name")
        )
      `);
  
      // Search query logs table

      await queryRunner.query(`
        CREATE TABLE "search_query_logs" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "query" character varying NOT NULL,
          "user_id" character varying,
          "result_count" integer NOT NULL,
          "execution_time_ms" integer NOT NULL,
          "filters" jsonb,
          "facets" jsonb,
          "timestamp" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_search_query_logs" PRIMARY KEY ("id")
        )
      `);
  
      //indexes for query logs

      await queryRunner.query(`
        CREATE INDEX "IDX_search_query_logs_timestamp" ON "search_query_logs" ("timestamp");
        CREATE INDEX "IDX_search_query_logs_query" ON "search_query_logs" ("query");
        CREATE INDEX "IDX_search_query_logs_user_id" ON "search_query_logs" ("user_id");
        CREATE INDEX "IDX_search_query_logs_execution_time" ON "search_query_logs" ("execution_time_ms");
      `);
    }
  
    public async down(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query('DROP TABLE "search_query_logs"');
      await queryRunner.query('DROP TABLE "search_configurations"');
    }
  }