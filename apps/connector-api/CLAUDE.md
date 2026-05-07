# apps/connector-api — Claude Context

Express 4 microservice that executes all external data source connections. It is **internal only** — never exposed to the browser, only reachable from the `web` container via the `qtc-internal` Docker network.

## Stack

| Library | Role |
|---------|------|
| Express 4 | HTTP server |
| jsforce | Salesforce REST/SOAP API client |
| pg | PostgreSQL client (used for Redshift) |
| oauth-1.0a + crypto-js | NetSuite Token-Based Auth signing |
| node-fetch | HTTP calls for NetSuite REST API |

## Directory structure

```
src/
├── connectors/
│   ├── base.connector.ts        # Interface — all connectors implement this
│   ├── salesforce.connector.ts  # jsforce-based Salesforce connector
│   ├── netsuite.connector.ts    # OAuth 1.0a NetSuite REST + SuiteQL
│   └── redshift.connector.ts    # pg pool Redshift/PostgreSQL connector
├── factory/
│   └── connector.factory.ts     # Creates connector instance from {type, credentials}
├── middleware/
│   ├── auth.middleware.ts       # Validates x-internal-api-key header
│   └── error.middleware.ts      # Global error handler → JSON error response
├── routes/
│   ├── test.ts                  # POST /test
│   ├── objects.ts               # POST /objects
│   ├── schema.ts                # POST /schema/:objectName
│   ├── data.ts                  # POST /data/:objectName
│   └── query.ts                 # POST /query
├── types/
│   └── index.ts                 # ConnectorRequest, DataRequest, QueryRequest, response types
└── index.ts                     # Express app setup, route mounting, /health endpoint
```

## BaseConnector interface

Every connector must implement:

```typescript
interface BaseConnector {
  testConnection(): Promise<TestResult>
  listObjects(): Promise<ObjectMeta[]>
  getSchema(objectName: string): Promise<FieldMeta[]>
  fetchData(objectName: string, options: FetchDataOptions): Promise<DataResponse>
  executeQuery(query: string, options: { page: number; pageSize: number }): Promise<QueryResponse>
}
```

## Request/response pattern

All routes receive credentials in the POST body — they are never stored here:

```typescript
// POST /data/:objectName
{
  type: 'salesforce' | 'netsuite' | 'redshift',
  credentials: { /* type-specific */ },
  options: { page, pageSize, sort, direction, filter }
}
```

The factory creates a fresh connector per request — no connection pooling across requests (except Redshift, which uses a `pg.Pool`).

## Connector notes

### SalesforceConnector
- Auth: username + password + security token (concatenated in `password` field)
- `fetchData`: builds SOQL — selects first 20 fields, applies WHERE for filter, ORDER BY for sort, LIMIT/OFFSET for pagination
- `executeQuery`: injects LIMIT/OFFSET into raw SOQL if not present

### NetSuiteConnector
- Auth: OAuth 1.0a Token-Based Auth (TBA) — signs every request with HMAC-SHA256
- Base URL: `https://{accountId}.suitetalk.api.netsuite.com/services/rest`
- `listObjects`: calls `/metadata-catalog/suiteql-table`
- `getSchema`: tries metadata catalog first; falls back to SuiteQL `SELECT * FROM {table} WHERE ROWNUM <= 1` to infer columns
- `fetchData`: SuiteQL with `REGEXP_LIKE` for filtering, `ORDER BY` for sort, `OFFSET`/`FETCH NEXT` for pagination

### RedshiftConnector
- Uses `pg.Pool` — creates a new pool per request (stateless for now)
- `listObjects`: queries `information_schema.tables` for `BASE TABLE` and `VIEW` types; names returned as `schema.table_name`
- `fetchData`: safe identifier quoting for table/column names; CAST to TEXT for ILIKE filter; COUNT(*) OVER() for total
- SSL: optional — set `ssl: { rejectUnauthorized: false }` when `credentials.ssl` is true

## Adding a new connector

1. Create `src/connectors/<name>.connector.ts` implementing `BaseConnector`
2. Add `'<name>'` to the `ConnectionType` union in `src/types/index.ts`
3. Register in `src/factory/connector.factory.ts`:
   ```typescript
   case '<name>': return new NameConnector(credentials as NameCredentials)
   ```

## Auth

Requests must include `x-internal-api-key: <CONNECTOR_INTERNAL_KEY>`. The middleware in `auth.middleware.ts` rejects anything missing or mismatched with 401.

## Environment variables

See `.env.example`. Key vars:

| Variable | Purpose |
|---|---|
| `PORT` | Server port (default 4000) |
| `INTERNAL_API_KEY` | Must match `CONNECTOR_INTERNAL_KEY` in web app |
| `NODE_ENV` | `development` or `production` |
