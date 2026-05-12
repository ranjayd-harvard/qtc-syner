# QTC Syncer — Session Handoff

**Date:** 2026-05-11  
**Session focus:** Product Syncer feature (new page), Gemini AI agent integration, NetSuite SuiteQL support across all pages

---

## What was built

### 1. Product Syncer page (`/product-syncer`)

A dedicated page for analyzing and mapping Salesforce Product2 → NetSuite item data.

**Two sections on the page:**

#### Sync Analysis (top section)
- **Connection pickers** — filtered: left shows only Salesforce connections, right shows only NetSuite connections
- **NS object selector** — dropdown of NS objects (SuiteQL tables shown first with green badge); after selecting NS connection a second dropdown appears
- **Stats cards** — four live counters: SF Product2 total · NS Items total · Matched · Unmatched in SF
  - Totals use a dedicated `/api/connections/[id]/count/[objectName]` endpoint to avoid a NetSuite SuiteQL bug where `totalResults=1` when `pageSize=1`
- **Analyze with AI button** — opens the inline Gemini chat panel
- **Two-column layout when chat is open** — results (left 3/5) + chat (right 2/5)
- **MatchResults tabs** — Matched Pairs | Unmatched in Salesforce, each with Export CSV button
- **AnalysisChat** — auto-starts the agent on open; multi-turn; calls `onAnalysisResult` when analysis completes

#### Field Mappings (bottom section)
- Saved drag-and-drop canvas mappings between SF Product2 fields and NS item fields
- Click a row to expand and see the field-level mapping table
- Persisted to `product_syncer_mappings` MongoDB collection

### 2. Gemini AI analysis agent

**Route:** `POST /api/product-syncer/analyze`

The agent (Gemini 2.5-flash) has two tools:

| Tool | What it does |
|---|---|
| `get_schemas` | Fetches Product2 + NS item field lists in parallel |
| `compute_match_analysis(sf_field, ns_field)` | Paginates up to 2,000 records from each side, exact-value matches, returns counts + record arrays |

Flow: agent fetches schemas → suggests 2–3 candidate match columns → user confirms → agent runs compute → returns structured `AnalysisResult` to the UI alongside its text summary.

**Key config:**
- `GEMINI_API_KEY` — required in `.env`
- `GEMINI_MODEL` — optional override (default: `gemini-2.5-flash`)
- `maxDuration = 120` — needed because the multi-page data fetch can take 10–30s

### 3. NetSuite SuiteQL support

**Problem:** NetSuite has two separate object namespaces:
- **Record API** (`/record/v1/metadata-catalog/`) — types like `inventoryItem`, `salesOrder`
- **SuiteQL tables** (underlying DB) — like `item`, `transaction`, `customer`

The connector's `listObjects()` previously only called the Record API catalog, so `item` (the master item table that covers all types) never appeared anywhere in the UI.

**Fix in `netsuite.connector.ts`:**
- `listObjects()` now fetches both in parallel and merges them (SuiteQL first, Record API second, deduplicated)
- `listSuiteQLTables()` tries three approaches in sequence:
  1. `SELECT * FROM OA_TABLES` (works on some enterprise accounts)
  2. `SELECT TABLE_NAME FROM information_schema.tables` (alternative)
  3. **Hardcoded fallback list of 24 well-known SuiteQL tables** — always works
- `ObjectMeta.type = 'table'` for SuiteQL tables, `'object'` for Record API types

**Important:** `item` is the SuiteQL master table for ALL item types. `inventoryItem` is just one Record API sub-type. For Salesforce Product2 sync, `item` is the correct NS counterpart.

### 4. UI changes across all pages

**New shared components:**

| Component | Location | Purpose |
|---|---|---|
| `ObjectTypeBadge` | `components/explorer/ObjectTypeBadge.tsx` | Renders "SuiteQL" (teal), "Record API" (grey), "view" badges |
| `ConnectionObjectPicker` | `components/explorer/ConnectionObjectPicker.tsx` | Self-contained connection + type filter + object dropdown |

**`ConnectionObjectPicker`** manages its own `useObjects` fetch internally. When a NetSuite connection returns both types, pill buttons appear between the connection and object dropdowns:

```
[All]  [SuiteQL 24]  [Record API 318]
```

Switching filter clears the selected object (which triggers mapping canvas reset in parent pages).

**Pages updated to use `ConnectionObjectPicker`:**
- Schema Compare — left + right panels
- Schema Mapper — source + target panels
- Multi-level Mapping — all three level panels

**`ObjectsList.tsx`** — type filter pills added to the Explorer object grid (only shows when multiple types exist).

**`ObjectCard.tsx`** — SuiteQL tables get a teal icon + SuiteQL badge; Record API types get slate icon + "Record API" badge.

