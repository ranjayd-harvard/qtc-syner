import type {
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

export interface BaseConnector {
  testConnection(): Promise<TestResult>;
  listObjects(): Promise<ObjectMeta[]>;
  getSchema(objectName: string): Promise<FieldMeta[]>;
  fetchData(objectName: string, options: FetchDataOptions): Promise<DataResponse>;
  executeQuery(query: string, options: { page: number; pageSize: number; cursor?: string }): Promise<QueryResponse>;
  upsertRecords(objectName: string, records: DataRow[], options: UpsertOptions): Promise<UpsertResult>;
}
