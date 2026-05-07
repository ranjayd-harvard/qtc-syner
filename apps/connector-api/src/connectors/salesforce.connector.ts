import jsforce from 'jsforce';
import type { BaseConnector } from './base.connector.js';
import type {
  SalesforceCredentials,
  TestResult,
  ObjectMeta,
  FieldMeta,
  DataResponse,
  QueryResponse,
  FetchDataOptions,
} from '../types/index.js';

export class SalesforceConnector implements BaseConnector {
  private credentials: SalesforceCredentials;

  constructor(credentials: SalesforceCredentials) {
    this.credentials = credentials;
  }

  private async getConnection(): Promise<jsforce.Connection> {
    const conn = new jsforce.Connection({
      loginUrl: this.credentials.loginUrl ?? this.credentials.instanceUrl ?? 'https://login.salesforce.com',
      version: '59.0',
    });
    await conn.login(this.credentials.username, this.credentials.password);
    return conn;
  }

  async testConnection(): Promise<TestResult> {
    const start = Date.now();
    try {
      const conn = await this.getConnection();
      await conn.identity();
      return { success: true, message: 'Connected successfully', latencyMs: Date.now() - start };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed',
        latencyMs: Date.now() - start,
      };
    }
  }

  async listObjects(): Promise<ObjectMeta[]> {
    const conn = await this.getConnection();
    const result = await conn.describeGlobal();
    return result.sobjects
      .filter((o) => o.queryable)
      .map((o) => ({
        name: o.name,
        label: o.label,
        type: 'object' as const,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  async getSchema(objectName: string): Promise<FieldMeta[]> {
    const conn = await this.getConnection();
    const meta = await conn.sobject(objectName).describe();
    return meta.fields.map((f) => ({
      name: f.name,
      label: f.label,
      type: f.type,
      nullable: f.nillable,
      isPrimary: f.name === 'Id',
      length: f.length > 0 ? f.length : undefined,
    }));
  }

  async fetchData(objectName: string, options: FetchDataOptions): Promise<DataResponse> {
    const conn = await this.getConnection();
    const meta = await conn.sobject(objectName).describe();
    const fields = meta.fields.slice(0, 20).map((f) => f.name);
    const fieldList = fields.join(', ');

    const offset = (options.page - 1) * options.pageSize;
    let soql = `SELECT ${fieldList} FROM ${objectName}`;
    if (options.filter) {
      soql += ` WHERE Name LIKE '%${options.filter.replace(/'/g, "\\'")}%'`;
    }
    if (options.sort) {
      soql += ` ORDER BY ${options.sort.field} ${options.sort.direction.toUpperCase()}`;
    }
    soql += ` LIMIT ${options.pageSize} OFFSET ${offset}`;

    const countSoql = `SELECT COUNT() FROM ${objectName}${options.filter ? ` WHERE Name LIKE '%${options.filter.replace(/'/g, "\\'")}%'` : ''}`;

    const [result, countResult] = await Promise.all([
      conn.query<Record<string, unknown>>(soql),
      conn.query<Record<string, unknown>>(countSoql),
    ]);

    const rows = result.records.map((r) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { attributes: _a, ...rest } = r as Record<string, unknown>;
      return rest;
    });

    return {
      rows,
      total: countResult.totalSize,
      page: options.page,
      pageSize: options.pageSize,
    };
  }

  async executeQuery(query: string, options: { page: number; pageSize: number }): Promise<QueryResponse> {
    const conn = await this.getConnection();
    const offset = (options.page - 1) * options.pageSize;

    let soql = query.trim().replace(/;$/, '');
    if (!/LIMIT\s+\d+/i.test(soql)) {
      soql += ` LIMIT ${options.pageSize} OFFSET ${offset}`;
    }

    const result = await conn.query<Record<string, unknown>>(soql);
    const rows = result.records.map((r) => {
      const { attributes: _a, ...rest } = r as Record<string, unknown> & { attributes?: unknown };
      return rest;
    });

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { rows, total: result.totalSize, columns };
  }
}
