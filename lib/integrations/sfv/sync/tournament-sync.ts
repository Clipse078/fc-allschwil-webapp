/**
 * lib/integrations/sfv/sync/tournament-sync.ts
 *
 * SFV tournament synchronization — diagnostic-only implementation.
 *
 * ── Investigation summary (SFV-TOURNAMENT-01, 2026-08-06) ─────────────────────
 *
 * Root cause of "planned tournaments never appear via SFV sync":
 *
 *   The official SFV Club API Interface (OpenAPI v26.6.15.2 — confirmed by
 *   fetching the live specification from both the staging host
 *   (stg-club-api-services.football.ch) and the production host
 *   (club-api-services.football.ch) on 2026-08-06) exposes exactly 14
 *   endpoints:
 *
 *     POST /api/token
 *     GET  /api/club/{clubId}/players
 *     GET  /api/club/{clubId}/officials
 *     GET  /api/club/{clubId}/coaches
 *     GET  /api/club/{clubId}/referees
 *     GET  /api/club/schedule
 *     GET  /api/club/ranking
 *     GET  /api/common/ids
 *     GET  /api/match/{matchId}
 *     GET  /api/match/{matchId}/players
 *     GET  /api/match/{matchId}/events
 *     GET  /api/match/{matchId}/bench
 *     GET  /api/match/{matchId}/referees
 *     GET  /api/team/picture/{teamId}
 *     GET  /api/team/list
 *
 *   None of these return a structured "tournament" resource — an entity with
 *   participating teams, organiser, venue, category, start/end time, distinct
 *   from a two-team match. `GET /api/club/schedule` (the endpoint used by
 *   `sync/schedule.ts`) always returns two-team `Schedule` rows
 *   (`teamAId`/`teamNameA` vs. `teamBId`/`teamNameB`). Its `CupId` filter
 *   selects cup fixtures — still two-team matches, not multi-team tournament
 *   containers. There is no `matchType` enum documentation and no observed
 *   production data indicating a "Turnier" row shape different from a match.
 *
 *   Recreational/youth tournaments such as FC Allschwil's E3 tournaments
 *   (verification case: 23.08.2026, 06.09.2026, 13.09.2026) are rendered only
 *   on the public FVNWS match center website (matchcenter.fvnws.ch) as
 *   distinct "Turnier" blocks (title, category, organiser, location) that
 *   have no counterpart in the Club API. Live verification on 2026-08-06
 *   confirmed that automated/machine access to that page is explicitly
 *   blocked by the provider at the WAF layer:
 *
 *     "Ein maschineller Zugriff ist nicht erlaubt und wurde unterbunden ...
 *      melden Sie sich unter support@football.ch" (HTTP 403, Block Bot Score 1)
 *
 *   Per this project's policy ("do not scrape HTML when a stable structured
 *   endpoint exists; if no reliable structured source exists, stop and
 *   report the safest alternative"), this module never fetches that page and
 *   never performs any HTTP request. `existing sync excludes tournaments`
 *   simply because there is nothing structured to fetch — `sync/schedule.ts`
 *   only ever creates `Event.type = "MATCH"` from `/api/club/schedule`.
 *
 * ── What this module does instead ─────────────────────────────────────────────
 *
 *   This function provides the same authorized, tenant-scoped "Jetzt
 *   synchronisieren" surface as every other SFV sync (schedule, teams,
 *   competitions, match-detail) so that:
 *
 *     1. Administrators get a clear, actionable diagnostic explaining why
 *        zero tournaments were imported, instead of silence or a misleading
 *        "0 found" result that looks like an empty but successful fetch.
 *     2. The later high-frequency scheduler cadence (5-minute operational
 *        delta / 30-minute reconciliation / nightly integrity check) already
 *        has one idempotent entry point to call. When SFV/football.ch ships
 *        a structured tournament endpoint (or grants explicit authorized
 *        access), only the body of `syncSfvTournaments` needs to change to a
 *        real fetch + upsert implementation (mirroring `sync/schedule.ts`'s
 *        upsert-by-provider-id pattern) — the result shape, the API route,
 *        and the admin UI wiring do not need to change.
 *
 *   Manual tournament creation remains the safe, currently-working path: see
 *   `components/admin/events/TournamentEventCreateForm.tsx` →
 *   `POST /api/events` (`type: "TOURNAMENT"`, `source: "MANUAL"`). Those
 *   records already flow through the existing canonical publication chain
 *   (`lib/publishing/policy/publication-policy.ts`,
 *   `lib/events/public-event-feed.ts`,
 *   `GET /api/public/[tenant]/website/tournaments`, Infoboard Screen 1/2)
 *   with no changes required.
 *
 * Security invariants:
 *   - Never performs an HTTP request (no scraping, no undocumented endpoints).
 *   - Never reads or writes the Event, TeamExternalMapping, or any other
 *     business table — a diagnostic-only run cannot corrupt or duplicate data,
 *     and provider unavailability can never cause data loss.
 *   - tenantId always originates from a trusted session context (enforced by
 *     `requireEnabledSfvConfigForTenant`, the same guard used by every other
 *     SFV sync entry point).
 *   - Idempotent: running twice for the same tenant produces an identical
 *     diagnostic outcome (only `startedAt`/`finishedAt`/`durationMs` differ).
 */

