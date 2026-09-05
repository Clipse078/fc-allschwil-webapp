/**
 * GET /api/ops/club-directory-02c-sfv-consolidation
 *
 * CLUB-DIRECTORY-02C-OPS — Temporary STAGE-only read-only operator endpoint.
 *
 * PURPOSE
 *   scripts/club-directory-02c-sfv-consolidation.ts (`--inventory` /
 *   `--dry-run`) cannot be run locally against STAGE data because
 *   SFV_TOKEN_URL / SFV_APPLICATION_KEY / SFV_APPLICATION_PASS /
 *   SFV_CLUB_ID are Vercel Sensitive Production environment variables —
 *   Vercel correctly refuses to let them be pulled in plaintext. The
 *   deployed STAGE runtime already has these credentials configured (the
 *   ordinary SFV cron works there). This route exposes the exact same
 *   read-only inventory/dry-run preview over HTTP so an operator can run it
 *   against STAGE without ever touching the credentials directly.
 *
 * REUSE — NO DUPLICATED DECISION LOGIC
 *   This route imports and calls, verbatim, the same pure functions the CLI
 *   uses (scripts/club-directory-02c-sfv-consolidation.ts):
 *     - resolveTenantContexts  — resolves the tenant's TenantSfvConfig.
 *     - loadTenantInventory    — live (read-only) SFV calls to resolve
 *                                clubNumber + duplicate-group detection
 *                                (findDuplicateGroups).
 *     - buildTenantPlan        — the EXACT merge decision per group
 *                                (chooseCanonicalClubId / chooseLogoDonor
 *                                from lib/club-directory/consolidation-service.ts),
 *                                identical to what `--dry-run` prints and to
 *                                what `--execute` would actually do.
 *   This route adds NO parallel classification/decision logic of its own —
 *   it only calls these functions and serializes their (already sanitized)
 *   return values.
 *
 * WHY EXECUTE CAN NEVER HAPPEN THROUGH THIS ROUTE
 *   - This file exports only `GET`; there is no POST/PUT/PATCH/DELETE
 *     handler, so Next.js returns 405 for any other HTTP method.
 *   - `mode` is validated against a fixed allow-list containing only
 *     "inventory" and "dry-run" — any other value (including "execute",
 *     "confirm", or any mutation-sounding string) is rejected with 400
 *     before any tenant/SFV/database work happens.
 *   - This module never imports `runSfvClubConsolidationForTenant`
 *     (lib/integrations/sfv/sync/club-consolidation.ts) or
 *     `consolidateExternalClubsByProviderIdentity`
 *     (lib/club-directory/consolidation-service.ts) — the only two
 *     functions in the codebase that ever write to ExternalClub /
 *     ExternalTeam / ExternalClubProviderMapping for this feature. It is
 *     therefore not merely *configured* to refuse execute — it is
 *     *incapable* of performing a write, because the write path is not
 *     reachable from this file at all.
 *   - `EXECUTE_CONFIRMATION` (the CLI's `--confirm` token) is never
 *     imported, read, or accepted from this route in any form.
 *
 * AUTHENTICATION
 *   Requires an authenticated SCE platform operator with the existing
 *   platform-only `tenants.manage` permission. Routine `CRON_SECRET`
 *   scheduler authority is deliberately not accepted.
 *
 * ENVIRONMENT GUARD — STAGE ONLY
 *   Rejects with 403 on every environment except STAGE (`APP_ENV=stage`,
 *   see lib/env.ts#getRuntimeEnvironment). This check runs BEFORE the auth
 *   check so that even an operator secret that were ever (mis-)shared
 *   across environments could not be used to reach this route outside
 *   STAGE.
 *
 * TENANT
 *   The only tenant this route will ever operate on is the explicit,
 *   hard-coded key `fc-allschwil` — never accepted from the request body,
 *   always compared against the caller-supplied `?tenant=` query parameter
 *   so an operator must explicitly acknowledge which tenant they are
 *   targeting. Any other value is rejected with 403.
 *
 * RESPONSE CONTENTS
 *   - tenant (key), resolved team count, duplicate groups (always).
 *   - dry-run only: the per-group plan (canonical club, teams to move, logo
 *     donor, clubs to archive) — identical shape to the CLI's `--dry-run`
 *     output — plus a deterministic SHA-256 `planFingerprint` computed by
 *     the shared, pure `computePlanFingerprint` helper
 *     (lib/club-directory/plan-fingerprint.ts). An operator pins this
 *     fingerprint after reviewing the plan; the separate, temporary,
 *     POST-only execute endpoint
 *     (app/api/ops/club-directory-02c-sfv-consolidation-execute/route.ts)
 *     requires it to match a freshly regenerated plan's fingerprint before
 *     it will mutate anything. Computing this fingerprint is a pure,
 *     read-only operation — it does NOT weaken this route's no-write
 *     guarantee (see "WHY EXECUTE CAN NEVER HAPPEN THROUGH THIS ROUTE"
 *     above, which still holds unchanged).
 *   - Never includes SFV credentials, tokens, or raw SFV response payloads
 *     — `loadTenantInventory`/`buildTenantPlan` never return them, and this
 *     route does not read process.env.SFV_* itself.
 *
 * This route must be removed once local/CI access to SFV credentials (or an
 * equivalent non-production verification path) makes it unnecessary.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRuntimeEnvironment } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import {
  resolveTenantContexts,
  loadTenantInventory,
  buildTenantPlan,
  type TenantInventory,
} from "@/scripts/club-directory-02c-sfv-consolidation";
import { computePlanFingerprint } from "@/lib/club-directory/plan-fingerprint";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export const dynamic = "force-dynamic";

/** The only tenant this temporary endpoint is allowed to operate on. */
const ALLOWED_TENANT_KEY = "fc-allschwil";

