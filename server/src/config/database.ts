import mysql, { Pool, PoolOptions, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });


export interface DbHealthResult {
  connected: boolean;
  message: string;
  details?: {
    host: string;
    port: number;
    database: string;
  };
}

// 1. Environment-driven configuration with safe defaults
const dbConfig: PoolOptions = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'peoplepay360',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

// 2. Centralized connection pool instance
export const pool: Pool = mysql.createPool(dbConfig);

/**
 * Reusable database health check function.
 * Tests if the MySQL connection pool can borrow a connection and execute a query.
 * Catches common failure scenarios gracefully without throwing unreadable stack traces.
 */
export async function testDatabaseConnection(): Promise<DbHealthResult> {
  const host = dbConfig.host || 'localhost';
  const port = (dbConfig.port as number) || 3306;
  const database = dbConfig.database || 'peoplepay360';

  try {
    const connection = await pool.getConnection();
    try {
      await connection.query('SELECT 1 + 1 AS ping, NOW() AS serverTime;');
      return {
        connected: true,
        message: 'MySQL connection established successfully.',
        details: { host, port, database },
      };
    } finally {
      connection.release();
    }
  } catch (err: unknown) {
    const error = err as { code?: string; errno?: number; message?: string };
    let friendlyMessage = 'Unable to connect to MySQL database.';

    switch (error.code) {
      case 'ECONNREFUSED':
        friendlyMessage = `Connection refused at ${host}:${port}. Verify MySQL service is running.`;
        break;
      case 'ER_ACCESS_DENIED_ERROR':
        friendlyMessage = `Access denied for database user '${dbConfig.user}'. Check DB_USER and DB_PASSWORD.`;
        break;
      case 'ER_BAD_DB_ERROR':
        friendlyMessage = `Database '${database}' does not exist on MySQL server.`;
        break;
      case 'ETIMEDOUT':
        friendlyMessage = `Connection to ${host}:${port} timed out.`;
        break;
      case 'ENOTFOUND':
        friendlyMessage = `Host '${host}' not found. Check DB_HOST configuration.`;
        break;
      default:
        friendlyMessage = error.message || friendlyMessage;
    }

    return {
      connected: false,
      message: friendlyMessage,
      details: { host, port, database },
    };
  }
}

/**
 * Safe query execution abstraction for application services.
 * Automatically handles connection borrowing, query execution, release, and error sanitization.
 * Never leaks database credentials or internal connection strings to callers.
 */
export async function executeQuery<T extends RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params: unknown[] = []
): Promise<T> {
  try {
    const [results] = await pool.query<T>(sql, params);
    return results;
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string; sqlMessage?: string };
    // Log sanitized error internally without exposing credentials
    console.error('[Database Query Error]:', {
      code: error.code,
      message: error.sqlMessage || error.message,
    });
    throw new Error('Database operation failed. Please try again.');
  }
}
