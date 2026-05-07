# apps/web — Claude Context

Next.js 14 App Router application. Acts as both the user-facing UI and the BFF (Backend For Frontend) that orchestrates calls to `connector-api` and MongoDB.

## Stack

| Library | Role |
|---------|------|
| Next.js 14 (App Router) | Framework, routing, server components |
| NextAuth.js | Auth (credentials provider, MongoDB session store) |
| TanStack Query v5 | Client-side data fetching and cache |
| TanStack Table v8 | Headless data table (used in DataTable, CompareTable) |
| shadcn/ui | Component primitives built on Radix UI |
| Tailwind CSS 3 | Styling |
| Recharts | Dashboard pie chart |

## Directory structure

```
src/
├── app/
│   ├── (dashboard)/        # Authenticated routes (layout.tsx wraps all)
│   │   ├── page.tsx             # / → Dashboard
│   │   ├── admin/connections/   # Connection CRUD
│   │   ├── explorer/            # Data explorer
│   │   └── compare/             # Schema compare
│   ├── api/                # BFF API routes
│   │   ├── auth/[...nextauth]/  # NextAuth handler
│   │   ├── connections/         # Connection CRUD + actions
│   │   └── dashboard/           # Dashboard stats
│   ├── login/              # Public login page
│   ├── globals.css
│   └── layout.tsx          # Root layout (SessionWrapper, QueryProvider)
├── components/
│   ├── ui/                 # shadcn primitives + searchable-select
│   ├── layout/             # AppShell, Sidebar, TopBar
│   ├── connections/        # ConnectionForm, ConnectionsTable, field components
│   ├── dashboard/          # StatsGrid, StatCard, HealthCard, ActivityFeed, PieChart
│   ├── explorer/           # DataTable, SchemaViewer, QueryEditor, ObjectsList, etc.
│   └── compare/            # CompareTable
├── hooks/
│   ├── useConnections.ts   # React Query hooks for connection CRUD
│   └── useExplorer.ts      # React Query hooks for objects/data/schema/query
├── lib/
│   ├── auth.ts             # NextAuth config
│   ├── connector-client.ts # HTTP client → connector-api
│   ├── encryption.ts       # AES-256-GCM encrypt/decrypt
│   ├── mongodb.ts          # MongoDB client singleton
│   └── utils.ts            # cn() helper and misc
├── middleware.ts            # Auth guard — redirects to /login
├── models/
│   ├── Connection.ts       # connections collection CRUD
│   └── ActivityLog.ts      # activity_logs collection CRUD
├── providers/
│   ├── QueryProvider.tsx   # TanStack Query client provider
│   └── SessionWrapper.tsx  # NextAuth SessionProvider
└── types/
    ├── api.ts              # ApiError, ApiSuccess, PaginationParams
    ├── connection.ts       # ConnectionType, ConnectionStatus, credential interfaces
    └── connector.ts        # ObjectMeta, FieldMeta, DataResponse, QueryResponse
```

## BFF API route pattern

Every route under `app/api/` follows this pattern:

```typescript
export async function GET(req: Request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = await getDecryptedCredentials(params.id)  // decrypt from MongoDB
  const result = await connectorClient.fetchData(...)            // call connector-api
  await logActivity(params.id, ..., 'success')                   // log to activity_logs
  return NextResponse.json(result)
}
```

## Auth

- Login: `POST /api/auth/callback/credentials` with `email` + `password`
- Admin user seeded via `scripts/seed-admin.ts` (run once: `npx ts-node scripts/seed-admin.ts`)
- Protected routes enforced in `src/middleware.ts` — anything under `/(dashboard)` requires a session
- Sessions stored in MongoDB `sessions` collection by NextAuth

## Adding a new page

1. Create `src/app/(dashboard)/<route>/page.tsx` — automatically gets the authenticated shell
2. Add a nav entry in `src/components/layout/Sidebar.tsx`
3. If the page needs server data, create `src/app/api/<route>/route.ts` for the BFF endpoint
4. If the page needs client-side fetching, add a hook in `src/hooks/`

## Adding a new connection credential type

1. Add credential interface to `src/types/connection.ts`
2. Create `src/components/connections/<Type>Fields.tsx`
3. Import and render in `ConnectionForm.tsx` under the type selector

## React Query conventions

- All hooks live in `src/hooks/`
- Query keys follow `['resource', id, subresource]` pattern
- Mutations invalidate their parent query key on success
- `staleTime` set to 30s for connector data (avoids hammering external APIs on every focus)

## Environment variables

See `.env.local.example`. Key vars:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `NEXTAUTH_SECRET` | JWT signing secret |
| `NEXTAUTH_URL` | Full URL of this app (e.g. http://localhost:3000) |
| `CONNECTOR_API_URL` | Internal URL of connector-api (e.g. http://connector-api:4000) |
| `CONNECTOR_INTERNAL_KEY` | Shared secret for web→connector-api auth |
| `ENCRYPTION_KEY` | 64-char hex key for AES-256-GCM credential encryption |
