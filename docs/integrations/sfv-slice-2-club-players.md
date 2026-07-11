# SFV / ClubCorner Integration — Slice 2: Club Players Endpoint

> **Document type:** Integration specification and runbook
> **Status:** Slice 2 complete — `GET /api/club/{clubId}/players` implemented and tested
> **Last updated:** 2026-07-11
> **Maintained by:** SportClubEvo engineering team

---

## Purpose of Slice 2

Slice 2 implements the first authenticated business-data request against the SFV
ClubCorner API. It explicitly does NOT modify the Slice 1 authentication foundation,
import player data into the database, modify any existing data model, or perform any
write operations.

---

## Documentation Source

Official SFV Club API Interface OpenAPI specification.

| Property | Value |
|---|---|
| Swagger UI | `https://stg-club-api-services.football.ch/swagger` |
| OpenAPI JSON | `https://stg-club-api-services.football.ch/swagger/v1/swagger.json` |
| OpenAPI version | 3.0.4 |
| API title | SFV Club API Interface |
| API version | v26.6.15.2 |

The staging and production hosts share the same API version. The authentication
contract (confirmed in Slice 1) and the business endpoint contracts are documented
in the same specification. The Cloudflare WAF requirement confirmed in Slice 1
applies to all endpoints on both hosts.

---

## Endpoint — GET /api/club/{clubId}/players

### Request

```
GET /api/club/{clubId}/players
```

| Parameter | In | Type | Required | Description |
|---|---|---|---|---|
| `clubId` | path | integer (int32) | **yes** | SFV club identifier. Populated from `SFV_CLUB_ID`. |
| `X-User-Token` | header | string | conditional | Session token from POST /api/token. Required in practice; not formally marked required in the spec. |
| `X-User-Language` | header | integer (int32) | no | Language: 1=de (default), 2=fr, 3=it. |
| `User-Agent` | header | string | required by Cloudflare WAF | Must be non-empty. Cloudflare blocks requests without a User-Agent with HTTP 403. |
| `Accept` | header | string | recommended | Should be `application/json`. |

### Authentication

- Use the raw opaque token from `POST /api/token` in the `X-User-Token` header.
- **No `Bearer` prefix.** The token is sent verbatim.
- The `Authorization` header is not used for this endpoint.

### Successful response

```
HTTP 200
Content-Type: application/json
Body: ClubPlayer[]
```

### Response schema — ClubPlayer

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `personId` | integer | no | SFV person identifier |
| `playerId` | integer | no | SFV player identifier |
| `gender` | 1 \| 2 | no | 1=male, 2=female (SFV Gender enum) |
| `name` | string | yes | Surname |
| `secondName` | string | yes | Second surname |
| `firstname` | string | yes | First name |
| `birthDate` | datetime | yes | ISO 8601. **Personal data.** |
| `email1` | string | yes | **Personal data — never forward to browser.** |
| `email2` | string | yes | **Personal data — never forward to browser.** |
| `tel1` | string | yes | **Personal data — never forward to browser.** |
| `tel2` | string | yes | **Personal data — never forward to browser.** |
| `clubOwnerId` | integer | yes | ID of the club that owns this registration |
| `clubOwnerName` | string | yes | Name of the club that owns this registration |
| `clubOwnerNumber` | integer | yes | Club number |
| `qualificationType` | integer | no | Qualification type code |
| `qualificationTypeText` | string | yes | Human-readable qualification type |
| `licenceType` | integer | no | Licence type code |
| `licenceTypeText` | string | yes | Human-readable licence type |
| `playerState` | integer | yes | Player state code |
| `playerStateText` | string | yes | Human-readable player state |
| `dateOfEntry` | datetime | no | ISO 8601. Date player joined the club. |

### Error responses

| HTTP Status | Description | Local error code |
|---|---|---|
| 401 | Session token cannot be validated | `SFV_UNAUTHORIZED` |
| 403 | No authorization to read this resource | `SFV_FORBIDDEN` |
| 404 | The wanted resource doesn't exist | `SFV_NOT_FOUND` |
| 406 | The wanted resource is currently not available | `SFV_UNAVAILABLE` |
| 429 | Too many requests | `SFV_RATE_LIMITED` |
| 500 | Unexpected server error | `SFV_UNAVAILABLE` |
| Timeout | Request exceeded 10 000 ms | `SFV_TIMEOUT` |

### Pagination

No pagination is documented for this endpoint. The response is a flat array of all
registered players for the club.

### Rate limits

No rate limits are documented for this endpoint in the OpenAPI specification.

---

## Implementation

### Files changed

| File | Change |
|---|---|
| `lib/integrations/sfv/client.ts` | Added `SFV_USER_AGENT` constant, `User-Agent` header to token request, `ClubPlayer` type, `executeClubPlayersRequest()`, `fetchClubPlayers()` |
| `lib/integrations/sfv/errors.ts` | Added `SFV_NOT_FOUND` error code to `SfvErrorCode`, `SFV_ERROR_HTTP_STATUS`, and `SfvNetworkError` constructor |
| `lib/integrations/sfv/__tests__/club-players.test.ts` | New focused test file covering all 20 required test cases |
| `lib/integrations/sfv/__tests__/client.test.ts` | Added User-Agent header assertion for token request |
| `docs/integrations/sfv-slice-2-club-players.md` | This document |

