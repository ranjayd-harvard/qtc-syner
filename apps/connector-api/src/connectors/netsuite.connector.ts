import crypto from 'crypto';
import OAuth from 'oauth-1.0a';
import type { BaseConnector } from './base.connector.js';
import type {
  NetSuiteCredentials,
  TestResult,
  ObjectMeta,
  FieldMeta,
  DataResponse,
  QueryResponse,
  FetchDataOptions,
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

  async listObjects(): Promise<ObjectMeta[]> {
    interface NSCatalogItem { name: string; links: unknown[] }
    interface NSCatalogResponse { items: NSCatalogItem[]; totalResults: number }
    const result = await this.request<NSCatalogResponse>('GET', '/record/v1/metadata-catalog/');
    return result.items
      .filter((i) => !!i.name)
      .map((i) => ({
        name: i.name,
        label: i.name.replace(/([A-Z])/g, ' $1').trim(),
        type: 'object' as const,
      }));
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

    const result = await this.request<NSSuiteQLResponse>('POST', '/query/v1/suiteql', { q: sql });
    return {
      rows: result.items,
      total: result.totalResults,
      page: options.page,
      pageSize: options.pageSize,
    };
  }

  async executeQuery(query: string, options: { page: number; pageSize: number }): Promise<QueryResponse> {
    interface NSSuiteQLResponse {
      items: Record<string, unknown>[];
      totalResults: number;
    }
    const offset = (options.page - 1) * options.pageSize;
    let sql = query.trim().replace(/;$/, '');
    if (!/OFFSET\s+\d+/i.test(sql)) {
      sql += ` OFFSET ${offset} ROWS FETCH NEXT ${options.pageSize} ROWS ONLY`;
    }

    const result = await this.request<NSSuiteQLResponse>('POST', '/query/v1/suiteql', { q: sql });
    const columns = result.items.length > 0 ? Object.keys(result.items[0]) : [];
    return { rows: result.items, total: result.totalResults, columns };
  }
}
