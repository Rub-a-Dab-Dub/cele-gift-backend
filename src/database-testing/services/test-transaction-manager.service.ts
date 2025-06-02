import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner, IsolationLevel } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

export interface TransactionContext {
  id: string;
  queryRunner: QueryRunner;
  startTime: Date;
  isolationLevel: IsolationLevel;
  savepoints: Map<string, string>;
  metadata: Record<string, any>;
}

export interface TransactionOptions {
  isolationLevel?: IsolationLevel;
  timeout?: number;
  savepoints?: boolean;
  readOnly?: boolean;
  metadata?: Record<string, any>;
}

@Injectable()
export class TestTransactionManager {
  private readonly logger = new Logger(TestTransactionManager.name);
  private readonly activeTransactions = new Map<string, TransactionContext>();
  private readonly transactionTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async startTransaction(options: TransactionOptions = {}): Promise<string> {
    const transactionId = uuidv4();
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction(options.isolationLevel);

      // Set read-only mode if specified
      if (options.readOnly) {
        await queryRunner.query('SET TRANSACTION READ ONLY');
      }

      const context: TransactionContext = {
        id: transactionId,
        queryRunner,
        startTime: new Date(),
        isolationLevel: options.isolationLevel || 'READ COMMITTED',
        savepoints: new Map(),
        metadata: options.metadata || {},
      };

      this.activeTransactions.set(transactionId, context);

      // Set timeout if specified
      if (options.timeout) {
        const timeoutId = setTimeout(async () => {
          this.logger.warn(`Transaction ${transactionId} timed out after ${options.timeout}ms`);
          await this.rollbackTransaction(transactionId);
        }, options.timeout);
        
        this.transactionTimeouts.set(transactionId, timeoutId);
      }

      this.logger.debug(`Started transaction ${transactionId} with isolation level ${context.isolationLevel}`);
      return transactionId;
    } catch (error) {
      await queryRunner.release();
      throw new Error(`Failed to start transaction: ${error.message}`);
    }
  }

  async commitTransaction(transactionId: string): Promise<void> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    try {
      await context.queryRunner.commitTransaction();
      this.logger.debug(`Committed transaction ${transactionId}`);
    } catch (error) {
      this.logger.error(`Failed to commit transaction ${transactionId}`, error);
      throw error;
    } finally {
      await this.cleanupTransaction(transactionId);
    }
  }

  async rollbackTransaction(transactionId: string): Promise<void> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      this.logger.warn(`Transaction ${transactionId} not found for rollback`);
      return;
    }

    try {
      if (context.queryRunner.isTransactionActive) {
        await context.queryRunner.rollbackTransaction();
        this.logger.debug(`Rolled back transaction ${transactionId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to rollback transaction ${transactionId}`, error);
    } finally {
      await this.cleanupTransaction(transactionId);
    }
  }

  async createSavepoint(transactionId: string, savepointName: string): Promise<void> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    const savepointId = `sp_${savepointName}_${Date.now()}`;
    
    try {
      await context.queryRunner.query(`SAVEPOINT ${savepointId}`);
      context.savepoints.set(savepointName, savepointId);
      this.logger.debug(`Created savepoint ${savepointName} (${savepointId}) in transaction ${transactionId}`);
    } catch (error) {
      throw new Error(`Failed to create savepoint ${savepointName}: ${error.message}`);
    }
  }

  async rollbackToSavepoint(transactionId: string, savepointName: string): Promise<void> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    const savepointId = context.savepoints.get(savepointName);
    if (!savepointId) {
      throw new Error(`Savepoint ${savepointName} not found in transaction ${transactionId}`);
    }

    try {
      await context.queryRunner.query(`ROLLBACK TO SAVEPOINT ${savepointId}`);
      this.logger.debug(`Rolled back to savepoint ${savepointName} in transaction ${transactionId}`);
    } catch (error) {
      throw new Error(`Failed to rollback to savepoint ${savepointName}: ${error.message}`);
    }
  }

  async releaseSavepoint(transactionId: string, savepointName: string): Promise<void> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    const savepointId = context.savepoints.get(savepointName);
    if (!savepointId) {
      throw new Error(`Savepoint ${savepointName} not found in transaction ${transactionId}`);
    }

    try {
      await context.queryRunner.query(`RELEASE SAVEPOINT ${savepointId}`);
      context.savepoints.delete(savepointName);
      this.logger.debug(`Released savepoint ${savepointName} in transaction ${transactionId}`);
    } catch (error) {
      throw new Error(`Failed to release savepoint ${savepointName}: ${error.message}`);
    }
  }

  async executeInTransaction<T>(
    transactionId: string,
    operation: (queryRunner: QueryRunner) => Promise<T>
  ): Promise<T> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    try {
      return await operation(context.queryRunner);
    } catch (error) {
      this.logger.error(`Operation failed in transaction ${transactionId}`, error);
      throw error;
    }
  }

  async query(transactionId: string, sql: string, parameters?: any[]): Promise<any> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    try {
      return await context.queryRunner.query(sql, parameters);
    } catch (error) {
      this.logger.error(`Query failed in transaction ${transactionId}: ${sql}`, error);
      throw error;
    }
  }

  getTransactionContext(transactionId: string): TransactionContext | undefined {
    return this.activeTransactions.get(transactionId);
  }

  getActiveTransactions(): string[] {
    return Array.from(this.activeTransactions.keys());
  }

  async getTransactionInfo(transactionId: string): Promise<any> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      return null;
    }

    try {
      // Get transaction status from database
      const txInfo = await context.queryRunner.query(`
        SELECT 
          current_setting('transaction_isolation') as isolation_level,
          current_setting('transaction_read_only') as read_only,
          txid_current() as transaction_id,
          NOW() as current_time
      `);

      return {
        id: transactionId,
        startTime: context.startTime,
        duration: Date.now() - context.startTime.getTime(),
        isolationLevel: context.isolationLevel,
        savepoints: Array.from(context.savepoints.keys()),
        metadata: context.metadata,
        dbInfo: txInfo[0],
      };
    } catch (error) {
      this.logger.error(`Failed to get transaction info for ${transactionId}`, error);
      return {
        id: transactionId,
        startTime: context.startTime,
        duration: Date.now() - context.startTime.getTime(),
        error: error.message,
      };
    }
  }

  private async cleanupTransaction(transactionId: string): Promise<void> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      return;
    }

    try {
      // Clear timeout
      const timeoutId = this.transactionTimeouts.get(transactionId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.transactionTimeouts.delete(transactionId);
      }

      // Release query runner
      await context.queryRunner.release();
      
      // Remove from active transactions
      this.activeTransactions.delete(transactionId);
      
      this.logger.debug(`Cleaned up transaction ${transactionId}`);
    } catch (error) {
      this.logger.error(`Failed to cleanup transaction ${transactionId}`, error);
    }
  }

  async cleanupAllTransactions(): Promise<void> {
    const transactionIds = Array.from(this.activeTransactions.keys());
    
    for (const transactionId of transactionIds) {
      await this.rollbackTransaction(transactionId);
    }
    
    this.logger.log(`Cleaned up ${transactionIds.length} active transactions`);
  }

  async withTransaction<T>(
    operation: (transactionId: string) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    const transactionId = await this.startTransaction(options);
    
    try {
      const result = await operation(transactionId);
      await this.commitTransaction(transactionId);
      return result;
    } catch (error) {
      await this.rollbackTransaction(transactionId);
      throw error;
    }
  }

  async withSavepoint<T>(
    transactionId: string,
    savepointName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    await this.createSavepoint(transactionId, savepointName);
    
    try {
      const result = await operation();
      await this.releaseSavepoint(transactionId, savepointName);
      return result;
    } catch (error) {
      await this.rollbackToSavepoint(transactionId, savepointName);
      throw error;
    }
  }

  // Utility methods for testing isolation levels
  async testReadCommitted(transactionId: string): Promise<boolean> {
    try {
      await this.query(transactionId, 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
      return true;
    } catch (error) {
      return false;
    }
  }

  async testRepeatableRead(transactionId: string): Promise<boolean> {
    try {
      await this.query(transactionId, 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      return true;
    } catch (error) {
      return false;
    }
  }

  async testSerializable(transactionId: string): Promise<boolean> {
    try {
      await this.query(transactionId, 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
      return true;
    } catch (error) {
      return false;
    }
  }

  // Deadlock detection and handling
  async detectDeadlocks(): Promise<any[]> {
    try {
      const deadlocks = await this.dataSource.query(`
        SELECT 
          blocked_locks.pid AS blocked_pid,
          blocked_activity.usename AS blocked_user,
          blocking_locks.pid AS blocking_pid,
          blocking_activity.usename AS blocking_user,
          blocked_activity.query AS blocked_statement,
          blocking_activity.query AS current_statement_in_blocking_process
        FROM pg_catalog.pg_locks blocked_locks
        JOIN pg_catalog.pg_stat_activity blocked_activity 
          ON blocked_activity.pid = blocked_locks.pid
        JOIN pg_catalog.pg_locks blocking_locks 
          ON blocking_locks.locktype = blocked_locks.locktype
          AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
          AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
          AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
          AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
          AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
          AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
          AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
          AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
          AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
          AND blocking_locks.pid != blocked_locks.pid
        JOIN pg_catalog.pg_stat_activity blocking_activity 
          ON blocking_activity.pid = blocking_locks.pid
        WHERE NOT blocked_locks.granted;
      `);

      return deadlocks;
    } catch (error) {
      this.logger.error('Failed to detect deadlocks', error);
      return [];
    }
  }
}