/**
 * Fixed allow-list — deliberately does NOT include "execute", "confirm", or
 * any other value. Anything outside this set is rejected with 400.
 */
const ALLOWED_MODES = ["inventory", "dry-run"] as const;
type AllowedMode = (typeof ALLOWED_MODES)[number];

function isAllowedMode(value: string | null): value is AllowedMode {
  return value !== null && (ALLOWED_MODES as readonly string[]).includes(value);
}

/** Strips this down to exactly the fields the task requires — no raw provider data. */
function serializeInventory(inventory: TenantInventory) {
  return {
    tenant: inventory.tenant.tenantKey,
    resolvedTeamCount: inventory.resolvedTeamCount,
    duplicateGroups: inventory.duplicateGroups,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ── 1. STAGE-only guard — checked before authentication (see module doc) ──
  const runtimeEnv = getRuntimeEnvironment();
  if (!runtimeEnv.isStage) {
    return NextResponse.json(
      { error: "This endpoint is only available in the STAGE environment." },
      { status: 403 },
    );
  }

  // ── 2. Existing platform-operator permission boundary ─────────────────────
  const access = await requireApiPermission(PERMISSIONS.TENANTS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  // ── 3. Tenant must be explicit and match the single allowed tenant ────────
  const { searchParams } = new URL(request.url);
  const tenant = searchParams.get("tenant");
  if (tenant !== ALLOWED_TENANT_KEY) {
    return NextResponse.json(
      { error: `tenant must be provided explicitly as "${ALLOWED_TENANT_KEY}".` },
      { status: 403 },
    );
  }

  // ── 4. Mode must be inventory or dry-run — execute is never reachable ─────
  const mode = searchParams.get("mode");
  if (!isAllowedMode(mode)) {
    return NextResponse.json(
      {
        error:
          'mode must be "inventory" or "dry-run". Mutating modes (e.g. execute/confirm) are not supported over HTTP.',
      },
      { status: 400 },
    );
  }

  try {
    const tenants = await resolveTenantContexts(prisma, ALLOWED_TENANT_KEY);
    const tenantContext = tenants[0];

    if (!tenantContext) {
      return NextResponse.json(
        { error: `No enabled SFV configuration found for tenant "${ALLOWED_TENANT_KEY}".` },
        { status: 404 },
      );
    }

    const inventory = await loadTenantInventory(prisma, tenantContext);

    if (mode === "inventory") {
      return NextResponse.json(
        { mode, ...serializeInventory(inventory) },
        { status: 200 },
      );
    }

    // mode === "dry-run" — read-only preview, zero database writes.
    const plan = await buildTenantPlan(prisma, inventory);
    const planFingerprint = computePlanFingerprint({
      tenantKey: inventory.tenant.tenantKey,
      groups: plan.groups,
    });

    return NextResponse.json(
      {
        mode,
        ...serializeInventory(inventory),
        plan: plan.groups,
        planFingerprint,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error(
      "[ops/club-directory-02c-sfv-consolidation] Unexpected error:",
      err instanceof Error ? err.message : "unknown",
    );
    return NextResponse.json(
      { error: "Interner Serverfehler. Bitte erneut versuchen." },
      { status: 500 },
    );
  }
}
