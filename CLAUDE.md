# QTC Syncer — Claude Context

This is a **multi-source data connector platform** (Salesforce, NetSuite, AWS Redshift) built as a Docker-compose monorepo. Users authenticate, connect external data sources, and explore/compare data through a web UI.

## Repo layout

```
qtc-syncer/
├── apps/
│   ├── web/               # Next.js 14 App Router — UI + BFF API
│   └── connector-api/     # Express 4 microservice — executes connector calls
├── docker/
│   └── mongo-init/        # MongoDB init scripts (indexes, TTL)
├── docker-compose.yml          # Production
├── docker-compose.dev.yml      # Development (adds mongo-express, hot reload volumes)
├── docker-compose.vpn.yml      # VPN mode (connector-api runs on host, not in Docker)
└── package.json                # Workspaces root + dev/prod scripts
```

## Architecture

```
Browser → Next.js web (3061)
            ├─ /api/* routes (BFF — decrypt creds, call connector-api, log activity)
            └─ MongoDB (27017) — encrypted connection configs + activity logs
                        ↓
              connector-api (4000, internal only)
                        ↓
          Salesforce | NetSuite | Redshift
```

- `web` talks to `connector-api` via `x-internal-api-key` header — the connector service is never exposed to the browser.
- Credentials are encrypted **AES-256-GCM** at rest in MongoDB. Decryption only happens server-side in `apps/web/src/lib/encryption.ts` immediately before forwarding to connector-api.
- All connector-api calls are fire-and-forget from the web BFF; the BFF logs activity to MongoDB after each call.

## Running locally

```bash
cp .env.example .env          # fill in secrets (see README)
npm run dev                   # starts all 4 containers with hot reload
```

VPN mode (when Redshift/NetSuite is VPN-gated):
```bash
npm run dev:vpn               # MongoDB + web in Docker
npm run connector:dev         # connector-api on host machine (separate terminal)
```

## Key files to know

| Path | What it does |
|------|-------------|
| `apps/web/src/lib/encryption.ts` | AES-256-GCM encrypt/decrypt for stored credentials |
| `apps/web/src/lib/connector-client.ts` | HTTP client for web→connector-api calls |
| `apps/web/src/lib/mongodb.ts` | MongoDB client singleton with connection pooling |
| `apps/web/src/lib/auth.ts` | NextAuth config (credentials provider, MongoDB session adapter) |
| `apps/web/src/models/Connection.ts` | All DB ops for the `connections` collection |
| `apps/web/src/models/ActivityLog.ts` | All DB ops for the `activity_logs` collection |
| `apps/web/src/middleware.ts` | Route protection — redirects unauthenticated requests to /login |
| `apps/connector-api/src/factory/connector.factory.ts` | Creates the right connector from `{type, credentials}` |
| `apps/connector-api/src/connectors/base.connector.ts` | Interface every connector must implement |

## Data flow for a data fetch

1. Browser calls `GET /api/connections/[id]/data/[objectName]?page=1&pageSize=50&sort=Name&direction=asc&filter=foo`
2. `apps/web/src/app/api/connections/[id]/data/[objectName]/route.ts` — decrypts credentials, calls connector-api, logs to ActivityLog
3. `apps/connector-api/src/routes/data.ts` → `ConnectorFactory.create()` → `connector.fetchData()`
4. Response: `{ rows, total, page, pageSize }`

## Adding a new connector

1. Create `apps/connector-api/src/connectors/<name>.connector.ts` implementing `BaseConnector`
2. Register it in `apps/connector-api/src/factory/connector.factory.ts`
3. Add credential type to `apps/connector-api/src/types/index.ts` and `apps/web/src/types/connection.ts`
4. Add a `<NameFields />` credential form component in `apps/web/src/components/connections/`
5. Wire the new component into `ConnectionForm.tsx`

## Adding a new page/feature

- Pages go under `apps/web/src/app/(dashboard)/` — they automatically get the authenticated layout from `layout.tsx`
- Add nav link in `apps/web/src/components/layout/Sidebar.tsx`
- BFF API routes go under `apps/web/src/app/api/`
- Shared UI components go in `apps/web/src/components/ui/` (shadcn-style)
- Feature components go in their own subfolder: `apps/web/src/components/<feature>/`

## Coding conventions

- **TypeScript strict** everywhere — no `any` unless unavoidable
- **Server components by default** in `app/`; add `"use client"` only when React state/effects are needed
- API route handlers follow the pattern: validate → decrypt credentials → call connector-api → log activity → return JSON
- React Query (`@tanstack/react-query`) for all client-side data fetching — see `apps/web/src/hooks/`
- shadcn/ui components are the UI primitive layer; custom components wrap them
- Tailwind utility classes only — no CSS modules or styled-components

## Activity logging

Every connector operation is logged via `logActivity()` in `apps/web/src/models/ActivityLog.ts`.

Event types: `test | fetch_objects | fetch_data | fetch_schema | execute_query | create | update | delete`

Logs include: `connectionId`, `connectionName`, `eventType`, `status` (success/error), `durationMs`, optional `metadata` (objectName, rowCount, error message).

## MongoDB collections

| Collection | Purpose | Notable |
|---|---|---|
| `connections` | Connection configs with encrypted credentials | Indexed on `type`, `status` |
| `activity_logs` | Per-connection event history | 30-day TTL, indexed on `connectionId` + `createdAt` |
| `sessions` | NextAuth sessions | Managed by NextAuth adapter |

## Current features

- **Dashboard** — stats grid, connection health cards, pie chart by source type, recent activity feed
- **Connection Manager** — CRUD connections, test connectivity, view sync history
- **Data Explorer** — browse objects/tables, paginated data table with sort/filter/CSV export
- **Schema Viewer** — field-level metadata (type, nullable, primary key, length)
- **Query Editor** — SOQL (Salesforce), SuiteQL (NetSuite), SQL (Redshift)
- **Schema Compare** — side-by-side field comparison across any two connection+object pairs with match/mismatch/left-only/right-only classification

## Potential future features (not yet built)

- Data sync jobs — scheduled pulls from source into a local store or data warehouse
- Field-level data preview in Schema Viewer
- Saved queries per connection
- Multi-object JOIN explorer (cross-object query builder)
- Role-based access control (read-only vs admin users)
- Webhook / change-data-capture notifications
- Additional connectors: HubSpot, Snowflake, BigQuery, PostgreSQL (generic)
- Export to Google Sheets / CSV (already partial via DataTable toolbar)
- Diff view for data across two points in time (temporal compare)
