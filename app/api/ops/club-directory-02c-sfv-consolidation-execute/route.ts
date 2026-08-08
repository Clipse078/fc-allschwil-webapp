/**
 * POST /api/ops/club-directory-02c-sfv-consolidation-execute
 *
 * CLUB-DIRECTORY-02C-EXEC — Temporary, supervised STAGE-only execution
 * endpoint for the ALREADY-REVIEWED FC Allschwil consolidation plan.
 *
 * WHY THIS EXISTS AS A SEPARATE ROUTE
 *   scripts/club-directory-02c-sfv-consolidation.ts's `--execute` path
 *   cannot be run locally: it needs live SFV credentials
 *   (SFV_TOKEN_URL / SFV_APPLICATION_KEY / SFV_APPLICATION_PASS /
 *   SFV_CLUB_ID), which are Vercel Sensitive Production environment
 *   variables and cannot be pulled in plaintext. Those credentials ARE
 *   configured on the deployed STAGE runtime. This route is a narrowly
 *   scoped, temporary way to run exactly one supervised execution there,
 *   after a human has already reviewed the read-only dry-run
 *   (GET /api/ops/club-directory-02c-sfv-consolidation?mode=dry-run) STAGE
 *   result. It is intentionally a SEPARATE file from that read-only route —
 *   the read-only route continues to export GET only and remains
 *   structurally incapable of ever mutating anything (see its own module
 *   doc); this file is the only place `POST` (and therefore any mutation)
 *   is reachable, and it is expected to be deleted once this one supervised
 *   run has happened.
 *
 * REUSE — NO DUPLICATED MUTATION LOGIC
 *   This route performs NO merge/archive/move decision of its own. It:
 *     - reuses `resolveTenantContexts` / `resolveProviderClubIdIndex` /
 *       `loadTenantInventoryFromIndex` / `buildTenantPlan`
 *       (scripts/club-directory-02c-sfv-consolidation.ts) to regenerate the
 *       plan, exactly like the read-only dry-run does;
 *     - reuses `computePlanFingerprint`
 *       (lib/club-directory/plan-fingerprint.ts) — the SAME pure helper the
 *       read-only route's dry-run response now also exposes — to compare
 *       the freshly regenerated plan against the operator-pinned one;
 *     - reuses `buildBackupSnapshot` (scripts/club-directory-02c-sfv-consolidation.ts)
 *       for the pre-mutation backup contents, persisted durably via
 *       `persistConsolidationBackupSnapshot` (lib/club-directory/ops-backup-storage.ts);
 *     - reuses `consolidateExternalClubsByProviderIdentity`
 *       (lib/club-directory/consolidation-service.ts) through the exact
 *       same Prisma adapter (`createClubConsolidationDatabase`,
 *       lib/club-directory/prisma-consolidation-adapter.ts) ordinary sync
 *       and the CLI's `--execute` path use — the ONLY function in the
 *       codebase that ever writes to ExternalClub / ExternalTeam /
 *       ExternalClubProviderMapping for this feature.
 *   No new mutation code path is introduced anywhere.
 *
 * WHY `consolidateExternalClubsByProviderIdentity` DIRECTLY, NOT
 * `runSfvClubConsolidationForTenant` (TOCTOU ANALYSIS)
 *   `runSfvClubConsolidationForTenant()` (lib/integrations/sfv/sync/club-consolidation.ts)
 *   fetches SFV's team-list/ranking data ITSELF before calling the
 *   consolidation service. Calling it here — AFTER already regenerating and
 *   fingerprinting the plan via a first SFV fetch — would perform a SECOND,
 *   independent SFV fetch for the mutation itself. Between those two
 *   fetches SFV data could change, so the identity map actually executed
 *   against could silently drift from the exact map the fingerprinted,
 *   operator-approved plan was built from — a time-of-check-to-time-of-use
 *   (TOCTOU) gap. This route closes that gap by fetching SFV EXACTLY ONCE
 *   per request (`resolveProviderClubIdIndex`) and passing that SAME
 *   `providerTeamId -> providerClubId` index straight into
 *   `consolidateExternalClubsByProviderIdentity` through its Prisma
 *   adapter, instead of calling `runSfvClubConsolidationForTenant` (which
 *   would ignore the already-fetched index and fetch SFV again).
 *
 * ENVIRONMENT GUARD — STAGE ONLY
 *   Rejects with 403 on every environment except STAGE (`APP_ENV=stage`,
 *   see lib/env.ts#getRuntimeEnvironment), checked BEFORE authentication.
 *
 * AUTHENTICATION
 *   Same `CRON_SECRET` operator secret, same `Authorization: Bearer
 *   <CRON_SECRET>` contract as app/api/cron/sfv-sync/route.ts and the
 *   read-only CLUB-DIRECTORY-02C ops endpoint. Fails closed (401) if
 *   CRON_SECRET is not configured server-side. No new persistent secret is
 *   introduced.
 *
 * FIXED TENANT
 *   Operates ONLY on the hard-coded tenant key `fc-allschwil` — the request
 *   body is never read for a tenant identifier at all.
 *
 * POST ONLY
 *   Only `POST` is exported. There is no GET/PUT/PATCH/DELETE handler.
 *
 * EXPLICIT CONFIRMATION + PLAN-FINGERPRINT PINNING
 *   The JSON body MUST contain:
 *     { "confirmation": "CONSOLIDATE-CLUB-DIRECTORY",
 *       "expectedPlanFingerprint": "<sha256 hex from the reviewed dry-run>" }
 *   Both checks happen BEFORE any tenant/SFV/database access. The plan is
 *   then regenerated live (never trusting the caller-supplied JSON as
 *   execution input) and re-fingerprinted; if it does not EXACTLY match
 *   `expectedPlanFingerprint`, the request aborts with zero mutations. This
 *   is also what makes a repeated request after a successful run safe: once
 *   consolidated, the regenerated plan's group set is empty/different, so
 *   its fingerprint no longer matches the originally-reviewed one and the
 *   second call aborts before touching anything (idempotent no-op).
 *
 * BACKUP BEFORE MUTATION
 *   See lib/club-directory/ops-backup-storage.ts. No mutation is attempted
 *   unless the backup was durably persisted first.
 *
 * FAILURE SAFETY / CREDENTIAL HYGIENE
 *   Every guard above runs, in order, before any SFV/DB access; any failure
 *   returns before `consolidateExternalClubsByProviderIdentity` is ever
 *   called. All error responses are sanitized generic messages — no
 *   DATABASE_URL / SFV_* / CRON_SECRET value, and no raw internal error
 *   message, is ever included in a response body.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRuntimeEnvironment } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import {
  resolveTenantContexts,
  resolveProviderClubIdIndex,
  loadTenantInventoryFromIndex,
  buildTenantPlan,
  buildBackupSnapshot,
  PROVIDER,
  EXECUTE_CONFIRMATION,
  type TenantSfvContext,
  type TenantInventory,
  type TenantPlan,
} from "@/scripts/club-directory-02c-sfv-consolidation";
import { computePlanFingerprint } from "@/lib/club-directory/plan-fingerprint";
import { persistConsolidationBackupSnapshot } from "@/lib/club-directory/ops-backup-storage";
import { consolidateExternalClubsByProviderIdentity } from "@/lib/club-directory/consolidation-service";
import { createClubConsolidationDatabase } from "@/lib/club-directory/prisma-consolidation-adapter";

export const dynamic = "force-dynamic";

/** The only tenant this temporary endpoint is allowed to operate on. Never
 * read from the request — resolved internally so no caller can ever target
 * a different tenant through this route. */
