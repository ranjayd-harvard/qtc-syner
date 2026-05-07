import type { ObjectId } from 'mongodb';

export type ConnectionType = 'salesforce' | 'netsuite' | 'redshift';
export type ConnectionStatus = 'active' | 'error' | 'untested';

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

export interface ConnectionDocument {
  _id?: ObjectId;
  name: string;
  type: ConnectionType;
  status: ConnectionStatus;
  encryptedCredentials: string;
  encryptionIv: string;
  encryptionTag: string;
  lastTestedAt?: Date;
  lastErrorMessage?: string;
  objectCount?: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectionSummary {
  id: string;
  name: string;
  type: ConnectionType;
  status: ConnectionStatus;
  lastTestedAt?: string;
  lastErrorMessage?: string;
  objectCount?: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionFormValues {
  name: string;
  type: ConnectionType;
  credentials: SalesforceCredentials | NetSuiteCredentials | RedshiftCredentials;
}
