/**
 * POST /api/admin/integrations/sfv/diagnostics
 *
 * Authenticated admin-only SFV diagnostics endpoint.
 *
 * Runs the stateless, read-only SFV admin diagnostics pipeline and returns the
 * typed result as JSON. Delegates entirely to runSfvAdminDiagnostics — no raw
 * SFV client calls, no database access, no cache, no mutations.
 *
 * Authorization: requires TENANTS_MANAGE permission.
 * Tenant isolation: session-carried tenantId via the existing requireApiPermission
 * mechanism. ClubId and seasonId are accepted from the request body.
 *
 * Tenant-safety note (future work — Slice: Tenant-Scoped SFV Configuration):
 *   clubId and seasonId are currently accepted from the request body because no
 *   tenant-scoped SFV configuration layer exists yet. A future configuration slice
 *   should validate that the requesting tenant is authorized for the given clubId
 *   before allowing the call. Until that layer exists, only administrators with
 *   TENANTS_MANAGE permission may reach this route. Arbitrary clubId access is
 *   not production-safe across tenants without that additional authorization.
 *
 * HTTP status mapping:
 *   healthy   → 200
 *   degraded  → 200
 *   unhealthy → 503 if any issue is retryable; 502 otherwise
 *
 * Response shape:
 *   { diagnostics: SfvAdminDiagnostics }
 *
 * Safety guarantees:
 *   - No base64, credentials, tokens, raw SFV response bodies, or stack traces.
 *   - Input validated before runSfvAdminDiagnostics is called.
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

export const dynamic = "force-dynamic";

/**
 * Returns 503 if any issue in the unhealthy result is retryable; 502 otherwise.
 *
 * Retryable conditions (e.g. SFV_TIMEOUT, SFV_UNAVAILABLE, SFV_RATE_LIMITED)
 * indicate a transient upstream failure that may resolve on retry.
 * Non-retryable conditions (e.g. SFV_AUTH_FAILURE, SFV_SERVER_FAILURE,
 * SFV_NETWORK_FAILURE with non-retryable codes) indicate a persistent upstream
 * or configuration problem that will not resolve without intervention.
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

  // ── 2. Parse request body ──────────────────────────────────────────────────
  const body = await request.json().catch(() => null);

  if (body === null || body === undefined) {
    return NextResponse.json({ error: "Request body required" }, { status: 400 });
  }

  if (typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 },
    );
  }

  // ── 3. Validate clubId ────────────────────────────────────────────────────
  const raw = body as Record<string, unknown>;

  if (!("clubId" in raw)) {
    return NextResponse.json({ error: "clubId is required" }, { status: 400 });
  }

  const { clubId } = raw;

  if (typeof clubId !== "number" || !Number.isInteger(clubId) || clubId <= 0) {
    return NextResponse.json(
      { error: "clubId must be a positive integer" },
      { status: 400 },
    );
  }

  // ── 4. Validate seasonId ──────────────────────────────────────────────────
  if (!("seasonId" in raw)) {
    return NextResponse.json({ error: "seasonId is required" }, { status: 400 });
  }

  const { seasonId } = raw;

  if (typeof seasonId !== "number" || !Number.isInteger(seasonId) || seasonId <= 0) {
    return NextResponse.json(
      { error: "seasonId must be a positive integer" },
      { status: 400 },
    );
  }

  // ── 5. Run diagnostics ────────────────────────────────────────────────────
  let diagnostics: SfvAdminDiagnostics;

  try {
    diagnostics = await runSfvAdminDiagnostics({ clubId, seasonId });
  } catch (e) {
    console.error("[sfv/diagnostics] Unexpected error from runSfvAdminDiagnostics:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // ── 6. Map health to HTTP status and return ───────────────────────────────
  const status =
    diagnostics.health === "unhealthy" ? unhealthyHttpStatus(diagnostics.issues) : 200;

  return NextResponse.json({ diagnostics }, { status });
}
