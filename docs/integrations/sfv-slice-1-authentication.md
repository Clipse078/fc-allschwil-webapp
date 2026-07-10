# SFV / ClubCorner Integration — Slice 1: Authentication

> **Document type:** Integration specification and runbook  
> **Status:** Slice 1 complete — token contract implemented from Swagger
> **Last updated:** 2026-07-10  
> **Maintained by:** SportClubEvo engineering team

---

## Purpose of Slice 1

Slice 1 establishes the secure SFV authentication foundation and provides an
authenticated admin connection test. It explicitly does NOT import SFV business
data, modify existing match or team data, create entity mappings, implement
synchronisation, or modify the Wochenplan implementation.

---

## Required Environment Variables

Add these to your local `.env.local`. Values must be obtained from the SFV
API access approval process. Never commit actual values.

```
SFV_TOKEN_URL=
SFV_APPLICATION_KEY=
SFV_APPLICATION_PASS=
SFV_CLUB_ID=
```

| Variable              | Description                                              | Format          |
|-----------------------|----------------------------------------------------------|-----------------|
| `SFV_TOKEN_URL`       | HTTPS endpoint for obtaining a session token from SFV   | Full HTTPS URL  |
| `SFV_APPLICATION_KEY` | Application key / client identifier assigned by SFV     | String          |
| `SFV_APPLICATION_PASS`| Application password / client secret assigned by SFV    | String          |
| `SFV_CLUB_ID`         | Numeric club identifier assigned by SFV                 | 1–10 digit int  |

**Security rules:**
- Never use `NEXT_PUBLIC_SFV_*` prefixes. These variables must never appear in the browser bundle.
- Never commit actual values to version control.
- Add values manually to `.env.local` (never via automated scripts in this repository).

---

## Local Configuration

1. Copy the four variable names from `.env.example` into your `.env.local`.
2. Fill in the actual values provided by SFV (credentials approved for use).
3. Start the dev server: `npm run dev`.
4. Navigate to **Admin → Integrationen → SFV / ClubCorner**.
5. Click **Verbindung testen** to trigger a connection test.

---

## Vercel STAGE Configuration

Add the four environment variables to the Vercel STAGE project's environment
settings. Use the Vercel dashboard — do not add them to `vercel.json` or any
committed configuration file.

Reference: `docs/deployment/webapp-vercel-env-entry-sheet.md`

---

## How to Run the Connection Test

The connection test is available only to users with the `tenants.manage` permission.

### Via the Admin UI

1. Log in as a user with `tenants.manage`.
2. Navigate to **Admin → Integrationen → SFV / ClubCorner**.
3. Click **Verbindung testen**.

The page displays:
- Configuration status (presence only — no values shown)
- SFV environment (always: production)
- Club ID configured (boolean)
- Token valid (boolean)
- `tokenExpiresAt: null` — the SFV API does not return an expiry timestamp
- Tested-at timestamp
- Sanitized error code and message if the test fails

### Via the API (curl — local only)

```bash
# Requires a valid authenticated session cookie.
curl -X POST http://localhost:3000/api/admin/integrations/sfv/test \
  -H "Content-Type: application/json" \
  -b "next-auth.session-token=<your-local-session-token>"
```

---

## SFV Authentication Contract

Documented source: SFV ClubCorner API Swagger/OpenAPI specification.

### Token endpoint

```
POST /api/token
```

### Request

```
Content-Type: application/json
```

Body (exact field names per Swagger):

```json
{
  "applicationKey": "<SFV_APPLICATION_KEY>",
  "applicationPass": "<SFV_APPLICATION_PASS>"
}
```

### Successful response

```
HTTP 200
Content-Type: text/plain
Body: <raw session-token string>
```

The body is an opaque plain-text string. No JSON parsing is performed.
Surrounding transport whitespace is trimmed; an empty body is rejected.

### Error responses

| HTTP Status | Meaning                    | Local error code    |
|-------------|----------------------------|---------------------|
| 401         | Authentication failure     | `SFV_UNAUTHORIZED`  |
| 403         | Forbidden                  | `SFV_FORBIDDEN`     |
| 429         | Too many requests          | `SFV_RATE_LIMITED`  |
| 500         | Unexpected server error    | `SFV_UNAVAILABLE`   |
| Timeout     | Request exceeded 10 000 ms | `SFV_TIMEOUT`       |

