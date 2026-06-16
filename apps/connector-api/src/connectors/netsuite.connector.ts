import crypto from 'crypto';
import OAuth from 'oauth-1.0a';
import type { BaseConnector } from './base.connector.js';
import type {
  NetSuiteCredentials,
  TestResult,
  ObjectMeta,
  FieldMeta,
  DataResponse,
  DataRow,
  QueryResponse,
  FetchDataOptions,
  UpsertOptions,
  UpsertResult,
  UpsertRecordResult,
} from '../types/index.js';

export class NetSuiteConnector implements BaseConnector {
  private credentials: NetSuiteCredentials;
  private baseUrl: string;
  private oauth: OAuth;

  constructor(credentials: NetSuiteCredentials) {
    this.credentials = credentials;
    // NetSuite REST URLs require lowercase with hyphens (e.g. 1234567_SB1 → 1234567-sb1)
    const urlAccountId = credentials.accountId.toLowerCase().replace(/_/g, '-');
    this.baseUrl = `https://${urlAccountId}.suitetalk.api.netsuite.com/services/rest`;

    this.oauth = new OAuth({
      consumer: { key: credentials.consumerKey, secret: credentials.consumerSecret },
      signature_method: 'HMAC-SHA256',
      hash_function: (baseString, key) =>
        crypto.createHmac('sha256', key).update(baseString).digest('base64'),
    });
  }

