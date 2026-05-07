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

export interface DataResponse {
  rows: DataRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface QueryResponse {
  rows: DataRow[];
  total: number;
  columns: string[];
}

export interface TestResult {
  success: boolean;
  message: string;
  latencyMs: number;
}
