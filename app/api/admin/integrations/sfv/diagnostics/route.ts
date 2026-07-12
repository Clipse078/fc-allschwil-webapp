/**
 * POST /api/admin/integrations/sfv/diagnostics
 *
 * Authenticated admin-only SFV diagnostics endpoint.
 *
 * Tenant-safe contract:
 *   - clubId is resolved exclusively from tenant configuration — never from the request body.
 *   - tenantId is resolved exclusively from the authenticated session — never from the request.
 *   - seasonId defaults to config.defaultSeasonId; an explicit positive-integer override may
 *     be supplied in the request body as { "seasonId": <positive integer> }.
 *   - Any request body containing "clubId" is rejected with 400.
 *
 * Authorization: requires TENANTS_MANAGE permission.
 * Tenant isolation: tenantId always comes from the authenticated session.
 *
 * HTTP status mapping:
 *   200  — healthy or degraded
 *   400  — validation failure (clubId in body, invalid seasonId, malformed JSON)
 *   401  — unauthenticated
 *   403  — unauthorized or missing tenant context in session
 *   404  — no SFV configuration found for this tenant
 *   409  — SFV integration is disabled for this tenant
 *   500  — unexpected internal error (no internal details exposed)
 *   502  — unhealthy, no retryable issues
 *   503  — unhealthy, at least one retryable issue
 *
 * Response shape:
 *   { diagnostics: SfvAdminDiagnostics }
 *
 * Safety guarantees:
 *   - No Prisma imports. No repository imports. Service layer only.
 *   - No base64, credentials, tokens, raw SFV response bodies, or stack traces.
 *   - Unexpected programmer errors return a generic 500 without internal details.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  runSfvAdminDiagnostics,
  type SfvAdminDiagnostics,
  type SfvDiagnosticIssue,
} from "@/lib/integrations/sfv/admin-diagnostics-service";
import { requireEnabledSfvConfigForTenant } from "@/lib/integrations/sfv/tenant-config-service";
import {
  SfvTenantConfigNotFoundError,
  SfvTenantConfigDisabledError,
} from "@/lib/integrations/sfv/tenant-config-types";

export const dynamic = "force-dynamic";

/**
 * Returns 503 if any issue in the unhealthy result is retryable; 502 otherwise.
 *
 * Retryable conditions (e.g. SFV_TIMEOUT, SFV_UNAVAILABLE, SFV_RATE_LIMITED)
 * indicate a transient upstream failure that may resolve on retry.
 * Non-retryable conditions (e.g. SFV_AUTH_FAILURE, SFV_SERVER_FAILURE) indicate
 * a persistent problem that will not resolve without intervention.
 */
function unhealthyHttpStatus(issues: readonly SfvDiagnosticIssue[]): 502 | 503 {
  return issues.some((issue) => issue.retryable === true) ? 503 : 502;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Authenticate and authorize — must happen before any input processing ──
  const access = await requireApiPermission(PERMISSIONS.TENANTS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  // ── 2. Resolve tenantId from session — never from request ─────────────────
  const tenantId = access.session.user.tenantId;

  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant context missing from session" },
      { status: 403 },
    );
  }

  // ── 3. Parse request body — optional; clubId is forbidden ─────────────────
  //
  // An absent or empty body is valid. The only accepted field is seasonId,
  // which overrides the tenant-configured default season when supplied.
  // clubId MUST NOT appear in the body — it is sourced from tenant configuration.
  let seasonOverride: number | undefined;

  const rawText = await request.text().catch(() => "");
  const trimmed = rawText.trim();

  if (trimmed.length > 0) {
    let parsed: unknown;

    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 },
      );
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 },
      );
    }

    const raw = parsed as Record<string, unknown>;

    // clubId MUST NOT be supplied — it is resolved from tenant configuration
    if ("clubId" in raw) {
      return NextResponse.json(
        {
          error:
            "clubId must not be supplied in the request body. " +
            "It is resolved from the tenant SFV configuration.",
        },
        { status: 400 },
      );
    }

    // seasonId is optional — when present it must be a valid positive integer
    if ("seasonId" in raw) {
      const { seasonId } = raw;

      if (
        typeof seasonId !== "number" ||
        !Number.isInteger(seasonId) ||
        seasonId <= 0
      ) {
        return NextResponse.json(
          { error: "seasonId must be a positive integer" },
          { status: 400 },
        );
      }

      seasonOverride = seasonId;
    }
  }

  // ── 4. Resolve tenant SFV configuration — tenantId from session only ──────
  let config;

  try {
    config = await requireEnabledSfvConfigForTenant(tenantId);
  } catch (e) {
    if (e instanceof SfvTenantConfigNotFoundError) {
      return NextResponse.json(
        { error: "No SFV configuration found for this tenant" },
        { status: 404 },
      );
    }

    if (e instanceof SfvTenantConfigDisabledError) {
      return NextResponse.json(
        { error: "SFV integration is disabled for this tenant" },
        { status: 409 },
      );
    }

    console.error(
      "[sfv/diagnostics] Unexpected error from requireEnabledSfvConfigForTenant:",
      e,
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // ── 5. Resolve clubId and seasonId — exclusively from configuration ────────
  const clubId = config.clubId;
  const seasonId = seasonOverride ?? config.defaultSeasonId;

  // ── 6. Run diagnostics ────────────────────────────────────────────────────
  let diagnostics: SfvAdminDiagnostics;

  try {
    diagnostics = await runSfvAdminDiagnostics({ clubId, seasonId });
  } catch (e) {
    console.error("[sfv/diagnostics] Unexpected error from runSfvAdminDiagnostics:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // ── 7. Map health to HTTP status and return ───────────────────────────────
  const status =
    diagnostics.health === "unhealthy" ? unhealthyHttpStatus(diagnostics.issues) : 200;

  return NextResponse.json({ diagnostics }, { status });
}