  private getAuthHeader(method: string, url: string): string {
    const token = { key: this.credentials.tokenId, secret: this.credentials.tokenSecret };
    const { Authorization } = this.oauth.toHeader(
      this.oauth.authorize({ url, method }, token)
    );
    // realm must use underscores and uppercase to match NetSuite's account ID format exactly
    const realm = this.credentials.accountId.toUpperCase().replace(/-/g, '_');
    return Authorization.replace('OAuth ', `OAuth realm="${realm}", `);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: this.getAuthHeader(method, url),
      'Content-Type': 'application/json',
    };
    if (body) headers['prefer'] = 'transient';
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`NetSuite API error ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async testConnection(): Promise<TestResult> {
    const start = Date.now();
    try {
      await this.request('GET', '/record/v1/metadata-catalog/', undefined);
      return { success: true, message: 'Connected successfully', latencyMs: Date.now() - start };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed',
        latencyMs: Date.now() - start,
      };
    }
  }

  private async listRecordApiObjects(): Promise<ObjectMeta[]> {
    interface NSCatalogItem { name: string; links: unknown[] }
    interface NSCatalogResponse { items: NSCatalogItem[]; totalResults: number }
    try {
      const result = await this.request<NSCatalogResponse>('GET', '/record/v1/metadata-catalog/');
      return result.items
        .filter((i) => !!i.name)
        .map((i) => ({
          name: i.name,
          label: i.name.replace(/([A-Z])/g, ' $1').trim(),
          type: 'object' as const,
        }));
    } catch {
      return [];
    }
  }

  private async listSuiteQLTables(): Promise<ObjectMeta[]> {
    type NSRow = Record<string, unknown>;
    interface NSSuiteQLResponse { items: NSRow[]; totalResults: number }

    // Try dynamic discovery first (OA_TABLES, then information_schema).
    // Both may be unavailable depending on the NS account/version — the REST SuiteQL endpoint
    // does not always expose metadata catalog tables.
    const discoveryQueries = [
      'SELECT * FROM OA_TABLES ORDER BY tableName OFFSET 0 ROWS FETCH NEXT 1000 ROWS ONLY',
      'SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.tables ORDER BY TABLE_NAME OFFSET 0 ROWS FETCH NEXT 1000 ROWS ONLY',
    ];

    for (const q of discoveryQueries) {
      try {
        const result = await this.request<NSSuiteQLResponse>('POST', '/query/v1/suiteql', { q });
        if (result.items?.length > 0) {
          return result.items
            .map((row) => {
              const name = String(
                row.tableName ?? row.tablename ?? row.TABLE_NAME ?? row.name ?? ''
              );
              const label = String(
                row.tableLabel ?? row.tablelabel ?? row.TABLE_LABEL ?? name
              );
              return { name, label: label || name, type: 'table' as const };
            })
            .filter((obj) => !!obj.name);
        }
      } catch { /* try next */ }
    }

    // Fallback: well-known NetSuite SuiteQL tables for data integration use-cases.
    // These are the underlying database tables (not Record API types) and are always
    // queryable via /query/v1/suiteql even if the metadata catalog is unavailable.
    return [
      { name: 'item',                 label: 'Item — all item types',             type: 'table' as const },
      { name: 'transaction',          label: 'Transaction — all types',           type: 'table' as const },
      { name: 'transactionLine',      label: 'Transaction Line',                  type: 'table' as const },
      { name: 'transactionAccountingLine', label: 'Transaction Accounting Line',  type: 'table' as const },
      { name: 'customer',             label: 'Customer',                          type: 'table' as const },
      { name: 'contact',              label: 'Contact',                           type: 'table' as const },
      { name: 'employee',             label: 'Employee',                          type: 'table' as const },
      { name: 'vendor',               label: 'Vendor',                            type: 'table' as const },
      { name: 'partner',              label: 'Partner',                           type: 'table' as const },
      { name: 'account',              label: 'Account — chart of accounts',       type: 'table' as const },
      { name: 'accountingPeriod',     label: 'Accounting Period',                 type: 'table' as const },
      { name: 'department',           label: 'Department',                        type: 'table' as const },
      { name: 'location',             label: 'Location',                          type: 'table' as const },
      { name: 'subsidiary',           label: 'Subsidiary',                        type: 'table' as const },
      { name: 'currency',             label: 'Currency',                          type: 'table' as const },
      { name: 'class',                label: 'Class — classification',            type: 'table' as const },
      { name: 'opportunity',          label: 'Opportunity',                       type: 'table' as const },
      { name: 'supportCase',          label: 'Support Case',                      type: 'table' as const },
      { name: 'project',              label: 'Project',                           type: 'table' as const },
      { name: 'projectTask',          label: 'Project Task',                      type: 'table' as const },
      { name: 'billingAccount',       label: 'Billing Account',                   type: 'table' as const },
      { name: 'unitsType',            label: 'Units of Measure',                  type: 'table' as const },
      { name: 'taxGroup',             label: 'Tax Group',                         type: 'table' as const },
      { name: 'taxItem',              label: 'Tax Item',                          type: 'table' as const },
      { name: 'pricing',             label: 'Pricing — item price by level',      type: 'table' as const },
    ];
  }

  async listObjects(): Promise<ObjectMeta[]> {
    // Fetch both SuiteQL tables and Record API types in parallel.
    // SuiteQL tables are returned first (more useful for data querying/syncing).
    // Record API types that share a name with a SuiteQL table are deduplicated out.
    const [sqlTables, recordApiObjects] = await Promise.all([
      this.listSuiteQLTables(),
      this.listRecordApiObjects(),
    ]);

    const sqlNames = new Set(sqlTables.map((t) => t.name.toLowerCase()));
    const filteredRecordApi = recordApiObjects.filter(
      (obj) => !sqlNames.has(obj.name.toLowerCase())
    );

    return [...sqlTables, ...filteredRecordApi];
  }

  private inferType(value: unknown): string {
    if (value === null || value === undefined) return 'string';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'numeric';
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return 'datetime';
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date';
      return 'string';
    }
    if (Array.isArray(value)) return 'array';
    return 'object';
  }

  async getSchema(objectName: string): Promise<FieldMeta[]> {
    interface NSFieldSchema {
      title?: string;
      type?: string | string[];
      nullable?: boolean;
      $ref?: string;
    }
    interface NSRecordSchema { properties?: Record<string, NSFieldSchema> }

    // 1. Try REST metadata catalog
    try {
      const result = await this.request<NSRecordSchema>('GET', `/record/v1/metadata-catalog/${objectName}`);
      const props = result.properties ?? {};
      const fields = Object.entries(props)
        .filter(([, prop]) => !prop.$ref || prop.type)  // keep entries that have a type even if they also have $ref
        .map(([name, prop]) => {
          const types = Array.isArray(prop.type) ? prop.type : [prop.type ?? 'unknown'];
          const primaryType = types.find((t) => t !== 'null') ?? 'unknown';
          const nullable = prop.nullable ?? types.includes('null');
          return { name, label: prop.title ?? name, type: primaryType, nullable, isPrimary: name === 'id' };
        });
      if (fields.length > 0) return fields;
    } catch {
      // catalog unavailable — fall through to SuiteQL sampling
    }

    // 2. Fallback: infer schema from a single SuiteQL row
    interface NSSuiteQLResponse { items: Record<string, unknown>[]; totalResults: number }
    const sample = await this.request<NSSuiteQLResponse>('POST', '/query/v1/suiteql', {
      q: `SELECT * FROM ${objectName} OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY`,
    });
    if (sample.items.length === 0) return [];

    return Object.entries(sample.items[0]).map(([name, value]) => ({
      name,
      label: name,
      type: this.inferType(value),
      nullable: true,
      isPrimary: name === 'id',
    }));
  }

  async fetchData(objectName: string, options: FetchDataOptions): Promise<DataResponse> {
    interface NSSuiteQLResponse {
      items: Record<string, unknown>[];
      totalResults: number;
    }
    const offset = (options.page - 1) * options.pageSize;
    let sql = `SELECT * FROM ${objectName}`;
    if (options.filter) {
      sql += ` WHERE REGEXP_LIKE(name, '${options.filter.replace(/'/g, "''")}', 'i')`;
    }
    if (options.sort) {
      sql += ` ORDER BY ${options.sort.field} ${options.sort.direction.toUpperCase()}`;
    }
    sql += ` OFFSET ${offset} ROWS FETCH NEXT ${options.pageSize} ROWS ONLY`;

    try {
      const result = await this.request<NSSuiteQLResponse>('POST', '/query/v1/suiteql', { q: sql });
      return {
        rows: result.items,
        total: result.totalResults,
        page: options.page,
        pageSize: options.pageSize,
      };
    } catch (err) {
      // SuiteQL can't serve this table (not found, invalid, or no SuiteQL permission) —
      // fall back to the Record API collection endpoint which uses different permission checks.
      const errMsg = err instanceof Error ? err.message : '';
      const shouldFallback = /not found|INVALID_PARAMETER|invalid.*table|unknown.*table|USER_ERROR|permission/i.test(errMsg);
      if (!shouldFallback) throw err;

      interface NSRecordCollection {
        items: Record<string, unknown>[];
        totalResults: number;
        count: number;
      }
      const params = new URLSearchParams({
        limit: String(options.pageSize),
        offset: String(offset),
      });
      if (options.sort) {
        params.set('sort', options.sort.field);
        params.set('order', options.sort.direction.toUpperCase());
      }
      if (options.filter) params.set('q', `name CONTAIN "${options.filter}"`);

      const collection = await this.request<NSRecordCollection>(
        'GET',
        `/record/v1/${objectName}?${params.toString()}`
      );
      return {
        rows: collection.items ?? [],
        total: collection.totalResults ?? collection.count ?? 0,
        page: options.page,
        pageSize: options.pageSize,
      };
    }
  }

  private async writeRecord(method: 'POST' | 'PATCH' | 'PUT', path: string, body: Record<string, unknown>): Promise<string | undefined> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: this.getAuthHeader(method, url),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      // Extract the human-readable detail from NetSuite's structured error JSON
      let detail = text;
      try {
        const parsed = JSON.parse(text) as { 'o:errorDetails'?: { detail: string }[] };
        const first = parsed['o:errorDetails']?.[0];
        if (first?.detail) detail = first.detail;
      } catch { /* leave detail as raw text */ }
      throw new Error(`NetSuite ${method} error ${res.status}: ${detail}`);
    }
    // 204 No Content — extract created record ID from Location header
    const location = res.headers.get('Location');
    return location ? location.split('/').pop() : undefined;
  }

  async upsertRecords(objectName: string, records: DataRow[], options: UpsertOptions): Promise<UpsertResult> {
    const result: UpsertResult = { created: 0, updated: 0, failed: 0, results: [] };
    const CONCURRENCY = 5;

    const processOne = async (record: DataRow, index: number): Promise<UpsertRecordResult> => {
      try {
        if (options.mode === 'create') {
          const { id: _id, ...body } = record as Record<string, unknown>;
          const id = await this.writeRecord('POST', `/record/v1/${objectName}`, body);
          return { index, success: true, id };
        }
        if (options.mode === 'update') {
          const { id, ...body } = record as Record<string, unknown>;
          if (!id) return { index, success: false, error: 'Record missing id field for update' };
          await this.writeRecord('PATCH', `/record/v1/${objectName}/${id}`, body);
          return { index, success: true, id: String(id) };
        }
        if (options.mode === 'upsert' && options.externalIdField) {
          const extVal = (record as Record<string, unknown>)[options.externalIdField];
          if (!extVal) return { index, success: false, error: `Record missing ${options.externalIdField} for upsert` };
          const { id: _id, ...body } = record as Record<string, unknown>;
          await this.writeRecord('PUT', `/record/v1/${objectName}?externalId=${options.externalIdField}&externalIdValue=${encodeURIComponent(String(extVal))}`, body);
          return { index, success: true };
        }
        return { index, success: false, error: 'Invalid upsert options' };
      } catch (err) {
        return { index, success: false, error: String(err) };
      }
    };

    for (let i = 0; i < records.length; i += CONCURRENCY) {
      const batch = records.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map((r, j) => processOne(r, i + j)));
      for (const r of batchResults) {
        if (r.success) {
          if (options.mode === 'create') result.created++;
          else result.updated++;
        } else {
          result.failed++;
        }
        result.results.push(r);
      }
    }

    return result;
  }

  async executeQuery(query: string, options: { page: number; pageSize: number; cursor?: string }): Promise<QueryResponse> {
    interface NSSuiteQLResponse {
      items: Record<string, unknown>[];
      totalResults: number;
      hasMore?: boolean;
    }
    const sql = query.trim().replace(/;$/, '');
    const alreadyPaginated = /OFFSET\s+\d+|FETCH\s+NEXT/i.test(sql);

    let result: NSSuiteQLResponse;
    if (alreadyPaginated) {
      // Query has its own OFFSET/FETCH — run as-is, no API-level pagination
      result = await this.request<NSSuiteQLResponse>('POST', '/query/v1/suiteql', { q: sql });
    } else {
      // Use NetSuite API-level pagination (?limit=&offset=) so hasMore is reliable
      const offset = (options.page - 1) * options.pageSize;
      const path = `/query/v1/suiteql?limit=${options.pageSize}&offset=${offset}`;
      result = await this.request<NSSuiteQLResponse>('POST', path, { q: sql });
    }

    const columns = result.items.length > 0 ? Object.keys(result.items[0]) : [];
    return { rows: result.items, total: result.totalResults, hasMore: result.hasMore, columns };
  }
}
