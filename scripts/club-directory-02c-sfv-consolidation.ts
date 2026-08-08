/**
 * scripts/club-directory-02c-sfv-consolidation.ts
 *
 * CLUB-DIRECTORY-02C — Canonical Club Consolidation backfill.
 *
 * PROBLEM
 *   Before this slice, every SFV opponent team discovered via schedule sync
 *   got its own dedicated ExternalClub (see discovery-service.ts's module
 *   doc for the forward-looking fix that stops this from recurring). This
 *   script reconciles STAGE data that was ALREADY split by that limitation
 *   before the fix landed — the "PRE-EXISTING DUPLICATES" requirement.
 *
 * IDENTITY
 *   Uses the exact same provider-club-identity signal as the forward fix:
 *   SFV's `clubNumber`, resolved from GET /api/team/list (own teams) and
 *   GET /api/club/ranking (every team — own AND opponents — appearing in
 *   the tenant's current league/group standings). See
 *   lib/integrations/sfv/sync/club-identity.ts for the full investigation.
 *   A team whose clubNumber cannot be resolved this run is left completely
 *   untouched — never guessed at, never merged by name.
 *
 * SCOPE
 *   - Every tenant with an enabled TenantSfvConfig (or a single tenant via
 *     `--tenant <tenantKey>`).
 *   - Provider SFV only.
 *   - Never touches a team the SFV data does not currently resolve a
 *     clubNumber for.
 *   - Never deletes anything (see lib/club-directory/consolidation-service.ts
 *     for the full safety invariants — teams are re-parented, never lost;
 *     losing clubs are archived, never deleted; provider mappings are
 *     never deleted).
 *
 * Modes:
 *   --inventory   Read-only: reports every duplicate-club group found per
 *                 tenant (teams currently spanning >1 ExternalClub for the
 *                 same resolved clubNumber). Makes live (read-only) SFV
 *                 calls to resolve clubNumber, but ZERO database writes.
 *   --dry-run     Read-only: same as --inventory, plus the EXACT merge
 *                 decision (canonical club, teams to move, logo donor,
 *                 clubs to archive) using the same pure decision functions
 *                 the real execution path uses
 *                 (chooseCanonicalClubId / chooseLogoDonor from
 *                 lib/club-directory/consolidation-service.ts) — so the
 *                 preview can never drift from what --execute will do.
 *                 ZERO database writes.
 *   --execute     Live execution via the real, transactional consolidation
 *                 service. Requires --confirm CONSOLIDATE-CLUB-DIRECTORY.
 *
 * Usage:
 *   DATABASE_URL=<url> npx tsx scripts/club-directory-02c-sfv-consolidation.ts --inventory
 *   DATABASE_URL=<url> npx tsx scripts/club-directory-02c-sfv-consolidation.ts --dry-run
 *   DATABASE_URL=<url> npx tsx scripts/club-directory-02c-sfv-consolidation.ts \
 *     --execute --confirm CONSOLIDATE-CLUB-DIRECTORY [--tenant fc-allschwil]
 *
 * Safety:
 *   - Refuses to run --execute against a DATABASE_URL that looks like production.
 *   - Requires the SFV integration credentials (SFV_* env vars) to already
 *     be configured for a live clubNumber resolution — refuses to run any
 *     mode without them (never falls back to guessing identity).
 *   - Writes a pre-change JSON backup (every affected ExternalClub +
 *     ExternalTeam row) to .tmp/ (gitignored) before executing.
 *   - Delegates every actual write to the same transactional, per-group
 *     service used by ordinary sync (lib/club-directory/consolidation-service.ts)
 *     — this script adds NO parallel mutation logic of its own.
 *   - Prints a basic postcondition check after executing: every group
 *     reported as a duplicate before the run now resolves to exactly one
 *     distinct ExternalClub.
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

import { buildProviderClubIdIndex } from "@/lib/integrations/sfv/sync/club-identity";
import { chooseCanonicalClubId, chooseLogoDonor } from "@/lib/club-directory/consolidation-service";

// `club-consolidation.ts` (the mutating orchestrator) transitively imports
// the shared `@/lib/db/prisma` singleton, which throws at import time when
// DATABASE_URL is unset. Importing it dynamically — only inside the
// `--execute` branch in `main()` below — lets every PURE function in this
// file (findDuplicateGroups, buildGroupPlan, detectEnvironment, …) stay
// unit-testable in isolation without requiring DATABASE_URL just to import
// the module (see scripts/__tests__/club-directory-02c-sfv-consolidation.test.ts).
type RunSfvClubConsolidationForTenant =
  typeof import("@/lib/integrations/sfv/sync/club-consolidation").runSfvClubConsolidationForTenant;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PROVIDER = "SFV";
export const EXECUTE_CONFIRMATION = "CONSOLIDATE-CLUB-DIRECTORY";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TenantSfvContext = {
  tenantId: string;
  tenantKey: string;
  clubId: number;
  seasonId: number;
  organisationId: number | null;
};

export type DuplicateGroup = {
  providerClubId: number;
  distinctClubIds: string[];
  teamCount: number;
  providerTeamIds: number[];
};

export type TenantInventory = {
  tenant: TenantSfvContext;
  resolvedTeamCount: number;
  duplicateGroups: DuplicateGroup[];
};

export type GroupPlan = {
  providerClubId: number;
  canonicalClubId: string;
  clubsToArchive: string[];
  teamsToMove: number;
  logoAdoptedFromClubId: string | null;
};

export type TenantPlan = {
  tenant: TenantSfvContext;
  groups: GroupPlan[];
};

// ---------------------------------------------------------------------------
// Pure classification (no DB/network access — unit-testable in isolation)
// ---------------------------------------------------------------------------

export type RawTeamMappingRow = {
  providerTeamId: number;
  externalClubId: string;
};

/**
 * Groups mapping rows by resolved providerClubId and reports every group
 * whose teams currently span more than one distinct ExternalClub.
 */
