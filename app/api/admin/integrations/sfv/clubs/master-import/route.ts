/**
 * POST /api/admin/integrations/sfv/clubs/master-import
 *
 * CLUB-DIRECTORY-05 — tenant-scoped SFV club master import endpoint.
 *
 * Fetches the tenant's current SFV ranking table (the broadest reliable
 * club-enumeration source the SFV API exposes — see
 * lib/integrations/sfv/sync/club-master-import.ts for the full capability
 * investigation) and resolves-or-creates a canonical ExternalClub +
 * ExternalClubProviderMapping for every distinct opponent club it proves,
 * excluding the tenant's own club. Never creates an ExternalTeam. Returns a
 * typed, sanitized SfvClubMasterImportResult.
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
 *   200  — import completed (may include per-club failures in the result)
 *   401  — unauthenticated
 *   403  — unauthorized or missing tenant context
 *   404  — no SFV configuration found for this tenant
 *   409  — SFV integration is disabled for this tenant
 *   500  — unexpected internal error (no internal details exposed)
 *
 * Response shape:
 *   { result: SfvClubMasterImportResult }
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
import { runSfvClubMasterImport } from "@/lib/integrations/sfv/sync/club-master-import";

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

  // ── Import ─────────────────────────────────────────────────────────────────
  try {
    const result = await runSfvClubMasterImport(tenantId);
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
      "[sfv/clubs/master-import] Unexpected error:",
      err instanceof Error ? err.message : "unknown",
    );
    return NextResponse.json(
      { error: "Interner Serverfehler. Bitte erneut versuchen." },
      { status: 500 },
    );
  }
}
