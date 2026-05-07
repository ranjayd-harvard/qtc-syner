import { SalesforceConnector } from '../connectors/salesforce.connector.js';
import { NetSuiteConnector } from '../connectors/netsuite.connector.js';
import { RedshiftConnector } from '../connectors/redshift.connector.js';
import type { BaseConnector } from '../connectors/base.connector.js';
import type {
  ConnectionType,
  RawCredentials,
  SalesforceCredentials,
  NetSuiteCredentials,
  RedshiftCredentials,
} from '../types/index.js';

export function createConnector(type: ConnectionType, credentials: RawCredentials): BaseConnector {
  switch (type) {
    case 'salesforce':
      return new SalesforceConnector(credentials as SalesforceCredentials);
    case 'netsuite':
      return new NetSuiteConnector(credentials as NetSuiteCredentials);
    case 'redshift':
      return new RedshiftConnector(credentials as RedshiftCredentials);
    default:
      throw new Error(`Unknown connection type: ${type}`);
  }
}
