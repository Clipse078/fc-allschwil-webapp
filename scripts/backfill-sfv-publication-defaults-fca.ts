/**
 * scripts/backfill-sfv-publication-defaults-fca.ts
 *
 * PUB-02 — Controlled, tenant-scoped backfill for FC Allschwil.
 *
 * PURPOSE
 *   Sets publication defaults on existing SFV-imported MATCH events for the
 *   FC Allschwil tenant that were created before PUB-02 defaults were applied.
 *
 * POLICY APPLIED
 *   websiteVisible  = true   (all SFV-imported matches)
 *   infoboardVisible = true  (home matches only: homeAway = "HOME")
 *   infoboardVisible = false (away matches only: homeAway = "AWAY")
 *
 * SAFETY INVARIANTS
 *   - Only touches Events where: source=SFV AND type=MATCH AND tenantId=<FCA tenant>.
 *   - Never modifies: pitchCode, homeDressingRoomCode, awayDressingRoomCode,
 *     remarks, meetingTime, title, teamId, resultLabel, startAt, status,
 *     wochenplanVisible, trainingsplanVisible, teamPageVisible, homepageVisible.
 *   - Idempotent: safe to run multiple times.
 *   - No cross-tenant mutation.
 *   - Dry-run mode available via --dry-run flag.
 *
 * MANUAL-OVERRIDE PROTECTION
 *   Records that appear to have been deliberately edited (i.e. they are not
 *   at the old-default state) are flagged in dry-run output and SKIPPED in
 *   live mode unless --force-overrides is also passed.
 *
 *   Criteria for "appears manually edited" (potential override):
 *     - Away match with infoboardVisible=true  (old default was false)
 *
 *   Default behaviour (no --force-overrides):
 *     - Updates websiteVisible=false → true for all qualifying matches
 *     - Updates home matches with infoboardVisible=false → true
 *     - SKIPS any record that is "potentially manually edited"
 *
 *   With --force-overrides:
 *     - Overrides ALL records to target values regardless of current state
 *     - Logs every overridden "potential manual edit" as a WARNING
 *
 * EXECUTION
 *   DATABASE_URL=<url> npx tsx scripts/backfill-sfv-publication-defaults-fca.ts [--dry-run] [--force-overrides]
 *
 * TENANT SCOPING
 *   The FC Allschwil tenant is resolved by key="fc-allschwil".
 *   If no such tenant exists the script exits with a clear error.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { assertOperationalMutationAllowed } from "@/lib/server/operational-database-guard";

const isDryRun = process.argv.includes("--dry-run");
const forceOverrides = process.argv.includes("--force-overrides");

// ── Counters ─────────────────────────────────────────────────────────────────

let totalScanned = 0;
let websiteUpdated = 0;
let infoboardHomeUpdated = 0;
let infoboardAwayUpdated = 0;
let alreadyCorrect = 0;
let potentialManualEdits = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Determines whether a record appears to have been manually edited
 * rather than sitting at old SFV-import defaults (websiteVisible=false,
 * infoboardVisible=false).
 *
 * Conservative: only flags the most unambiguous manual-override pattern —
 * an away match that has infoboardVisible=true (which deviates from both the
 * old default of false and the new target default of false).
 */
