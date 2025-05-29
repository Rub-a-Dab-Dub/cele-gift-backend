export class CreateSearchIndexes1640000003 implements MigrationInterface {
    name = 'CreateSearchIndexes1640000003';
  
    public async up(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`
        ALTER TABLE "gifts" 
        ADD COLUMN IF NOT EXISTS "search_vector" tsvector;
      `);
  
      //function to update search vector
      await queryRunner.query(`
        CREATE OR REPLACE FUNCTION update_gift_search_vector() 
        RETURNS TRIGGER AS $
        BEGIN
          NEW.search_vector := 
            setweight(to_tsvector('english_unaccent', COALESCE(NEW.title, '')), 'A') ||
            setweight(to_tsvector('english_unaccent', COALESCE(NEW.description, '')), 'B') ||
            setweight(to_tsvector('english_unaccent', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C') ||
            setweight(to_tsvector('english_unaccent', COALESCE(NEW.category, '')), 'D');
          RETURN NEW;
        END;
        $ LANGUAGE plpgsql;
      `);
  
      // Create trigger to automatically update search vector

      await queryRunner.query(`
        CREATE TRIGGER gift_search_vector_update
          BEFORE INSERT OR UPDATE ON "gifts"
          FOR EACH ROW EXECUTE FUNCTION update_gift_search_vector();
      `);
  
      // Update existing records

      await queryRunner.query(`
        UPDATE "gifts" SET 
          search_vector = 
            setweight(to_tsvector('english_unaccent', COALESCE(title, '')), 'A') ||
            setweight(to_tsvector('english_unaccent', COALESCE(description, '')), 'B') ||
            setweight(to_tsvector('english_unaccent', COALESCE(array_to_string(tags, ' '), '')), 'C') ||
            setweight(to_tsvector('english_unaccent', COALESCE(category, '')), 'D');
      `);
  
      //search indexes

      await queryRunner.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_gifts_search_vector" 
        ON "gifts" USING gin("search_vector");
      `);
  
      await queryRunner.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_gifts_title_trgm" 
        ON "gifts" USING gin("title" gin_trgm_ops);
      `);
  
      await queryRunner.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_gifts_description_trgm" 
        ON "gifts" USING gin("description" gin_trgm_ops);
      `);
  
      await queryRunner.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_gifts_tags_gin" 
        ON "gifts" USING gin("tags");
      `);
  
      await queryRunner.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_gifts_category_price" 
        ON "gifts" ("category", "price");
      `);
  
      await queryRunner.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_gifts_created_at" 
        ON "gifts" ("created_at");
      `);
  
      await queryRunner.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_gifts_price" 
        ON "gifts" ("price");
      `);
    }
  
    public async down(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query('DROP INDEX IF EXISTS "IDX_gifts_price"');
      await queryRunner.query('DROP INDEX IF EXISTS "IDX_gifts_created_at"');
      await queryRunner.query('DROP INDEX IF EXISTS "IDX_gifts_category_price"');
      await queryRunner.query('DROP INDEX IF EXISTS "IDX_gifts_tags_gin"');
      await queryRunner.query('DROP INDEX IF EXISTS "IDX_gifts_description_trgm"');
      await queryRunner.query('DROP INDEX IF EXISTS "IDX_gifts_title_trgm"');
      await queryRunner.query('DROP INDEX IF EXISTS "IDX_gifts_search_vector"');
      await queryRunner.query('DROP TRIGGER IF EXISTS gift_search_vector_update ON "gifts"');
      await queryRunner.query('DROP FUNCTION IF EXISTS update_gift_search_vector()');
      await queryRunner.query('ALTER TABLE "gifts" DROP COLUMN IF EXISTS "search_vector"');
    }
  }
  