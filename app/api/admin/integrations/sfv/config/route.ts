/**
 * GET|POST /api/admin/integrations/sfv/config
 *
 * Authenticated admin-only tenant SFV configuration endpoint.
 *
 * GET  — Returns the current TenantSfvConfig for the authenticated tenant, or
 *         { config: null } when no configuration has been created yet.
 *
 * POST — Creates or updates the TenantSfvConfig for the authenticated tenant.
 *         Input is validated before persistence. Returns the saved config.
 *
 * Authorization: requires TENANTS_MANAGE permission.
 * Tenant isolation: tenantId is ALWAYS resolved from the authenticated session.
 *   The request body MUST NOT contain tenantId. Any tenantId in the body is
 *   silently ignored — it is never used, read, or forwarded.
 *
 * Authorization occurs BEFORE body parsing. Unauthenticated or unauthorized
 * requests never reach the body parser.
 *
 * Input (POST body):
 *   {
 *     "clubId": number,           — positive integer
 *     "defaultSeasonId": number,  — positive integer
 *     "organisationId": number | null,  — optional positive integer
 *     "enabled": boolean
 *   }
 *
 * Response (GET and POST on success):
 *   { "config": TenantSfvConfig | null }
 *
 * HTTP status mapping:
 *   200  — success (GET or POST)
 *   400  — malformed body / validation failure
 *   401  — unauthenticated
 *   403  — unauthorized or missing tenant context in session
 *   500  — unexpected internal error (no internal details exposed)
 *
 * Safety guarantees:
 *   - No credentials, tokens, stack traces, or Prisma internals in responses.
 *   - Service layer is the exclusive path to the database.
 *   - tenantId never originates from request input.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getSfvConfigForTenant,
  upsertSfvConfigForTenant,
} from "@/lib/integrations/sfv/tenant-config-service";
import {
  type TenantSfvConfigInput,
  SfvTenantConfigValidationError,
} from "@/lib/integrations/sfv/tenant-config-types";

export const dynamic = "force-dynamic";

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
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

  // ── 3. Fetch current configuration via service layer ──────────────────────
  let config;

  try {
    config = await getSfvConfigForTenant(tenantId);
  } catch (e) {
    console.error("[sfv/config] GET: Unexpected error from getSfvConfigForTenant:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ config });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Authenticate and authorize — must happen before any input processing ──
  const access = await requireApiPermission(PERMISSIONS.TENANTS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  // ── 2. Resolve tenantId from session — never from request body ────────────
  const tenantId = access.session.user.tenantId;

  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant context missing from session" },
      { status: 403 },
    );
  }

  // ── 3. Parse request body ─────────────────────────────────────────────────
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

  // ── 4. Extract fields — tenantId from body is explicitly excluded ─────────
  const raw = body as Record<string, unknown>;

  const input: TenantSfvConfigInput = {
    clubId: raw.clubId as number,
    defaultSeasonId: raw.defaultSeasonId as number,
    organisationId: (raw.organisationId ?? null) as number | null,
    enabled: raw.enabled as boolean,
  };

  // ── 5. Create or update configuration via service layer ───────────────────
  try {
    const config = await upsertSfvConfigForTenant(tenantId, input);
    return NextResponse.json({ config }, { status: 200 });
  } catch (e) {
    if (e instanceof SfvTenantConfigValidationError) {
      return NextResponse.json(
        { error: e.message, field: e.field },
        { status: 400 },
      );
    }

    console.error("[sfv/config] POST: Unexpected error from upsertSfvConfigForTenant:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