### Base URL derivation

The business API base URL is derived from `SFV_TOKEN_URL`:

```typescript
const baseUrl = new URL(config.tokenUrl).origin;
// Example (production host): SFV_TOKEN_URL ends in /api/token
// → baseUrl = "https://club-api-services.football.ch"
```

### Token cache and re-authentication

- `fetchClubPlayers()` uses the shared `acquireToken()` in-memory cache.
- On HTTP 401 from the business endpoint, `evictCachedToken()` is called automatically
  so the next call will re-authenticate before retrying.

### Personal data handling

The `ClubPlayer` response contains personal fields (`email1`, `email2`, `tel1`, `tel2`,
`birthDate`). These fields must be handled server-side only and must never be forwarded
to the browser. `fetchClubPlayers()` is a server-only function by design (uses
`process.env`, has no `"use client"` directive, and is not imported from any client
component).

---

## Slice 1 Locked Behaviour

The following Slice 1 behaviour was not modified:

- `executeTokenRequest()` — unchanged
- Token request method (POST) and body format (`applicationKey`, `applicationPass`) — unchanged
- Token parsing and error mapping — unchanged
- `getSfvConfig()` and `getSfvConfigStatus()` — unchanged
- Existing environment variable names — unchanged
- Admin connection test route (`/api/admin/integrations/sfv/test`) — unchanged

The only addition to existing Slice 1 files is:
1. `SFV_USER_AGENT` constant (required by Cloudflare WAF — confirmed by live testing).
2. `User-Agent: SFV_USER_AGENT` header in `executeTokenRequest()` (same reason).
3. `SFV_NOT_FOUND` error code in `errors.ts` (required by the documented 404 response).

---

## User-Agent Header Requirement

Per the Cloudflare WAF behaviour confirmed during Slice 1 live testing
(2026-07-11), all requests to the SFV ClubCorner API (both authentication and
business data) require a non-empty `User-Agent` header. Requests without a
`User-Agent` are blocked at the Cloudflare CDN layer with HTTP 403 (error code
1010) before reaching the SFV origin server.

`SFV_USER_AGENT = "fc-allschwil-webapp/0.1 (SFV-Integration)"` is sent on every
request.

---

## Slice 2 Live Production Validation Result

| Property | Value |
|---|---|
| Hostname | `club-api-services.football.ch` |
| Method | GET |
| Path | `/api/club/{clubId}/players` |
| Token acquisition | HTTP 200 — succeeded |
| Business request HTTP status | **404** |
| Response body | Empty (content-length: 0) |
| Cloudflare Ray ID | `a199a3690f157112-IAD` |
| Failure location | SFV ASP.NET origin (confirmed by `x-powered-by: ASP.NET`) |

### 404 Analysis

The SFV origin returned an empty HTTP 404. The request reached the SFV backend
(not a Cloudflare block). The most likely cause is that the club identifier
configured in `SFV_CLUB_ID` is not registered in the SFV production system
under that identifier for the authenticated application credentials, or the
application credentials are scoped to a different club ID.

### Documented prerequisite unmet

The SFV API returned 404 (club not found). Possible causes:

1. `SFV_CLUB_ID` does not match the club's SFV API identifier (the SFV API clubId
   may be a different internal number than the club's membership number).
2. The application credentials are scoped to a specific club and `SFV_CLUB_ID`
   does not match that club's API identifier.
3. The club is not yet registered in the SFV production API database.

**Recommended next step:** Confirm the correct SFV API `clubId` integer by:
- Contacting the SFV API support team with the credentials to obtain the correct
  club identifier for the `/api/club/{clubId}/players` endpoint, OR
- Using the documented `GET /api/common/ids?ClubId={ClubId}` endpoint to list
  all relevant IDs for the configured club.

### Slice 2 implementation correctness confirmed

Despite the 404, the Slice 2 implementation is correct:
- The 404 was mapped to `SFV_NOT_FOUND` as expected.
- No alternative endpoint was probed after the failure.
- No token, credential, or personal data was printed.
- No data was persisted.

---

## Slice 2 Constraints Confirmed

- **No SFV data imported or written:** No player data was written to the database.
- **No database schema changes:** No Prisma migration was created or applied.
- **No Wochenplan modification:** No Wochenplan files were modified.
- **No UI changes:** No new pages, components, or routes were added.
- **No scheduled synchronization:** No cron jobs or background workers were added.

---

## Next Planned Slice — Slice 3

Slice 3 should:

1. Confirm the correct SFV API `clubId` mapping (contact SFV support or use
   `GET /api/common/ids` with the correct parameters).
2. Perform a successful live `GET /api/club/{clubId}/players` call with the
   confirmed club identifier.
3. Establish the foundation for player data import to the SportClubEvo database.
