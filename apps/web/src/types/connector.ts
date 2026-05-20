export interface ObjectMeta {
  name: string;
  label: string;
  count?: number;
  type: 'object' | 'table' | 'view';
}

export interface FieldMeta {
  name: string;
  label: string;
  type: string;
  nullable: boolean;
  isPrimary: boolean;
  length?: number;
}

export type DataRow = Record<string, unknown>;

export interface SortSpec {
  field: string;
  direction: 'asc' | 'desc';
}

export interface FetchDataOptions {
  page: number;
  pageSize: number;
  sort?: SortSpec;
  filter?: string;
  cursor?: string;
  streamMode?: boolean;
}

export interface DataResponse {
  rows: DataRow[];
  total: number;
  page: number;
  pageSize: number;
  nextCursor?: string;
}

export interface QueryResponse {
  rows: DataRow[];
  total: number;
  columns: string[];
  hasMore?: boolean;
}

export interface TestResult {
  success: boolean;
  message: string;
  latencyMs: number;
}
