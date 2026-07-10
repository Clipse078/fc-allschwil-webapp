# SFV / ClubCorner Integration — Slice 1: Authentication

> **Document type:** Integration specification and runbook  
> **Status:** Slice 1 complete — token contract pending  
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
| `SFV_TOKEN_URL`       | HTTPS endpoint for obtaining a bearer token from SFV    | Full HTTPS URL  |
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
- Token expiry if documented by the SFV API
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
                 └─ executeTokenRequest()      ← [TOKEN CONTRACT BOUNDARY]
                      └─ (stub — see below)
```

### Token Contract Boundary

The function `executeTokenRequest()` in `lib/integrations/sfv/client.ts` is
the single point where the actual HTTP call to the SFV token endpoint is made.

**This function is currently a stub** that throws `SfvContractUnresolvedError`.
The stub is intentional: it surfaces the missing contract clearly rather than
silently failing or making speculative requests.

**Before connecting to the live SFV endpoint:**

1. Obtain the official SFV ClubCorner API authentication documentation from SFV.
2. Confirm all of the following from the documentation:
   - HTTP method (expected: POST)
   - Content-Type of the request
   - Field name(s) for the application key in the request body or header
   - Field name(s) for the application password in the request body or header
   - Whether Basic Auth, form body, or JSON body is used
   - Response field name for the access token
   - Response field name for token expiry (if documented)
   - Expiry semantics (seconds, epoch timestamp, or absent)
3. Implement `executeTokenRequest()` from the confirmed documentation.
4. Update `parseTokenResponse()` to read the confirmed field names.
5. Update `RawTokenResponse` type to match the actual response shape.
6. Update the tests in `lib/integrations/sfv/__tests__/client.test.ts`.

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

1. **Token contract unresolved.** The actual HTTP request to the SFV token endpoint
   requires the official SFV API documentation before implementation. The
   `executeTokenRequest()` function is a clearly-marked stub.

2. **No test credential mechanism.** The repository has no pre-configured mechanism
   for authenticated browser test credentials. Manual UI testing requires a user
   account with `tenants.manage` permission and SFV credentials in `.env.local`.

3. **Token cache is per-process.** In a multi-instance deployment (e.g. Vercel
   serverless), each instance maintains its own token cache. This may result in
   slightly more token requests than in a single-instance deployment. This is safe
   per the SFV API rate-limit semantics (to be confirmed in Slice 2).

---

## Next Planned Slice — Slice 2

Slice 2 will complete the SFV authentication by:

1. Implementing `executeTokenRequest()` from the confirmed official SFV API contract.
2. Adding integration tests against a mocked SFV token endpoint with realistic responses.
3. Validating the connection test against the live SFV API in a safe local environment.
4. Establishing the foundation for the first SFV data fetch (fixture list).

Slice 2 requires the SFV authentication documentation to be obtained and reviewed
before any implementation begins.