export function findDuplicateGroups(
  rows: readonly RawTeamMappingRow[],
  resolvedClubIdsByTeamId: ReadonlyMap<number, number>,
): DuplicateGroup[] {
  const groups = new Map<number, RawTeamMappingRow[]>();
  for (const row of rows) {
    const providerClubId = resolvedClubIdsByTeamId.get(row.providerTeamId);
    if (providerClubId === undefined) continue;
    const list = groups.get(providerClubId);
    if (list) {
      list.push(row);
    } else {
      groups.set(providerClubId, [row]);
    }
  }

  const duplicates: DuplicateGroup[] = [];
  for (const [providerClubId, groupRows] of groups) {
    const distinctClubIds = [...new Set(groupRows.map((r) => r.externalClubId))].sort();
    if (distinctClubIds.length > 1) {
      duplicates.push({
        providerClubId,
        distinctClubIds,
        teamCount: groupRows.length,
        providerTeamIds: groupRows.map((r) => r.providerTeamId).sort((a, b) => a - b),
      });
    }
  }

  return duplicates.sort((a, b) => a.providerClubId - b.providerClubId);
}

/**
 * Builds the exact merge plan for one duplicate group, reusing the SAME
 * pure decision functions the real (mutating) service uses — see module
 * doc header. Read-only: takes already-loaded club rows, decides nothing
 * by itself beyond what those shared functions decide.
 */
export function buildGroupPlan(
  group: DuplicateGroup,
  clubRows: readonly { id: string; logoUrl: string | null; createdAt: Date; archivedAt: Date | null }[],
  preferredClubId: string | null,
): GroupPlan {
  const canonicalClubId = chooseCanonicalClubId(clubRows, preferredClubId);
  const canonicalClub = clubRows.find((c) => c.id === canonicalClubId)!;
  const losingClubs = clubRows.filter((c) => c.id !== canonicalClubId);
  const donor = chooseLogoDonor(canonicalClub, losingClubs);

  return {
    providerClubId: group.providerClubId,
    canonicalClubId,
    clubsToArchive: losingClubs.map((c) => c.id),
    teamsToMove: group.teamCount - group.distinctClubIds.filter((id) => id === canonicalClubId).length,
    logoAdoptedFromClubId: donor?.donorClubId ?? null,
  };
}