const ALLOWED_TENANT_KEY = "fc-allschwil";

const GENERIC_ERROR_MESSAGE = "Interner Serverfehler. Bitte erneut versuchen.";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    // Fail closed: never allow an unauthenticated trigger of this endpoint.
    return false;
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

type ExecuteRequestBody = {
  confirmation?: unknown;
  expectedPlanFingerprint?: unknown;
};

async function parseRequestBody(request: NextRequest): Promise<ExecuteRequestBody | null> {
  try {
    const json = await request.json();
    if (typeof json !== "object" || json === null || Array.isArray(json)) {
      return null;
    }
    return json as ExecuteRequestBody;
  } catch {
    return null;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Never expose the tenant's internal ids beyond what an operator report needs. */
function serializeTenant(tenant: TenantSfvContext) {
  return { tenantKey: tenant.tenantKey };
}

type PostconditionReport = {
  duplicateGroupsRemaining: number;
  canonicalClubsActive: boolean;
  losingClubsArchivedNotDeleted: boolean;
  providerMappingsValid: boolean;
  tenantIsolationIntact: boolean;
  ok: boolean;
  issues: string[];
};

/**
 * Re-verifies (via fresh, read-only DB reads — never trusting the
 * consolidation service's own return value alone) that execution actually
 * left the database in the expected post-consolidation state:
 *   - the reviewed duplicate groups no longer span multiple active clubs
 *     (re-runs the grouping against the SAME already-fetched identity index
 *     — see the TOCTOU note above; this performs zero additional SFV calls);
 *   - every group's canonical club remains present and active (not archived);
 *   - every group's losing club was archived, not deleted (the row still
 *     exists, with `archivedAt` set);
 *   - every provider mapping for these providerClubIds now points at the
 *     canonical club;
 *   - every row touched belongs to the resolved tenant only (tenant
 *     isolation never crosses into another tenant's data).
 */
async function verifyPostcondition(
  tenant: TenantSfvContext,
  indexByTeamId: ReadonlyMap<number, number>,
  plan: TenantPlan,
): Promise<PostconditionReport> {
  const issues: string[] = [];

  const after = await loadTenantInventoryFromIndex(prisma, tenant, indexByTeamId);
  const duplicateGroupsRemaining = after.duplicateGroups.length;
  if (duplicateGroupsRemaining > 0) {
    issues.push(`${duplicateGroupsRemaining} duplicate group(s) still remain after execution.`);
  }

  const canonicalClubIds = [...new Set(plan.groups.map((g) => g.canonicalClubId))];
  const losingClubIds = [...new Set(plan.groups.flatMap((g) => g.clubsToArchive))];
  const allClubIds = [...new Set([...canonicalClubIds, ...losingClubIds])];

  const clubRows =
    allClubIds.length > 0
      ? await prisma.externalClub.findMany({
          where: { id: { in: allClubIds } },
          select: { id: true, tenantId: true, archivedAt: true },
        })
      : [];
  const clubRowById = new Map(clubRows.map((c) => [c.id, c]));

  let canonicalClubsActive = true;
  for (const id of canonicalClubIds) {
    const row = clubRowById.get(id);
    if (!row || row.archivedAt !== null) {
      canonicalClubsActive = false;
      issues.push(`Canonical club ${id} is missing or archived after execution.`);
    }
    if (row && row.tenantId !== tenant.tenantId) {
      issues.push(`Canonical club ${id} does not belong to tenant ${tenant.tenantKey}.`);
    }
  }

  let losingClubsArchivedNotDeleted = true;
  for (const id of losingClubIds) {
    const row = clubRowById.get(id);
    if (!row) {
      losingClubsArchivedNotDeleted = false;
      issues.push(`Losing club ${id} row is missing (must be archived, not deleted).`);
      continue;
    }
    if (row.archivedAt === null) {
      losingClubsArchivedNotDeleted = false;
      issues.push(`Losing club ${id} was not archived.`);
    }
    if (row.tenantId !== tenant.tenantId) {
      issues.push(`Losing club ${id} does not belong to tenant ${tenant.tenantKey}.`);
    }
  }

  const providerClubIds = plan.groups.map((g) => g.providerClubId);
  const mappingRows =
    providerClubIds.length > 0
      ? await prisma.externalClubProviderMapping.findMany({
          where: { tenantId: tenant.tenantId, provider: PROVIDER, providerClubId: { in: providerClubIds } },
          select: { providerClubId: true, externalClubId: true, tenantId: true },
        })
      : [];
  const mappingByProviderClubId = new Map(mappingRows.map((m) => [m.providerClubId, m]));

  let providerMappingsValid = true;
  let tenantIsolationIntact = true;
  for (const group of plan.groups) {
    const mapping = mappingByProviderClubId.get(group.providerClubId);
    if (!mapping || mapping.externalClubId !== group.canonicalClubId) {
      providerMappingsValid = false;
      issues.push(`Provider mapping for clubNumber ${group.providerClubId} does not point at the canonical club.`);
    }
    if (mapping && mapping.tenantId !== tenant.tenantId) {
      tenantIsolationIntact = false;
      issues.push(`Provider mapping for clubNumber ${group.providerClubId} does not belong to tenant ${tenant.tenantKey}.`);
    }
  }
  if (issues.some((issue) => issue.includes("does not belong to tenant"))) {
    tenantIsolationIntact = false;
  }

  return {
    duplicateGroupsRemaining,
    canonicalClubsActive,
    losingClubsArchivedNotDeleted,
    providerMappingsValid,
    tenantIsolationIntact,
    ok:
      duplicateGroupsRemaining === 0 &&
      canonicalClubsActive &&
      losingClubsArchivedNotDeleted &&
      providerMappingsValid &&
      tenantIsolationIntact,
    issues,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. STAGE-only guard — checked before authentication ───────────────────
  const runtimeEnv = getRuntimeEnvironment();
  if (!runtimeEnv.isStage) {
    return NextResponse.json(
      { error: "This endpoint is only available in the STAGE environment." },
      { status: 403 },
    );
  }

  // ── 2. Authentication — same operator secret as the SFV cron route ────────
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 3. Body / confirmation / fingerprint — before ANY tenant/SFV/DB work ──
  const body = await parseRequestBody(request);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  if (body.confirmation !== EXECUTE_CONFIRMATION) {
    return NextResponse.json(
      { error: `confirmation must be exactly "${EXECUTE_CONFIRMATION}".` },
      { status: 400 },
    );
  }

  if (!isNonEmptyString(body.expectedPlanFingerprint)) {
    return NextResponse.json(
      { error: "expectedPlanFingerprint is required (the SHA-256 fingerprint from the reviewed dry-run)." },
      { status: 400 },
    );
  }
  const expectedPlanFingerprint = body.expectedPlanFingerprint;

  try {
    // ── 4. Resolve the fixed tenant — never accepted from the request ───────
    const tenants = await resolveTenantContexts(prisma, ALLOWED_TENANT_KEY);
    const tenant = tenants[0];
    if (!tenant) {
      return NextResponse.json(
        { error: `No enabled SFV configuration found for tenant "${ALLOWED_TENANT_KEY}".` },
        { status: 404 },
      );
    }

    // ── 5. Regenerate the plan LIVE — never trust caller-supplied JSON ──────
    // Exactly ONE SFV fetch for this whole request (see module doc's TOCTOU
    // analysis): `indexByTeamId` below is reused, unchanged, for the actual
    // mutation in step 8 — it is never re-fetched.
    const { indexByTeamId } = await resolveProviderClubIdIndex(tenant);
    const inventory: TenantInventory = await loadTenantInventoryFromIndex(prisma, tenant, indexByTeamId);
    const plan: TenantPlan = await buildTenantPlan(prisma, inventory);

    // ── 6. Plan-consistency guard — abort with ZERO mutations on any drift ──
    const actualPlanFingerprint = computePlanFingerprint({
      tenantKey: inventory.tenant.tenantKey,
      groups: plan.groups,
    });

    if (actualPlanFingerprint !== expectedPlanFingerprint) {
      return NextResponse.json(
        {
          error:
            "Plan fingerprint mismatch — the live plan no longer matches the reviewed/pinned plan. Aborting with zero mutations.",
          expectedPlanFingerprint,
          actualPlanFingerprint,
          tenant: serializeTenant(tenant),
        },
        { status: 409 },
      );
    }

    if (plan.groups.length === 0) {
      return NextResponse.json(
        {
          tenant: serializeTenant(tenant),
          planFingerprint: actualPlanFingerprint,
          mutated: false,
          message: "Nothing to consolidate — no duplicate groups found. Zero mutations performed.",
        },
        { status: 200 },
      );
    }

    // ── 7. Durable pre-mutation backup — no mutation without it ─────────────
    const backupSnapshot = await buildBackupSnapshot(prisma, [inventory]);
    const backupKey = `ops-backups/club-directory-02c-sfv-consolidation/${ALLOWED_TENANT_KEY}-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;
    const backupResult = await persistConsolidationBackupSnapshot(backupSnapshot, backupKey);

    if (!backupResult.ok) {
      return NextResponse.json(
        {
          error: "Pre-mutation backup could not be persisted. Aborting with zero mutations.",
          tenant: serializeTenant(tenant),
        },
        { status: backupResult.status },
      );
    }

    // ── 8. Real mutation — the ONLY write-capable call in this route ────────
    // Uses the exact `indexByTeamId` regenerated/fingerprinted in step 5
    // above — NOT `runSfvClubConsolidationForTenant`, which would perform a
    // second, independent SFV fetch (see module doc's TOCTOU analysis).
    const database = createClubConsolidationDatabase(prisma);
    const consolidation = await consolidateExternalClubsByProviderIdentity(database, {
      tenantId: tenant.tenantId,
      provider: PROVIDER,
      resolvedClubIdsByTeamId: indexByTeamId,
    });

    // ── 9. Postcondition verification ────────────────────────────────────────
    const postcondition = await verifyPostcondition(tenant, indexByTeamId, plan);

    return NextResponse.json(
      {
        tenant: serializeTenant(tenant),
        planFingerprint: actualPlanFingerprint,
        mutated: true,
        backup: { pathname: backupResult.pathname },
        consolidation: {
          groupsProcessed: consolidation.groupsProcessed,
          groupsMerged: consolidation.groupsMerged,
          groupsAlreadyConsolidated: consolidation.groupsAlreadyConsolidated,
          teamsMoved: consolidation.teamsMoved,
          clubsArchived: consolidation.clubsArchived,
        },
        postcondition,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error(
      "[ops/club-directory-02c-sfv-consolidation-execute] Unexpected error:",
      err instanceof Error ? err.message : "unknown",
    );
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 });
  }
}
