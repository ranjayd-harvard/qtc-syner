# NetSuite Integration Setup Guide

Token-Based Authentication (TBA) setup for the QTC Syncer connector. Follow these steps after a sandbox refresh or when setting up a new environment.

---

## Credentials required

The connector needs five values stored in the connection record:

| Field | Description |
|---|---|
| `accountId` | NetSuite account ID (e.g. `6741115_SB1` for sandbox, `6741115` for production) |
| `consumerKey` | 64-character hex key from the Integration record |
| `consumerSecret` | 64-character hex key from the Integration record |
| `tokenId` | 64-character hex key from the Access Token |
| `tokenSecret` | 64-character hex key from the Access Token |

> **Account ID format:** enter it in any format (`6741115_SB1` or `6741115-sb1`). The connector normalizes it automatically — hyphens for the REST URL, underscores+uppercase for the OAuth realm.

---

## Setup steps

### Step 1 — Create a Role

**Setup → Users/Roles → Manage Roles → New**

| Field | Value |
|---|---|
| Name | e.g. `QTC Syncer API Role` |
| Authentication | Web Services Only Role |

Under the **Permissions** tab, add:

**Setup tab:**

| Permission | Level |
|---|---|
| REST Web Services | Full |
| Log In Using Access Tokens | Full |
| User Access Tokens | Full |

**Reports tab:**

| Permission | Level |
|---|---|
| **SuiteAnalytics Workbook** | **Edit** |

> This is the permission that enables SuiteQL access via `/query/v1/suiteql`. It appears under Reports, not Setup. Without it, all SuiteQL queries return `USER_ERROR 400` even if record-level permissions are correct.

**Lists tab** (add based on what you need to query):

| Permission | Level |
|---|---|
| Items | View |
| Customers | View |
| Vendors | View |
| Employees | View |

**Transactions tab** (add as needed):

| Permission | Level |
|---|---|
| Sales Orders | View |
| Purchase Orders | View |
| Invoices | View |

Click **Save**.

---

### Step 2 — Assign the Role to Your User

**Setup → Users/Roles → Manage Users** → find your user → **Edit**

Under the **Access** tab → Roles subtab → **Add** → select `QTC Syncer API Role` → **Save**.

---

### Step 3 — Create the Integration (Consumer Key + Secret)

**Setup → Integration → Manage Integrations → New**

| Field | Value |
|---|---|
| Name | `QTC Syncer` |
| State | Enabled |
| Token-Based Authentication | ✅ checked |
| Authorization Code Grant | unchecked |
| OAuth 2.0 | unchecked |

Click **Save**. NetSuite shows the credentials **one time only — copy immediately**:

```
Consumer Key    → consumerKey
Consumer Secret → consumerSecret
```

If you miss them, you must delete and recreate the integration — there is no way to retrieve them again.

---

### Step 4 — Create the Access Token (Token ID + Secret)

**Setup → Users/Roles → User Management → Access Tokens → New**

| Field | Value |
|---|---|
| Application Name | `QTC Syncer` (the integration from Step 3) |
| User | your user |
| Role | `QTC Syncer API Role` (the role from Step 1) |
| Token Name | e.g. `qtc-syncer-token` |

Click **Save**. Shown **one time only — copy immediately**:

```
Token ID     → tokenId
Token Secret → tokenSecret
```

---

### Step 5 — Update the Connection in the App

1. Open **Connection Manager** in the web app
2. Edit the NetSuite connection
3. Enter all five credential fields
4. Click **Test Connection** — should return Connected

---

## After a sandbox refresh

A sandbox refresh wipes all Access Tokens. The Integration record (consumer key/secret) usually survives. You only need to:

1. Go to **Setup → Users/Roles → User Management → Access Tokens → New**
2. Create a new token with the same User + Role + Integration
3. Copy the new Token ID + Token Secret
4. Update the connection in the app

If the Integration record was also wiped, repeat Steps 3–5.

---

## Troubleshooting

### 401 INVALID_LOGIN

The access token or integration credentials are invalid.

**Check:**
1. **Setup → Users/Roles → User Management → View Login Audit Trail** — filter by today, read the Detail column for the exact failure reason
2. **Setup → Users/Roles → User Management → Access Tokens** — confirm the token still exists (sandbox refresh deletes all tokens)
3. **Setup → Integration → Manage Integrations** — confirm the integration is still Enabled with Token-Based Authentication checked

**Most common cause after sandbox refresh:** the Access Token was deleted. Create a new one (Step 4).

---

### 400 USER_ERROR — "Your current role does not have permission"

The role is missing a permission. Both the SuiteQL endpoint and the Record API return this error.

**Check in order:**
1. **Reports tab → SuiteAnalytics Workbook** is present at Edit level — this is required for SuiteQL
2. **Setup tab → REST Web Services** is at Full level
3. **Lists tab** has the relevant record types (Items, Customers, etc.) at View or higher
4. **Setup → Users/Roles → User Management → Access Tokens** — confirm the token's Role column shows your custom role, not some other role

**Quick diagnostic:** create a temporary token with the Administrator role. If data loads, the issue is your custom role's permissions.

---

### 404 — "Record type does not exist"

You're browsing an object name that exists in SuiteQL but not in the REST Record API (e.g. the virtual `item` table). The SuiteQL query failed first, then the Record API fallback also failed.

**Fix:** browse the specific item type instead:
- `inventoryItem` — stocked physical products
- `nonInventoryItem` — non-stocked items
- `serviceItem` — services
- `assemblyItem` — BOMs / kits

---

## How the connector works

The connector uses **OAuth 1.0a Token-Based Authentication (TBA)**. Every request is signed with HMAC-SHA256 using all four credential values.

**Request flow for data fetching:**

1. Try SuiteQL: `POST /query/v1/suiteql` with `{ q: "SELECT * FROM {table} ..." }`
2. If SuiteQL fails (table not found, no SuiteQL permission), fall back to Record API collection: `GET /record/v1/{objectName}?limit=...&offset=...`
3. If both fail, the error is returned to the UI

**URL construction from account ID:**
- REST URL hostname: `accountId` lowercased with underscores replaced by hyphens → `6741115-sb1.suitetalk.api.netsuite.com`
- OAuth realm: `accountId` uppercased with hyphens replaced by underscores → `6741115_SB1`
