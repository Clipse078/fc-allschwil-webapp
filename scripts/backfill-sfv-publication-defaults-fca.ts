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
 * EXECUTION
 *   DATABASE_URL=<url> npx tsx scripts/backfill-sfv-publication-defaults-fca.ts
 *   DATABASE_URL=<url> npx tsx scripts/backfill-sfv-publication-defaults-fca.ts --dry-run
 *
 * TENANT SCOPING
 *   The FC Allschwil tenant is resolved by key="fc-allschwil".
 *   If no such tenant exists the script exits with a clear error.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const isDryRun = process.argv.includes("--dry-run");

// ── Counters ─────────────────────────────────────────────────────────────────

let totalScanned = 0;
let websiteUpdated = 0;
let infoboardHomeUpdated = 0;
let infoboardAwayUpdated = 0;
let alreadyCorrect = 0;

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (isDryRun) {
    console.log("🔍  DRY RUN — no database writes will be performed.\n");
  } else {
    console.log("✏️   LIVE RUN — database writes are ACTIVE.\n");
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

      if (isDryRun) {
        const changes: string[] = [];
        if (!websiteAlreadyCorrect) {
          changes.push(`websiteVisible: ${event.websiteVisible} → ${targetWebsiteVisible}`);
        }
        if (!infoboardAlreadyCorrect) {
          changes.push(`infoboardVisible: ${event.infoboardVisible} → ${targetInfoboardVisible}`);
        }
        console.log(
          `  [DRY] id=${event.id} homeAway=${event.homeAway ?? "null"} ` +
          `opponent="${event.opponentName ?? "?"}" :: ${changes.join(", ")}`,
        );
      } else {
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
    console.log(`  Total scanned:              ${totalScanned}`);
    console.log(`  Already correct (no-op):    ${alreadyCorrect}`);
    console.log(`  websiteVisible set → true:  ${websiteUpdated}`);
    console.log(`  infoboardVisible set → true (home):  ${infoboardHomeUpdated}`);
    console.log(`  infoboardVisible set → false (away): ${infoboardAwayUpdated}`);
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