function looksManuallyEdited(
  homeAway: string | null,
  _websiteVisible: boolean,
  infoboardVisible: boolean,
): boolean {
  const normalized = homeAway?.trim().toUpperCase() ?? null;
  // Away match with infoboard enabled: old default was false — likely intentional manual choice
  if (normalized === "AWAY" && infoboardVisible === true) return true;
  return false;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (isDryRun) {
    console.log("🔍  DRY RUN — no database writes will be performed.\n");
  } else {
    console.log("✏️   LIVE RUN — database writes are ACTIVE.\n");
  }

  if (forceOverrides) {
    console.log("⚠️   --force-overrides: potential manual edits WILL be overwritten.\n");
  } else {
    console.log(
      "🛡️   Safety mode: potential manual edits will be SKIPPED.\n" +
      "    Use --force-overrides to include them.\n",
    );
  }

  if (!isDryRun) {
    assertOperationalMutationAllowed({
      operationId: "backfill-sfv-publication-defaults-fca",
      databaseUrl: process.env.DATABASE_URL,
      explicitIntent: true,
      allowedRemoteEnvironments: ["stage"],
    });
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // ── 1. Resolve FC Allschwil tenant ────────────────────────────────────────
    const tenant = await prisma.tenant.findUnique({
      where: { key: "fc-allschwil" },
      select: { id: true, key: true, name: true },
    });

    if (!tenant) {
      console.error(
        "❌  Tenant with key=\"fc-allschwil\" not found. " +
        "Verify the tenant exists and re-run.",
      );
      process.exit(1);
    }

    console.log(`✅  Tenant resolved: ${tenant.name} (id=${tenant.id})\n`);

    // ── 2. Load all SFV MATCH events for this tenant ──────────────────────────
    const events = await prisma.event.findMany({
      where: {
        tenantId: tenant.id,
        source: "SFV",
        type: "MATCH",
      },
      select: {
        id: true,
        homeAway: true,
        websiteVisible: true,
        infoboardVisible: true,
        // Read-only audit fields for reporting only:
        startAt: true,
        status: true,
        opponentName: true,
      },
      orderBy: [{ startAt: "asc" }],
    });

    totalScanned = events.length;
    console.log(`📊  Found ${totalScanned} SFV MATCH events for tenant "${tenant.key}"\n`);

    if (totalScanned === 0) {
      console.log("ℹ️   Nothing to backfill.");
      return;
    }

    // ── 3. Process each event ─────────────────────────────────────────────────
    for (const event of events) {
      const normalizedHomeAway = event.homeAway?.trim().toUpperCase() ?? null;
      const isHome = normalizedHomeAway === "HOME";
      const targetWebsiteVisible = true;
      const targetInfoboardVisible = isHome; // true for home, false for away

      const websiteAlreadyCorrect = event.websiteVisible === targetWebsiteVisible;
      const infoboardAlreadyCorrect = event.infoboardVisible === targetInfoboardVisible;

      if (websiteAlreadyCorrect && infoboardAlreadyCorrect) {
        alreadyCorrect++;
        continue;
      }

      // Check for potential manual override
      const manualEdit = looksManuallyEdited(
        event.homeAway,
        event.websiteVisible,
        event.infoboardVisible,
      );

      if (manualEdit && !forceOverrides) {
        potentialManualEdits++;
        console.log(
          `  [SKIP] id=${event.id} homeAway=${event.homeAway ?? "null"} ` +
          `opponent="${event.opponentName ?? "?"}" ` +
          `websiteVisible=${event.websiteVisible} infoboardVisible=${event.infoboardVisible} ` +
          `— looks like a manual edit, SKIPPED (use --force-overrides to include)`,
        );
        continue;
      }

      const changes: string[] = [];
      if (!websiteAlreadyCorrect) {
        changes.push(`websiteVisible: ${event.websiteVisible} → ${targetWebsiteVisible}`);
      }
      if (!infoboardAlreadyCorrect) {
        changes.push(`infoboardVisible: ${event.infoboardVisible} → ${targetInfoboardVisible}`);
      }

      const prefix = isDryRun ? "[DRY]" : manualEdit ? "[FORCE]" : "[UPDATE]";
      console.log(
        `  ${prefix} id=${event.id} homeAway=${event.homeAway ?? "null"} ` +
        `opponent="${event.opponentName ?? "?"}" :: ${changes.join(", ")}`,
      );

      if (!isDryRun) {
        await prisma.event.update({
          where: { id: event.id },
          data: {
            websiteVisible: targetWebsiteVisible,
            infoboardVisible: targetInfoboardVisible,
          },
        });
      }

      if (!websiteAlreadyCorrect) websiteUpdated++;
      if (!infoboardAlreadyCorrect) {
        if (isHome) infoboardHomeUpdated++;
        else infoboardAwayUpdated++;
      }
    }

    // ── 4. Summary ────────────────────────────────────────────────────────────
    console.log("\n── Backfill Summary ─────────────────────────────────────────");
    console.log(`  Total scanned:                         ${totalScanned}`);
    console.log(`  Already correct (no-op):               ${alreadyCorrect}`);
    console.log(`  Potential manual edits (skipped):      ${potentialManualEdits}`);
    console.log(`  websiteVisible set → true:             ${websiteUpdated}`);
    console.log(`  infoboardVisible set → true  (home):  ${infoboardHomeUpdated}`);
    console.log(`  infoboardVisible set → false (away):  ${infoboardAwayUpdated}`);
    if (potentialManualEdits > 0) {
      console.log(
        `\n  ⚠️  ${potentialManualEdits} record(s) skipped as potential manual edits.` +
        `\n      Review the [SKIP] lines above, then re-run with --force-overrides if appropriate.`,
      );
    }
    if (isDryRun) {
      console.log("\n  ⚠️  DRY RUN — no changes written to database.");
    } else {
      console.log("\n  ✅  Backfill complete.");
    }
    console.log("────────────────────────────────────────────────────────────\n");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