**Explorer connection page** — subtitle now shows breakdown: `"342 objects — 24 SuiteQL tables, 318 Record API types"`.

---

## New files created this session

### `apps/web/src/`

```
app/
  (dashboard)/product-syncer/page.tsx          — Product Syncer page
  api/product-syncer-mappings/
    route.ts                                   — GET list + POST create
    [id]/route.ts                              — GET + PUT + DELETE by id
    schemas.ts                                 — shared Zod schemas (avoids duplication)
  api/product-syncer/analyze/route.ts          — Gemini agent endpoint
  api/connections/[id]/count/[objectName]/route.ts — accurate NS record count

components/
  product-syncer/
    AnalysisChat.tsx                           — inline Gemini chat panel
    MatchResults.tsx                           — matched pairs + unmatched tabs + CSV export
    SyncStats.tsx                              — 4 stat cards
  explorer/
    ConnectionObjectPicker.tsx                 — shared connection + type filter + object picker
    ObjectTypeBadge.tsx                        — SuiteQL/Record API/view badge

hooks/
  useProductSyncerMappings.ts                  — CRUD React Query hooks
  (useExplorer.ts updated: added useRecordCount)

models/
  ProductSyncerMapping.ts                      — MongoDB model + CRUD functions
```

### `apps/connector-api/src/`

```
connectors/netsuite.connector.ts               — listObjects() now returns SuiteQL + Record API
```

### Root

```
docker-compose.vpn.yml                         — added GEMINI_API_KEY, GEMINI_MODEL
docker-compose.yml                             — added GEMINI_API_KEY, GEMINI_MODEL
.env                                           — added GEMINI_API_KEY and GEMINI_MODEL placeholders
```

---

## Environment setup

### Required in `.env`

```env
# Get your key at https://aistudio.google.com/apikey
GEMINI_API_KEY=<your-key>

# Optional — defaults to gemini-2.5-flash
# GEMINI_MODEL=gemini-2.5-flash
```

### New npm dependency

```json
"@google/generative-ai": "^0.24.1"   // added to apps/web/package.json
```

Requires a **web container rebuild** after adding the package:

```bash
npm run dev:down
docker compose -f docker-compose.vpn.yml up --build
```

### After connector code changes

The connector-api runs on the host in VPN mode — just restart:

```bash
# Ctrl+C the connector:dev terminal, then:
npm run connector:dev
```

---

## MongoDB collections

| Collection | New this session | Purpose |
|---|---|---|
| `product_syncer_mappings` | ✅ | Saved SF→NS field mapping configs |

Created automatically on first save — no migration needed.

---

## Known limitations / next steps

| Area | Current state | Suggested next step |
|---|---|---|
| NS SuiteQL discovery | Falls back to 24 hardcoded tables if `OA_TABLES` is inaccessible | Add more domain-specific tables; consider letting users add custom SuiteQL tables |
| AI analysis record cap | `compute_match_analysis` fetches up to 2,000 records per side | Increase cap or add streaming progress for orgs with 10k+ records |
| AI analysis response size | Matched pairs capped at 200 in the response to keep payload manageable | Paginate or stream the full match list separately |
| Product Syncer field mappings | Canvas defines field-level transformations, but data sync (write-back to NS) is not implemented | Implement the actual sync job that pushes unmatched SF products into NS |
| Gemini model version | Hard-coded default `gemini-2.5-flash` | Keep configurable via `GEMINI_MODEL` env var as new models are released |
| NS object selection in field mapping canvas | Still uses hardcoded `NS_OBJECT = 'item'` | Let users pick the NS object in the canvas create/edit mode too |

---

## How to run locally (VPN mode)

```bash
# 1. Fill in .env (GEMINI_API_KEY, ENCRYPTION_KEY, etc.)
cp .env.example .env

# 2. Start MongoDB + web container
docker compose -f docker-compose.vpn.yml up --build

# 3. Start connector-api on host (for VPN-gated NS/Redshift)
npm run connector:dev

# 4. Open http://localhost:3061
```

---

## Testing the Product Syncer

1. Navigate to **Product Syncer** in the sidebar
2. Select a Salesforce connection (left) + NetSuite connection (right)
3. For NS object, pick `item — all item types (SuiteQL master table)` from the top of the dropdown
4. SF and NS record counts appear in the stat cards
5. Click **Analyze with AI**
6. Agent auto-fetches both schemas and suggests matching column pairs
7. Reply to confirm a column pair (e.g., "use ProductCode and itemid")
8. Agent runs the match analysis; stats update and results tables appear
9. Switch tabs: **Matched Pairs** / **Unmatched in Salesforce**
10. Click **Export CSV** on either tab for the full record list
