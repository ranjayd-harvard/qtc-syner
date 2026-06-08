import type { TestResult, ObjectMeta, FieldMeta, DataResponse, QueryResponse, FetchDataOptions } from '@/types/connector';
import type { ConnectionType, RawCredentials } from '@/types/connection';

export interface UpsertOptions {
  mode: 'create' | 'update' | 'upsert';
  externalIdField?: string;
}

export interface UpsertRecordResult {
  index: number;
  success: boolean;
  id?: string;
  error?: string;
}

export interface UpsertResult {
  created: number;
  updated: number;
  failed: number;
  results: UpsertRecordResult[];
}

const BASE = process.env.CONNECTOR_API_URL!;
const KEY = process.env.CONNECTOR_INTERNAL_KEY!;

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-api-key': KEY,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Connector API error (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

export const connectorClient = {
  test(type: ConnectionType, credentials: RawCredentials): Promise<TestResult> {
    return post('/api/test', { type, credentials });
  },

  objects(type: ConnectionType, credentials: RawCredentials): Promise<{ objects: ObjectMeta[] }> {
    return post('/api/objects', { type, credentials });
  },

  data(
    type: ConnectionType,
    credentials: RawCredentials,
    objectName: string,
    options: FetchDataOptions
  ): Promise<DataResponse> {
    return post(`/api/data/${encodeURIComponent(objectName)}`, { type, credentials, options });
  },

  schema(
    type: ConnectionType,
    credentials: RawCredentials,
    objectName: string
  ): Promise<{ fields: FieldMeta[] }> {
    return post(`/api/schema/${encodeURIComponent(objectName)}`, { type, credentials });
  },

  query(
    type: ConnectionType,
    credentials: RawCredentials,
    query: string,
    options: { page: number; pageSize: number; cursor?: string }
  ): Promise<QueryResponse> {
    return post('/api/query', { type, credentials, query, options });
  },

  upsertRecords(
    type: ConnectionType,
    credentials: RawCredentials,
    objectName: string,
    records: Record<string, unknown>[],
    options: UpsertOptions
  ): Promise<UpsertResult> {
    return post('/api/upsert', { type, credentials, objectName, records, options });
  },
};
