/* eslint-disable @typescript-eslint/no-explicit-any */
import sql, { ConnectionPool, Transaction, Request as SqlRequest } from 'mssql';
import config from './index';
import logger from '../utils/logger';

class Database {
  private pool: ConnectionPool | null = null;
  private readonly config: typeof config.database;

  constructor() {
    this.config = config.database;
  }

  public async connect(): Promise<ConnectionPool> {
    try {
      if (this.pool && this.pool.connected) {
        return this.pool;
      }

      logger.info('Connecting to SQL Server database...');
      this.pool = await sql.connect(this.config);

      logger.info('Successfully connected to SQL Server database');

      // Handle connection errors
      this.pool.on('error', (err: Error) => {
        logger.error('Database connection error:', err);
        this.pool = null;
      });

      return this.pool;
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.pool) {
        await this.pool.close();
        this.pool = null;
        logger.info('Database connection closed');
      }
    } catch (error) {
      logger.error('Error closing database connection:', error);
      throw error;
    }
  }

  public getPool(): ConnectionPool {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.pool;
  }

  public async executeQuery<T = any>(
    query: string,
    params: Record<string, any> = {}
  ): Promise<sql.IResult<T>> {
    try {
      const pool = await this.connect();
      const request = pool.request();

      // Add parameters to request
      Object.keys(params).forEach((key) => {
        request.input(key, params[key]);
      });

      const result = await request.query<T>(query);
      return result;
    } catch (error) {
      logger.error('Query execution error:', error);
      throw error;
    }
  }

  public async executeStoredProcedure<T = any>(
    procedureName: string,
    params: Record<string, any> = {}
  ): Promise<sql.IProcedureResult<T>> {
    try {
      const pool = await this.connect();
      const request = pool.request();

      // Add parameters to request
      Object.keys(params).forEach((key) => {
        request.input(key, params[key]);
      });

      const result = await request.execute<T>(procedureName);
      return result;
    } catch (error) {
      logger.error('Stored procedure execution error:', error);
      throw error;
    }
  }

  // Helper method to begin a transaction
  public async beginTransaction(): Promise<Transaction> {
    const pool = await this.connect();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    return transaction;
  }

  // Helper method to create a request with automatic parameter binding
  public async createRequest(params: Record<string, any> = {}): Promise<SqlRequest> {
    const pool = await this.connect();
    const request = pool.request();

    Object.keys(params).forEach((key) => {
      request.input(key, params[key]);
    });

    return request;
  }

  // Check if database is connected
  public isConnected(): boolean {
    return this.pool !== null && this.pool.connected;
  }
}

// Export singleton instance
const database = new Database();
export default database;
