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
