/**
 * POST /api/admin/integrations/sfv/detail/sync
 *
 * Tenant-scoped SFV match-detail synchronization endpoint (Slice 3C).
 *
 * Iterates over all MatchExternalMapping rows for the tenant and enriches
 * each linked Event with richer match-day data from GET /api/match/{matchId}.
 * Returns a typed, sanitized SfvDetailSyncResult.
 *
 * Architecture guarantee:
 *   This endpoint NEVER creates Events. It only updates existing Events that
 *   are already linked through a MatchExternalMapping. Club-managed fields
 *   (title, remarks, meetingTime, pitchCode, dressingRooms, visibility flags,
 *   reviewStage, seasonId, teamId, opponentName, resultLabel) are never
 *   modified. Only provider-managed fields may change:
 *     startAt, status, location, competitionLabel, intermediateResultLabel.
 *
 * Tenant-safe contract:
 *   - tenantId is resolved exclusively from the authenticated session.
 *   - clubId and seasonId are resolved from TenantSfvConfig — never from
 *     the request body.
 *   - No provider credentials are accepted from, or returned to, the client.
 *
 * Authorization: requires TENANTS_MANAGE permission.
 *
 * HTTP status mapping:
 *   200  — sync completed (may include per-match failures in the result)
 *   401  — unauthenticated
 *   403  — unauthorized or missing tenant context
 *   404  — no SFV configuration found for this tenant
 *   409  — SFV integration is disabled for this tenant
 *   500  — unexpected internal error (no internal details exposed)
 *
 * Response shape:
 *   { result: SfvDetailSyncResult }
 *
 * Security guarantees:
 *   - No credentials, tokens, or raw provider payloads in responses.
 *   - No stack traces.
 *   - All DB queries are scoped to the session-derived tenantId.
 */

import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  SfvTenantConfigNotFoundError,
  SfvTenantConfigDisabledError,
} from "@/lib/integrations/sfv/tenant-config-types";
import { syncSfvMatchDetails } from "@/lib/integrations/sfv/sync/detail";

export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  // ── Authorization ──────────────────────────────────────────────────────────
  const access = await requireApiPermission(PERMISSIONS.TENANTS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user.tenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Kein Mandanten-Kontext in der Sitzung." },
      { status: 403 },
    );
  }

  // ── Synchronization ────────────────────────────────────────────────────────
  try {
    const result = await syncSfvMatchDetails(tenantId);
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

    console.error(
      "[sfv/detail/sync] Unexpected error:",
      err instanceof Error ? err.message : "unknown",
    );
    return NextResponse.json(
      { error: "Interner Serverfehler. Bitte erneut versuchen." },
      { status: 500 },
    );
  }
}
