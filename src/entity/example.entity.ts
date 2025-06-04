import { Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { 
  PostgreSQLArrayColumn, 
  PostgreSQLJSONColumn, 
  PostgreSQLJSONBColumn, 
  PostgreSQLHStoreColumn 
} from '../decorators/postgres-column.decorator';

@Entity('example_data')
export class ExampleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @PostgreSQLArrayColumn('text')
  tags: string[];

  @PostgreSQLArrayColumn('integer')
  scores: number[];

  @PostgreSQLJSONColumn()
  metadata: PostgreSQLJSON;

  @PostgreSQLJSONBColumn()
  settings: PostgreSQLJSONB;

  @PostgreSQLHStoreColumn()
  attributes: PostgreSQLHStore;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}