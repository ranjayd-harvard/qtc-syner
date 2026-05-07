# QTC Syncer

A multi-source data connector platform for Salesforce, NetSuite, and AWS Redshift. Browse any object or table from your connected sources, manage connections through an admin UI, and explore data with a powerful table viewer.

## Features

- **Connection Manager** — Configure and test connections to Salesforce, NetSuite, and Redshift
- **Data Explorer** — Browse objects/tables and view data with server-side pagination, sorting, and filtering
- **Schema Viewer** — Inspect field/column definitions for any object
- **Custom Query Editor** — Run SOQL (Salesforce), SuiteQL (NetSuite), or SQL (Redshift) queries
- **Schema Compare** — Side-by-side field comparison across any two connection + object pairs with match/mismatch/left-only/right-only classification
- **CSV Export** — Download table data as CSV
- **Sync History** — Per-connection activity log with duration and row counts
- **Dashboard** — Stats grid, connection health cards, pie chart by source type, and recent activity feed
- **Authentication** — Secure login with NextAuth.js (credentials provider, MongoDB session store)

## Architecture

```
┌─────────────┐    ┌──────────────────┐    ┌──────────────────────────┐
│   Browser   │───▶│   web (Next.js)  │───▶│  connector-api (Express) │
└─────────────┘    │   Port 3000      │    │  Port 4000 (internal)    │
                   └────────┬─────────┘    └──────────┬───────────────┘
                            │                         │
                   ┌────────▼─────────┐    ┌──────────▼───────────────┐
                   │  mongodb         │    │  Salesforce / NetSuite /  │
                   │  Port 27017      │    │  AWS Redshift             │
                   └──────────────────┘    └──────────────────────────┘
```

| Container | Role |
|---|---|
| `web` | Next.js 14 App Router — UI, BFF API routes, session management |
| `connector-api` | Express microservice — executes data source connections (internal only) |
| `mongodb` | Stores encrypted connection configs and activity logs |
| `mongo-express` | Dev-only DB admin UI at `http://localhost:8081` |

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local dev without Docker)

### 1. Clone & configure

```bash
git clone https://github.com/ranjayd-harvard/qtc-syner.git
cd qtc-syner

cp .env.example .env
```

Edit `.env` and set:
- `MONGO_ROOT_PASSWORD` — strong password
- `ENCRYPTION_KEY` — 64-char hex string (`openssl rand -hex 32`)
- `CONNECTOR_INTERNAL_KEY` — 64-char hex string (`openssl rand -hex 32`)
- `NEXTAUTH_SECRET` — base64 string (`openssl rand -base64 32`)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — your admin credentials

### 2. Seed the admin user

```bash
cd apps/web
npx ts-node scripts/seed-admin.ts
```

This creates the admin account using `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your `.env`.

### 3. Start (development)

```bash
npm run dev
```

Open [http://localhost:3061](http://localhost:3061) and log in with your admin credentials.

Mongo Express (DB admin UI) is available at [http://localhost:8081](http://localhost:8081).

### VPN mode

If your Redshift or NetSuite instance is only reachable over VPN, run connector-api on the host machine:

```bash
# Terminal 1
npm run dev:vpn           # MongoDB + web in Docker

# Terminal 2
npm run connector:dev     # connector-api on host (can reach VPN)
```

### 4. Start (production)

```bash
npm run prod:build
npm run prod
```

## Local Development (without Docker)

```bash
# Terminal 1 — Start MongoDB (still via Docker)
docker compose up mongodb -d

# Terminal 2 — Start connector-api
cd apps/connector-api
cp .env.example .env.local
npm install
npm run dev

# Terminal 3 — Start web
cd apps/web
cp .env.local.example .env.local
npm install
npm run dev
```

## Connection Types

### Salesforce
| Field | Description |
|---|---|
| Instance URL | `https://yourorg.my.salesforce.com` |
| Client ID | Connected App consumer key |
| Client Secret | Connected App consumer secret |
| Username | Salesforce username |
| Password | Password + Security Token concatenated |

### NetSuite
| Field | Description |
|---|---|
| Account ID | NetSuite account ID (e.g. `1234567`) |
| Consumer Key | TBA consumer key |
| Consumer Secret | TBA consumer secret |
| Token ID | TBA token ID |
| Token Secret | TBA token secret |

### AWS Redshift
| Field | Description |
|---|---|
| Host | Redshift cluster endpoint |
| Port | Default: `5439` |
| Database | Database name |
| Username | DB username |
| Password | DB password |
| SSL | Enable SSL connection |

## Project Structure

```
qtc-syncer/
├── apps/
│   ├── web/                  # Next.js 14 frontend + BFF
│   └── connector-api/        # Express connector microservice
├── docker/
│   └── mongo-init/           # MongoDB initialization scripts
├── .github/workflows/        # CI pipeline
├── docker-compose.yml        # Production
└── docker-compose.dev.yml    # Development
```

## Security Notes

- All credentials are encrypted with **AES-256-GCM** before storing in MongoDB
- `connector-api` is not exposed to the internet — only reachable via internal Docker network
- An `x-internal-api-key` header authenticates all web→connector-api calls
- Sessions are stored in MongoDB and validated on every request via NextAuth.js middleware

## License

MIT
