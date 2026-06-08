export type ConnectionType = 'salesforce' | 'netsuite' | 'redshift';

export interface SalesforceCredentials {
  loginUrl: string;
  instanceUrl?: string; // legacy alias for loginUrl, kept for backward compat with stored credentials
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}

export interface NetSuiteCredentials {
  accountId: string;
  consumerKey: string;
  consumerSecret: string;
  tokenId: string;
  tokenSecret: string;
}

export interface RedshiftCredentials {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

export type RawCredentials =
  | SalesforceCredentials
  | NetSuiteCredentials
  | RedshiftCredentials;

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
  cursor?: string;    // jsforce queryMore URL — bypasses OFFSET when provided
  streamMode?: boolean; // skip LIMIT/OFFSET so Salesforce sets nextRecordsUrl on the result
}

export interface DataResponse {
  rows: DataRow[];
  total: number;
  page: number;
  pageSize: number;
  nextCursor?: string; // set when more records exist beyond this page (Salesforce only)
}

export interface QueryResponse {
  rows: DataRow[];
  total: number;
  columns: string[];
  hasMore?: boolean; // reliable "more pages" signal — set by connectors that return it natively
  nextCursor?: string; // Salesforce queryMore URL — avoids OFFSET cap on subsequent pages
}

export interface TestResult {
  success: boolean;
  message: string;
  latencyMs: number;
}

export interface ConnectorRequest {
  type: ConnectionType;
  credentials: RawCredentials;
}

export interface DataRequest extends ConnectorRequest {
  options: FetchDataOptions;
}

export interface QueryRequest extends ConnectorRequest {
  query: string;
  options: { page: number; pageSize: number };
}

export type UpsertMode = 'create' | 'update' | 'upsert';

export interface UpsertOptions {
  mode: UpsertMode;
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

export interface UpsertRequest extends ConnectorRequest {
  objectName: string;
  records: DataRow[];
  options: UpsertOptions;
}
