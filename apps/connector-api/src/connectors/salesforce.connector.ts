import jsforce from 'jsforce';
import type { BaseConnector } from './base.connector.js';
import type {
  SalesforceCredentials,
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

export class SalesforceConnector implements BaseConnector {
  private credentials: SalesforceCredentials;

  constructor(credentials: SalesforceCredentials) {
    this.credentials = credentials;
  }

  private async getConnection() {
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

  // Objects Salesforce marks queryable:false but are practically usable with SOQL
  private static readonly QUERYABLE_ALLOWLIST = new Set(['PricebookEntry', 'PriceBookEntry']);

  async listObjects(): Promise<ObjectMeta[]> {
    const conn = await this.getConnection();
    const result = await conn.describeGlobal();
    return result.sobjects
      .filter((o) => o.queryable || SalesforceConnector.QUERYABLE_ALLOWLIST.has(o.name))
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

    const stripAttrs = (r: Record<string, unknown>) => {
      const { attributes: _a, ...rest } = r;
      return rest;
    };

    // ── Path 1: cursor (queryMore) ────────────────────────────────────────────
    // Salesforce caps SOQL OFFSET at 2000 for some objects (e.g. PricebookEntry).
    // After the first streamMode fetch we receive a nextRecordsUrl; subsequent pages
    // call queryMore which has no OFFSET restriction.
    if (options.cursor) {
      const result = await conn.queryMore<Record<string, unknown>>(options.cursor);
      return {
        rows: result.records.map(stripAttrs),
        total: result.totalSize,
        page: options.page,
        pageSize: options.pageSize,
        nextCursor: result.done ? undefined : result.nextRecordsUrl ?? undefined,
      };
    }

    // ── Path 2: streamMode (no LIMIT/OFFSET) ──────────────────────────────────
    // Used on the first bulk-fetch page. Omitting LIMIT causes Salesforce to set
    // nextRecordsUrl on the response (batched at ~2000 internally), giving us a
    // cursor we can follow without hitting the OFFSET cap.
    if (options.streamMode) {
      const meta = await conn.sobject(objectName).describe();
      const fields = meta.fields.slice(0, 20).map((f) => f.name);
      let soql = `SELECT ${fields.join(', ')} FROM ${objectName}`;
      if (options.filter) {
        soql += ` WHERE Name LIKE '%${options.filter.replace(/'/g, "\\'")}%'`;
      }
      const result = await conn.query<Record<string, unknown>>(soql);
      const rows = result.records.map(stripAttrs);
      return {
        rows,
        total: result.totalSize,
        page: 1,
        pageSize: rows.length,
        nextCursor: result.done ? undefined : result.nextRecordsUrl ?? undefined,
      };
    }

    // ── Path 3: standard OFFSET pagination (Explorer UI) ─────────────────────
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

    return {
      rows: result.records.map(stripAttrs),
      total: countResult.totalSize,
      page: options.page,
      pageSize: options.pageSize,
    };
  }

  async upsertRecords(objectName: string, records: DataRow[], options: UpsertOptions): Promise<UpsertResult> {
    const conn = await this.getConnection();
    const result: UpsertResult = { created: 0, updated: 0, failed: 0, results: [] };
    const BATCH_SIZE = 200;

    interface SFSaveResult { success: boolean; id?: string; errors?: Array<{ message: string }> }
    interface SFUpsertResult extends SFSaveResult { created?: boolean }

    for (let offset = 0; offset < records.length; offset += BATCH_SIZE) {
      const batch = records.slice(offset, offset + BATCH_SIZE);

      if (options.mode === 'create') {
        const raw = await (conn.sobject(objectName) as unknown as {
          create(r: DataRow[]): Promise<SFSaveResult[]>
        }).create(batch);
        const arr = Array.isArray(raw) ? raw : [raw as SFSaveResult];
        for (const [i, sr] of arr.entries()) {
          if (sr.success) {
            result.created++;
            result.results.push({ index: offset + i, success: true, id: sr.id });
          } else {
            result.failed++;
            result.results.push({ index: offset + i, success: false, error: sr.errors?.[0]?.message ?? 'Unknown error' });
          }
        }
      } else if (options.mode === 'upsert' && options.externalIdField) {
        const raw = await (conn.sobject(objectName) as unknown as {
          upsert(r: DataRow[], field: string): Promise<SFUpsertResult[]>
        }).upsert(batch, options.externalIdField);
        const arr = Array.isArray(raw) ? raw : [raw as SFUpsertResult];
        for (const [i, ur] of arr.entries()) {
          if (ur.success) {
            if (ur.created) result.created++; else result.updated++;
            result.results.push({ index: offset + i, success: true, id: ur.id });
          } else {
            result.failed++;
            result.results.push({ index: offset + i, success: false, error: ur.errors?.[0]?.message ?? 'Unknown error' });
          }
        }
      } else if (options.mode === 'update') {
        const raw = await (conn.sobject(objectName) as unknown as {
          update(r: DataRow[]): Promise<SFSaveResult[]>
        }).update(batch);
        const arr = Array.isArray(raw) ? raw : [raw as SFSaveResult];
        for (const [i, sr] of arr.entries()) {
          if (sr.success) {
            result.updated++;
            result.results.push({ index: offset + i, success: true, id: sr.id });
          } else {
            result.failed++;
            result.results.push({ index: offset + i, success: false, error: sr.errors?.[0]?.message ?? 'Unknown error' });
          }
        }
      }
    }

    return result;
  }

  async executeQuery(query: string, options: { page: number; pageSize: number; cursor?: string }): Promise<QueryResponse> {
    const conn = await this.getConnection();

    const stripAttrs = (r: Record<string, unknown>) => {
      const { attributes: _a, ...rest } = r as Record<string, unknown> & { attributes?: unknown };
      return rest;
    };

    // Cursor path — avoids OFFSET entirely; used by bulk-fetch for Account and other
    // objects where Salesforce caps OFFSET at 2000.
    if (options.cursor) {
      const result = await conn.queryMore<Record<string, unknown>>(options.cursor);
      const rows = result.records.map(stripAttrs);
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      return {
        rows,
        total: result.totalSize,
        columns,
        hasMore: !result.done,
        nextCursor: result.done ? undefined : result.nextRecordsUrl ?? undefined,
      };
    }

    // Page 1 — run with LIMIT only (no OFFSET), Salesforce sets nextRecordsUrl so
    // callers can follow pages without hitting the 2000-row OFFSET cap.
    if (options.page === 1) {
      let soql = query.trim().replace(/;$/, '');
      if (!/LIMIT\s+\d+/i.test(soql)) soql += ` LIMIT ${options.pageSize}`;
      const result = await conn.query<Record<string, unknown>>(soql);
      const rows = result.records.map(stripAttrs);
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      return {
        rows,
        total: result.totalSize,
        columns,
        hasMore: !result.done,
        nextCursor: result.done ? undefined : result.nextRecordsUrl ?? undefined,
      };
    }

    // Page > 1 without a cursor — OFFSET fallback (query editor; breaks >2000 for
    // some objects but that is a query-editor limitation, not the bulk-fetch path).
    const offset = (options.page - 1) * options.pageSize;
    let soql = query.trim().replace(/;$/, '');
    if (!/LIMIT\s+\d+/i.test(soql)) soql += ` LIMIT ${options.pageSize} OFFSET ${offset}`;
    const result = await conn.query<Record<string, unknown>>(soql);
    const rows = result.records.map(stripAttrs);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { rows, total: result.totalSize, columns };
  }
}