// ---------------------------------------------------------------------------
// Environment helpers (shared conventions with prior scripts)
// ---------------------------------------------------------------------------

export function detectEnvironment(url: string | undefined): string {
  if (!url) return "UNKNOWN";
  const l = url.toLowerCase();
  if (l.includes("prod")) return "PROD";
  if (l.includes("stage")) return "STAGE";
  if (l.includes("localhost") || l.includes("127.0.0.1")) return "LOCAL";
  return "EXTERNAL";
}

export function maskUrl(url: string | undefined): string {
  if (!url) return "(not set)";
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.username || "(no user)"}:***@${parsed.hostname}${parsed.pathname}`;
  } catch {
    return url.replace(/:[^@/]*@/, ":***@");
  }
}

export function createPrismaClient(connectionString: string): { prisma: PrismaClient; pool: Pool } {
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  return { prisma, pool };
}

/** See scripts/team-sfv-mapping-01-fca-reconciliation.ts for why this exists
 * instead of a raw `new URL(...)` comparison (Windows path handling). */
export function isCliEntrypoint(
  argv1: string | undefined,
  moduleUrl: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (!argv1) return false;
  try {
    return pathToFileURL(argv1, { windows: platform === "win32" }).href === moduleUrl;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Tenant discovery + data loading
// ---------------------------------------------------------------------------

export async function resolveTenantContexts(
  prisma: PrismaClient,
  tenantKeyFilter?: string,
): Promise<TenantSfvContext[]> {
  const configs = await prisma.tenantSfvConfig.findMany({
    where: {
      enabled: true,
      ...(tenantKeyFilter ? { tenant: { key: tenantKeyFilter } } : {}),
    },
    select: {
      tenantId: true,
      clubId: true,
      defaultSeasonId: true,
      organisationId: true,
      tenant: { select: { key: true } },
    },
  });

  return configs.map((c) => ({
    tenantId: c.tenantId,
    tenantKey: c.tenant.key,
    clubId: c.clubId,
    seasonId: c.defaultSeasonId,
    organisationId: c.organisationId,
  }));
}

export async function loadTenantInventory(
  prisma: PrismaClient,
  tenant: TenantSfvContext,
): Promise<TenantInventory> {
  const [ownTeams, rankingEntries] = await Promise.all([
    import("@/lib/integrations/sfv/client").then((m) =>
      m.fetchTeamList({
        SeasonId: tenant.seasonId,
        ClubId: tenant.clubId,
        ...(tenant.organisationId !== null ? { OrganisationId: tenant.organisationId } : {}),
      }),
    ),
    import("@/lib/integrations/sfv/client").then((m) =>
      m.fetchClubRanking({
        SeasonId: tenant.seasonId,
        ClubId: tenant.clubId,
        ...(tenant.organisationId !== null ? { OrganisationId: tenant.organisationId } : {}),
      }),
    ),
  ]);

  const { indexByTeamId } = buildProviderClubIdIndex(ownTeams, rankingEntries);

  const mappingRows = await prisma.externalTeamProviderMapping.findMany({
    where: {
      tenantId: tenant.tenantId,
      provider: PROVIDER,
      providerTeamId: { in: [...indexByTeamId.keys()] },
    },
    select: { providerTeamId: true, externalTeam: { select: { externalClubId: true } } },
  });

  const rows: RawTeamMappingRow[] = mappingRows.map((m) => ({
    providerTeamId: m.providerTeamId,
    externalClubId: m.externalTeam.externalClubId,
  }));

  return {
    tenant,
    resolvedTeamCount: indexByTeamId.size,
    duplicateGroups: findDuplicateGroups(rows, indexByTeamId),
  };
}

export async function buildTenantPlan(prisma: PrismaClient, inventory: TenantInventory): Promise<TenantPlan> {
  const groups: GroupPlan[] = [];

  for (const group of inventory.duplicateGroups) {
    const clubRows = await prisma.externalClub.findMany({
      where: { tenantId: inventory.tenant.tenantId, id: { in: group.distinctClubIds } },
      select: { id: true, logoUrl: true, createdAt: true, archivedAt: true },
    });

    const existingMapping = await prisma.externalClubProviderMapping.findFirst({
      where: { tenantId: inventory.tenant.tenantId, provider: PROVIDER, providerClubId: group.providerClubId },
      select: { externalClubId: true },
    });
    const preferredClubId =
      existingMapping !== null && group.distinctClubIds.includes(existingMapping.externalClubId)
        ? existingMapping.externalClubId
        : null;

    groups.push(buildGroupPlan(group, clubRows, preferredClubId));
  }

  return { tenant: inventory.tenant, groups };
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

export async function buildBackupSnapshot(prisma: PrismaClient, inventories: TenantInventory[]) {
  const snapshot: Record<string, unknown> = { generatedAt: new Date().toISOString(), tenants: [] };
  const tenants: unknown[] = [];

  for (const inv of inventories) {
    if (inv.duplicateGroups.length === 0) continue;
    const clubIds = [...new Set(inv.duplicateGroups.flatMap((g) => g.distinctClubIds))];
    const clubs = await prisma.externalClub.findMany({ where: { id: { in: clubIds } } });
    const teams = await prisma.externalTeam.findMany({ where: { externalClubId: { in: clubIds } } });
    tenants.push({ tenantId: inv.tenant.tenantId, tenantKey: inv.tenant.tenantKey, clubs, teams });
  }

  snapshot.tenants = tenants;
  return snapshot;
}

export function writeBackupToDisk(snapshot: unknown, outDir = ".tmp"): string {
  const dir = path.resolve(process.cwd(), outDir);
  fs.mkdirSync(dir, { recursive: true });
  const filename = `club-directory-02c-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf8");
  return filePath;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliOptions {
  inventory: boolean;
  dryRun: boolean;
  execute: boolean;
  confirm: string | undefined;
  tenant: string | undefined;
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);
  const has = (flag: string) => args.includes(flag);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };
  return {
    inventory: has("--inventory"),
    dryRun: has("--dry-run"),
    execute: has("--execute"),
    confirm: get("--confirm"),
    tenant: get("--tenant"),
  };
}

