import type { TestResult, ObjectMeta, FieldMeta, DataResponse, QueryResponse, FetchDataOptions } from '@/types/connector';
import type { ConnectionType, RawCredentials } from '@/types/connection';

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
    options: { page: number; pageSize: number }
  ): Promise<QueryResponse> {
    return post('/api/query', { type, credentials, query, options });
  },
};