### Token validity

Per Swagger documentation:
- Initial validity: **30 minutes**
- Validity is **extended on each valid authenticated API request**

No expiry timestamp is returned in the token response.

### Token handling invariants

- The token is never decoded or assumed to be JWT.
- The token is never persisted to the database or browser storage.
- The token is never returned to the browser.
- The token is never logged.
- No `Authorization` header value is included in error messages.
- Credentials (`applicationKey`, `applicationPass`) are never logged.

---

## Local Token Cache Policy

The client maintains an **in-process token cache** governed by a local policy:

| Parameter                      | Value        | Notes                                      |
|--------------------------------|--------------|--------------------------------------------|
| `LOCAL_TOKEN_CACHE_MAX_AGE_MS` | 20 minutes   | Conservative; shorter than 30-min validity |
| Expiry buffer                  | 60 seconds   | Proactive refresh window                   |
| Persistence                    | None         | Module-level memory only                   |

**Important:** The local cache deadline is a **local policy only**. It is NOT
derived from or implied by any field in the SFV API response (no expiry is
returned). The `tokenExpiresAt` field in API responses is always `null`.

---

## Security Boundaries

The SFV client module (`lib/integrations/sfv/client.ts`) enforces the following:

| Control                                    | Implementation                                         |
|--------------------------------------------|--------------------------------------------------------|
| Server-only execution                      | Module uses `process.env` — unavailable in browser     |
| No token in browser                        | Token never returned to client components              |
| No token in logs                           | Error messages never include token or Authorization    |
| No database persistence of token           | Token cached only in module-level memory               |
| No credential exposure in errors           | `toSafePublicError()` strips all sensitive material    |
| No retry on auth failures                  | `isRetryableSfvError()` returns false for 401/403      |
| Transient retry is bounded                 | MAX_RETRIES = 2, exponential backoff                   |
| Request timeout enforced                   | REQUEST_TIMEOUT_MS = 10 000 ms                         |
| Concurrent deduplication                   | Single inflight promise shared across callers          |
| No fabricated expiry in API response       | `tokenExpiresAt` is always null                        |

---

## Authentication Architecture

```
Admin UI (SfvConnectionPanel)
  └─ POST /api/admin/integrations/sfv/test
       ├─ requireApiPermission(TENANTS_MANAGE)
       ├─ getSfvConfigStatus()                 ← validates env var presence
       └─ testSfvConnection()
            └─ acquireToken()
                 ├─ getSfvConfig()             ← reads validated env vars
                 └─ executeTokenRequest()      ← POST /api/token (JSON body)
                      ├─ applicationKey
                      ├─ applicationPass
                      └─ HTTP 200 → text/plain token
```

---

## Slice 1 Confirms

- **No SFV data import:** No fixture, match, team, competition, result, standing,
  or tournament data is imported. The connection test only acquires a token.
- **No SFV business-data writes:** No writes to any SportClubEvo database table
  other than reading configuration from environment variables.
- **No Wochenplan modification:** No Wochenplan files, routes, or components
  were modified in this slice.
- **No database migration:** No Prisma migration was created or applied.
- **No password changes:** No user passwords or authentication secrets were modified.

---

## Known Limitations

1. **Token cache is per-process.** In a multi-instance deployment (e.g. Vercel
   serverless), each instance maintains its own token cache. This may result in
   slightly more token requests than in a single-instance deployment. This is safe
   per the SFV API rate-limit semantics (to be confirmed in Slice 2).

2. **No test credential mechanism.** The repository has no pre-configured mechanism
   for authenticated browser test credentials. Manual UI testing requires a user
   account with `tenants.manage` permission and SFV credentials in `.env.local`.

3. **Slice 1 connection test only.** The connection test acquires a token but does
   not exercise authenticated business-data endpoints. Token validity beyond initial
   acquisition will be exercised in Slice 2.

---

## Next Planned Slice — Slice 2

Slice 2 will extend the SFV integration by:

1. Exercising the first authenticated business-data request (fixture list).
2. Verifying that token validity extends on each valid API request (per documented behavior).
3. Establishing the foundation for SFV data import.