import { requireEnabledSfvConfigForTenant } from "../tenant-config-service";
import type { SfvTournamentSyncResult } from "./tournament-types";

// ── Constants ─────────────────────────────────────────────────────────────────

const PROVIDER = "SFV";

/** Stable diagnostic code surfaced to admins and consumed by tests/UI. */
export const PROVIDER_SOURCE_UNAVAILABLE_CODE = "PROVIDER_SOURCE_UNAVAILABLE";

export const PROVIDER_SOURCE_UNAVAILABLE_MESSAGE =
  "Die SFV Club API (OpenAPI v26.6.15.2) stellt keinen strukturierten Endpunkt für Turniere " +
  "bereit (geprüfte Endpunkte: token, club/{clubId}/players|officials|coaches|referees, " +
  "club/schedule, club/ranking, common/ids, match/{matchId}(+players|events|bench|referees), " +
  "team/list, team/picture/{teamId}). Die einzige Quelle für geplante Turniere ist die " +
  "öffentliche FVNWS Matchcenter-Webseite; automatisierter Zugriff darauf wird vom Anbieter " +
  'aktiv blockiert ("Ein maschineller Zugriff ist nicht erlaubt und wurde unterbunden" — ' +
  "Kontakt: support@football.ch). Es findet daher kein automatischer Import statt.";

export const RECOMMENDED_ACTION =
  'Turniere weiterhin manuell über "Events → Turniere → Turnier erstellen" erfassen ' +
  "(fliesst automatisch in Website, Wochenplan, Teamseiten und Infoboard ein). Für eine " +
  "automatisierte Anbindung ist eine schriftliche Freigabe bzw. ein strukturierter Endpunkt " +
  "von football.ch (support@football.ch) erforderlich.";

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Runs a tenant-scoped SFV tournament synchronization "attempt".
 *
 * Resolves and validates the tenant's SFV configuration exactly like every
 * other SFV sync entry point (throws `SfvTenantConfigNotFoundError` /
 * `SfvTenantConfigDisabledError` under the same conditions), then returns a
 * diagnostic-only result: no HTTP request is made and no database write
 * occurs, because no reliable structured provider source for tournaments
 * exists (see module documentation above).
 *
 * @param tenantId  Trusted session-derived tenant identifier.
 * @returns         Typed, sanitized diagnostic result safe to return from an API route.
 *
 * @throws {SfvTenantConfigNotFoundError}  No TenantSfvConfig for this tenant.
 * @throws {SfvTenantConfigDisabledError}  Integration disabled for this tenant.
 */
export async function syncSfvTournaments(tenantId: string): Promise<SfvTournamentSyncResult> {
  const startedAt = new Date();

  const tenantConfig = await requireEnabledSfvConfigForTenant(tenantId);

  const finishedAt = new Date();

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    tenantId,
    source: PROVIDER,
    clubId: tenantConfig.clubId,
    seasonId: tenantConfig.defaultSeasonId,
    fetched: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    blocked: true,
    warnings: [
      {
        code: PROVIDER_SOURCE_UNAVAILABLE_CODE,
        message: PROVIDER_SOURCE_UNAVAILABLE_MESSAGE,
      },
    ],
    recommendedAction: RECOMMENDED_ACTION,
    errors: [],
  };
}
