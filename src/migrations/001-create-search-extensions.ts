import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSearchExtensions1640000001 implements MigrationInterface {
  name = 'CreateSearchExtensions1640000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "unaccent"');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pg_trgm"');
    
    //text search configurations
    await queryRunner.query(`
      CREATE TEXT SEARCH CONFIGURATION IF NOT EXISTS english_unaccent (COPY = english);
      ALTER TEXT SEARCH CONFIGURATION english_unaccent
      ALTER MAPPING FOR asciiword, asciihword, hword_asciipart, word, hword, hword_part
      WITH unaccent, simple;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TEXT SEARCH CONFIGURATION IF EXISTS english_unaccent');
    await queryRunner.query('DROP EXTENSION IF EXISTS "pg_trgm"');
    await queryRunner.query('DROP EXTENSION IF EXISTS "unaccent"');
  }
}

