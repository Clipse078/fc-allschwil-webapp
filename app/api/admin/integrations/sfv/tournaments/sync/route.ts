/**
 * POST /api/admin/integrations/sfv/tournaments/sync
 *
 * Tenant-scoped SFV tournament synchronization endpoint.
 *
 * Uses the same authorized "Jetzt synchronisieren" architecture as
 * `/schedule/sync`, `/teams/sync`, `/competitions/sync`, and `/detail/sync`:
 * tenant resolved from the session, config resolved from `TenantSfvConfig`,
 * typed sanitized result. Unlike those endpoints, this one never performs an
 * HTTP request or a database write — see `lib/integrations/sfv/sync/tournament-sync.ts`
 * for the full investigation of why no reliable structured SFV/FVNW source
 * for tournaments exists today. The response always reports `blocked: true`
 * plus a `PROVIDER_SOURCE_UNAVAILABLE` warning and a recommended manual
 * fallback so administrators are never left guessing why zero tournaments
 * were imported.
 *
 * Tenant-safe contract:
 *   - tenantId is resolved exclusively from the authenticated session.
 *   - clubId and seasonId are resolved from TenantSfvConfig — never from
 *     the request body.
 *   - No provider credentials are accepted from, or returned to, the client.
 *
 * Authorization: requires TENANTS_MANAGE permission (same as every other
 * SFV sync endpoint).
 *
 * HTTP status mapping:
 *   200  — diagnostic run completed (always `blocked: true` in this release)
 *   401  — unauthenticated
 *   403  — unauthorized or missing tenant context
 *   404  — no SFV configuration found for this tenant
 *   409  — SFV integration is disabled for this tenant
 *   500  — unexpected internal error (no internal details exposed)
 *
 * Response shape:
 *   { result: SfvTournamentSyncResult }
 *
 * Security guarantees:
 *   - No credentials, tokens, or raw provider payloads in responses.
 *   - No stack traces.
 *   - No network request is ever made by this route.
 */

import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  SfvTenantConfigNotFoundError,
  SfvTenantConfigDisabledError,
} from "@/lib/integrations/sfv/tenant-config-types";
import { syncSfvTournaments } from "@/lib/integrations/sfv/sync/tournament-sync";

export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  // ── Authorization ──────────────────────────────────────────────────────────
  const access = await requireApiPermission(PERMISSIONS.TENANTS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Kein Mandanten-Kontext in der Sitzung." },
      { status: 403 },
    );
  }

  // ── Diagnostic run ─────────────────────────────────────────────────────────
  try {
    const result = await syncSfvTournaments(tenantId);
    return NextResponse.json({ result }, { status: 200 });
  } catch (err) {
    if (err instanceof SfvTenantConfigNotFoundError) {
      return NextResponse.json(
        { error: "Keine SFV-Konfiguration für diesen Mandanten gefunden." },
        { status: 404 },
      );
    }

    if (err instanceof SfvTenantConfigDisabledError) {
      return NextResponse.json(
        { error: "Die SFV-Integration ist für diesen Mandanten deaktiviert." },
        { status: 409 },
      );
    }

    // Unexpected internal error — never expose internal details.
    console.error(
      "[sfv/tournaments/sync] Unexpected error:",
      err instanceof Error ? err.message : "unknown",
    );
    return NextResponse.json(
      { error: "Interner Serverfehler. Bitte erneut versuchen." },
      { status: 500 },
    );
  }
}
