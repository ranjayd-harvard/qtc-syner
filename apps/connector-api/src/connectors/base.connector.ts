import type {
  TestResult,
  ObjectMeta,
  FieldMeta,
  DataResponse,
  QueryResponse,
  FetchDataOptions,
} from '../types/index.js';

export interface BaseConnector {
  testConnection(): Promise<TestResult>;
  listObjects(): Promise<ObjectMeta[]>;
  getSchema(objectName: string): Promise<FieldMeta[]>;
  fetchData(objectName: string, options: FetchDataOptions): Promise<DataResponse>;
  executeQuery(query: string, options: { page: number; pageSize: number }): Promise<QueryResponse>;
}
