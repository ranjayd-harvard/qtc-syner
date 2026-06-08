import { Pool } from 'pg';
import type { BaseConnector } from './base.connector.js';
import type {
  RedshiftCredentials,
  TestResult,
  ObjectMeta,
  FieldMeta,
  DataResponse,
  DataRow,
  QueryResponse,
  FetchDataOptions,
  UpsertOptions,
  UpsertResult,
} from '../types/index.js';

export class RedshiftConnector implements BaseConnector {
  private credentials: RedshiftCredentials;

  constructor(credentials: RedshiftCredentials) {
    this.credentials = credentials;
  }

  private createPool(): Pool {
    return new Pool({
      host: this.credentials.host,
      port: this.credentials.port || 5439,
      database: this.credentials.database,
      user: this.credentials.username,
      password: this.credentials.password,
      ssl: this.credentials.ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
      max: 1,
    });
  }

  async testConnection(): Promise<TestResult> {
    const start = Date.now();
    const pool = this.createPool();
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      return { success: true, message: 'Connected successfully', latencyMs: Date.now() - start };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed',
        latencyMs: Date.now() - start,
      };
    } finally {
      await pool.end();
    }
  }

  async listObjects(): Promise<ObjectMeta[]> {
    const pool = this.createPool();
    try {
      const client = await pool.connect();
      const result = await client.query<{ schema_name: string; table_name: string; table_type: string }>(`
        SELECT table_schema AS schema_name, table_name, table_type
        FROM information_schema.tables
        WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_internal')
        ORDER BY table_schema, table_name
      `);
      client.release();
      return result.rows.map((r) => ({
        name: `${r.schema_name}.${r.table_name}`,
        label: `${r.schema_name}.${r.table_name}`,
        type: r.table_type === 'VIEW' ? 'view' as const : 'table' as const,
      }));
    } finally {
      await pool.end();
    }
  }

  async getSchema(objectName: string): Promise<FieldMeta[]> {
    const pool = this.createPool();
    try {
      const client = await pool.connect();
      const [schema, table] = objectName.includes('.')
        ? objectName.split('.')
        : ['public', objectName];

      const result = await client.query<{
        column_name: string;
        data_type: string;
        is_nullable: string;
        character_maximum_length: number | null;
      }>(`
        SELECT column_name, data_type, is_nullable, character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
      `, [schema, table]);

      const pkResult = await client.query<{ column_name: string }>(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = $1 AND tc.table_name = $2
      `, [schema, table]);

      const pkColumns = new Set(pkResult.rows.map((r) => r.column_name));
      client.release();

      return result.rows.map((r) => ({
        name: r.column_name,
        label: r.column_name,
        type: r.data_type,
        nullable: r.is_nullable === 'YES',
        isPrimary: pkColumns.has(r.column_name),
        length: r.character_maximum_length ?? undefined,
      }));
    } finally {
      await pool.end();
    }
  }

  async fetchData(objectName: string, options: FetchDataOptions): Promise<DataResponse> {
    const pool = this.createPool();
    try {
      const client = await pool.connect();
      const offset = (options.page - 1) * options.pageSize;
      const safeTable = objectName.replace(/[^a-zA-Z0-9_.]/g, '');

      let query = `SELECT * FROM ${safeTable}`;
      const params: unknown[] = [];

      if (options.filter) {
        params.push(`%${options.filter}%`);
        query += ` WHERE CAST(ROW(${safeTable}.*) AS TEXT) ILIKE $${params.length}`;
      }

      if (options.sort) {
        const safeField = options.sort.field.replace(/[^a-zA-Z0-9_.]/g, '');
        query += ` ORDER BY ${safeField} ${options.sort.direction === 'desc' ? 'DESC' : 'ASC'}`;
      }

      const countQuery = `SELECT COUNT(*) FROM ${safeTable}${options.filter ? ` WHERE CAST(ROW(${safeTable}.*) AS TEXT) ILIKE $1` : ''}`;
      const [dataResult, countResult] = await Promise.all([
        client.query(query + ` LIMIT ${options.pageSize} OFFSET ${offset}`, params),
        client.query(countQuery, options.filter ? params : []),
      ]);

      client.release();
      return {
        rows: dataResult.rows,
        total: parseInt(countResult.rows[0].count, 10),
        page: options.page,
        pageSize: options.pageSize,
      };
    } finally {
      await pool.end();
    }
  }

  async executeQuery(query: string, options: { page: number; pageSize: number; cursor?: string }): Promise<QueryResponse> {
    const pool = this.createPool();
    try {
      const client = await pool.connect();
      const offset = (options.page - 1) * options.pageSize;
      const safeQuery = query.trim().replace(/;$/, '');
      const paginatedQuery = `SELECT * FROM (${safeQuery}) AS _q LIMIT ${options.pageSize} OFFSET ${offset}`;

      const [dataResult, countResult] = await Promise.all([
        client.query(paginatedQuery),
        client.query(`SELECT COUNT(*) FROM (${safeQuery}) AS _q`),
      ]);

      client.release();
      const columns = dataResult.fields.map((f) => f.name);
      return {
        rows: dataResult.rows,
        total: parseInt(countResult.rows[0].count, 10),
        columns,
      };
    } finally {
      await pool.end();
    }
  }

  async upsertRecords(_objectName: string, _records: DataRow[], _options: UpsertOptions): Promise<UpsertResult> {
    throw new Error('Upsert is not supported for Redshift connections');
  }
}
