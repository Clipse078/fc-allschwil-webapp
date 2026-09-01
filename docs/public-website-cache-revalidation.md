# Public Website Cache Revalidation

SCE-CANONICAL-PUBLISHING-01 — cross-application cache invalidation contract between SportClubEvo (canonical source) and external tenant websites.

## Problem

SCE mutations update canonical business state (trainings, tournaments, clubs, CMS). External tenant websites (e.g. fc-allschwil-website) cache SCE public API responses via ISR/TTL. SCE's internal `revalidatePath()` calls only invalidate SCE's own Next.js cache — not tenant websites.

## Target flow

```
SCE mutation
  → canonical state committed (DB)
  → SCE schedules signed revalidation POST to tenant website
  → tenant website revalidates tagged caches
  → next public request renders current SCE state
```

Failure to notify the website **must not** roll back the SCE mutation. Bounded ISR TTL on the website remains the resilience fallback.

## SCE configuration (no DB migration)

Per-deployment environment variable — JSON map keyed by tenant slug:

```bash
PUBLIC_WEBSITE_REVALIDATION_CONFIG={"fc-allschwil":{"url":"https://www.fcallschwil.ch/api/revalidate","secret":"<shared-secret>"}}
```

- **url** — tenant website revalidation endpoint (HTTPS recommended)
- **secret** — shared HMAC secret (server-only, never commit)

Implementation: `lib/website/public-cache-notification.ts`

## Content domains

Generic, tenant-scoped tags defined in `lib/website/public-cache-tags.ts`:

| Domain | Tag example | Typical SCE surfaces |
|--------|-------------|----------------------|
| `weekplan` | `sce:fc-allschwil:weekplan` | `/api/public/[tenant]/website/weekplan` |
| `tournaments` | `sce:fc-allschwil:tournaments` | `/api/public/[tenant]/website/tournaments` |
| `matches` | `sce:fc-allschwil:matches` | `/api/public/[tenant]/website/matches` |
| `clubs` | `sce:fc-allschwil:clubs` | Club logos, directory identity |
| `news` | `sce:fc-allschwil:news` | News feed and articles |
| `sponsors` | `sce:fc-allschwil:sponsors` | Sponsor blocks |
| `design-system` | `sce:fc-allschwil:design-system` | Design tokens |
| `homepage` | `sce:fc-allschwil:homepage` | Homepage CMS sections |
| `all` | `sce:fc-allschwil:all` | Broad invalidation (use sparingly) |

## Outbound request (SCE → tenant website)

**Method:** `POST`

**Headers:**

- `Content-Type: application/json`
- `X-SCE-Revalidation-Signature: sha256=<hex>` — HMAC-SHA256 of the raw JSON body using the shared secret

**Body:**

```json
{
  "tenant": "fc-allschwil",
  "domains": ["weekplan"],
  "tags": ["sce:fc-allschwil:weekplan"]
}
```

- `tenant` — tenant slug (path segment used in SCE public APIs)
- `domains` — logical content domains that changed
- `tags` — canonical Next.js `revalidateTag` values (includes domain tags plus any extra tags)

## Tenant website follow-up (fc-allschwil-website — NOT in SCE repo)

Implement a small authenticated endpoint, e.g. `POST /api/revalidate`:

1. Read raw body and verify `X-SCE-Revalidation-Signature` (HMAC-SHA256, timing-safe compare).
2. Reject requests with invalid or missing signature (`401`).
3. For each tag in `tags`, call `revalidateTag(tag)` (Next.js App Router).
4. Return `200` with `{ "revalidated": true, "tags": [...] }`.

**Website fetch/cache registration:** when fetching SCE public APIs, tag fetches with the matching domain tag:

```typescript
fetch(sceWeekplanUrl, { next: { tags: ["sce:fc-allschwil:weekplan"] } });
```

**Resilience:** keep bounded ISR `revalidate` TTL (e.g. 60–300s) as fallback when notification fails or is not configured.

## SCE mutation integration

SCE schedules notification via `scheduleTenantPublicWebsiteCacheNotificationByTenantId()` after canonical mutations that affect public website data. Current hooks:

- Training series allocation create/update/delete (`lib/training/training-allocation-service.ts`)
- Training session occurrence allocation create/delete (`lib/training/session-allocation-service.ts`)

Additional mutation paths should call the same helper with the appropriate `domains` array — no per-tenant hardcoding.

## Security

- Tenant-scoped: config keyed by tenant slug; notification only sent to that tenant's configured URL.
- Authenticated: HMAC signature over exact request body.
- Server-only secrets: never expose `PUBLIC_WEBSITE_REVALIDATION_CONFIG` to clients.
- No rollback: notification failures are logged only.

## Related

- Public API contract: `docs/public-website-api.md`
- Integration types: `lib/website/integration-contract.ts`