function printInventory(inventories: TenantInventory[]): void {
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  CLUB-DIRECTORY-02C — Inventory Mode (read-only)");
  console.log("═══════════════════════════════════════════════════════\n");

  for (const inv of inventories) {
    console.log(`  Tenant: ${inv.tenant.tenantKey} (${inv.tenant.tenantId})`);
    console.log(`    Resolved clubNumbers this run : ${inv.resolvedTeamCount} teamIds`);
    console.log(`    Duplicate groups found        : ${inv.duplicateGroups.length}`);
    for (const g of inv.duplicateGroups) {
      console.log(
        `      clubNumber ${g.providerClubId}: ${g.distinctClubIds.length} distinct clubs, ${g.teamCount} teams (providerTeamIds: ${g.providerTeamIds.join(", ")})`,
      );
    }
    console.log("");
  }
}

function printPlans(plans: TenantPlan[]): void {
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  CLUB-DIRECTORY-02C — Dry-Run Mode (zero DB writes)");
  console.log("═══════════════════════════════════════════════════════\n");

  for (const plan of plans) {
    console.log(`  Tenant: ${plan.tenant.tenantKey} (${plan.tenant.tenantId})`);
    for (const g of plan.groups) {
      console.log(
        `    clubNumber ${g.providerClubId}: canonical=${g.canonicalClubId}, archive=[${g.clubsToArchive.join(", ")}], teamsToMove=${g.teamsToMove}, logoAdoptedFrom=${g.logoAdoptedFromClubId ?? "(none)"}`,
      );
    }
    console.log("");
  }
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);

  if (!opts.inventory && !opts.dryRun && !opts.execute) {
    console.error(
      "[club-directory-02c] ERROR: No mode specified. Use --inventory, --dry-run, or --execute.",
    );
    process.exit(1);
  }

  if (opts.execute && opts.confirm !== EXECUTE_CONFIRMATION) {
    console.error(
      `[club-directory-02c] REFUSED: --execute requires --confirm ${EXECUTE_CONFIRMATION}`,
    );
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[club-directory-02c] ERROR: DATABASE_URL is not set.");
    process.exit(1);
  }

  const env = detectEnvironment(connectionString);
  if (opts.execute && env === "PROD") {
    console.error("[club-directory-02c] BLOCKED: DATABASE_URL appears to point to PRODUCTION.");
    process.exit(1);
  }

  console.log(`[club-directory-02c] Database: ${maskUrl(connectionString)}`);
  console.log(`[club-directory-02c] Detected environment: ${env}`);

  const { prisma, pool } = createPrismaClient(connectionString);

  try {
    const tenants = await resolveTenantContexts(prisma, opts.tenant);
    if (tenants.length === 0) {
      console.log(
        `[club-directory-02c] No enabled SFV-configured tenant found${opts.tenant ? ` for --tenant ${opts.tenant}` : ""}.`,
      );
      return;
    }

    const inventories: TenantInventory[] = [];
    for (const tenant of tenants) {
      inventories.push(await loadTenantInventory(prisma, tenant));
    }

    if (opts.inventory) printInventory(inventories);

    if (opts.dryRun) {
      const plans: TenantPlan[] = [];
      for (const inv of inventories) {
        plans.push(await buildTenantPlan(prisma, inv));
      }
      printPlans(plans);
    }

    if (opts.execute) {
      const totalGroups = inventories.reduce((sum, inv) => sum + inv.duplicateGroups.length, 0);
      if (totalGroups === 0) {
        console.log("[club-directory-02c] Nothing to consolidate — no duplicate groups found.");
        return;
      }

      const backupSnapshot = await buildBackupSnapshot(prisma, inventories);
      const backupPath = writeBackupToDisk(backupSnapshot);
      console.log(`[club-directory-02c] Pre-change backup written to: ${backupPath}`);

      const { runSfvClubConsolidationForTenant }: { runSfvClubConsolidationForTenant: RunSfvClubConsolidationForTenant } =
        await import("@/lib/integrations/sfv/sync/club-consolidation");

      let groupsMerged = 0;
      let teamsMoved = 0;
      let clubsArchived = 0;

      for (const inv of inventories) {
        if (inv.duplicateGroups.length === 0) continue;

        const { consolidation } = await runSfvClubConsolidationForTenant(
          inv.tenant.tenantId,
          inv.tenant.clubId,
          inv.tenant.seasonId,
          inv.tenant.organisationId,
        );

        groupsMerged += consolidation.groupsMerged;
        teamsMoved += consolidation.teamsMoved;
        clubsArchived += consolidation.clubsArchived;

        console.log(
          `[club-directory-02c] Tenant ${inv.tenant.tenantKey}: groupsMerged=${consolidation.groupsMerged}, teamsMoved=${consolidation.teamsMoved}, clubsArchived=${consolidation.clubsArchived}`,
        );
      }

      console.log("\n── EXECUTION RESULT ─────────────────────────────────────");
      console.log(`  Groups merged     : ${groupsMerged}`);
      console.log(`  Teams re-parented : ${teamsMoved}`);
      console.log(`  Clubs archived    : ${clubsArchived}`);

      // Postcondition: re-run inventory — every previously-duplicate group
      // must now resolve to exactly one distinct club.
      let allResolved = true;
      for (const tenant of tenants) {
        const after = await loadTenantInventory(prisma, tenant);
        if (after.duplicateGroups.length > 0) {
          allResolved = false;
          console.error(
            `[club-directory-02c] POSTCONDITION FAILED for ${tenant.tenantKey}: ${after.duplicateGroups.length} duplicate group(s) still remain.`,
          );
        }
      }

      if (!allResolved) {
        console.error(
          "[club-directory-02c] Some groups remain unresolved (see above) — review the SFV data for these teams manually. No data was deleted.",
        );
        process.exit(1);
      }

      console.log("\n[club-directory-02c] Consolidation complete. Every reported duplicate group is now canonical.");
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

if (isCliEntrypoint(process.argv[1], import.meta.url)) {
  main().catch((err) => {
    console.error("[club-directory-02c] FATAL:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
