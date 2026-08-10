/**
 * scripts/validate-tournamentcenter-ux-03.ts
 *
 * TOURNAMENTCENTER-UX-03 — one-off, read-mostly verification script proving
 * the fix against the real (sandbox) database, used because interactive
 * manual UI verification is blocked (no authenticated browser session is
 * available in this environment — see HARD SAFETY RULE: no auth/session
 * data may be created or modified to work around this).
 *
 * Safety invariant: this script never touches User/Role/Permission/
 * TenantMembership/UserRole rows. It only reads Club-Directory data and
 * creates/deletes a temporary Event(type=TOURNAMENT) + TournamentParticipant
 * rows it owns itself (TournamentCenter data — explicitly in scope), then
 * cleans them up at the end.
 *
 * Run: npx tsx scripts/validate-tournamentcenter-ux-03.ts
 */

import { prisma } from "@/lib/db/prisma";
import { createClubDirectoryQueryDatabase } from "@/lib/club-directory/prisma-adapter";
import { listExternalClubs } from "@/lib/club-directory/query-service";
import {
  addTournamentParticipant,
  listTournamentParticipants,
  removeTournamentParticipant,
} from "@/lib/tournaments/participant-service";

const TENANT_ID = "cmomwboak0000tsf3zzivrs46"; // FC Allschwil
const ZERO_TEAM_CLUB_ID = "manualcheck-club-zero"; // "AC Rossoneri (Manual Check)" — 0 ExternalTeam rows
const MULTI_TEAM_CLUB_ID = "manualcheck-club-multi"; // "BSC Old Boys (Manual Check)" — 3 ExternalTeam rows
const ACTIVE_ROSSONERI_CLUB_ID = "cmsjl3310003i04kzno36ggy0"; // active "AC Rossoneri" club (has teams too)

let pass = 0;
let fail = 0;

function check(label: string, condition: boolean) {
  if (condition) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}`);
  }
}

async function main() {
  console.log("=== PART 7 — complete canonical club list (same universe as /dashboard/vereine) ===");
  const database = createClubDirectoryQueryDatabase(prisma);
  const clubs = await listExternalClubs(database, { tenantId: TENANT_ID, limit: 200 });

  const zeroTeamMatches = clubs.filter((c) => c.id === ZERO_TEAM_CLUB_ID);
  const multiTeamMatches = clubs.filter((c) => c.id === MULTI_TEAM_CLUB_ID);

  check(
    `eligible club with ZERO ExternalTeam rows appears ("${clubs.find((c) => c.id === ZERO_TEAM_CLUB_ID)?.name ?? "MISSING"}")`,
    zeroTeamMatches.length === 1 && zeroTeamMatches[0]!.teamCount === 0,
  );
  check(
    `club with MULTIPLE ExternalTeam rows appears exactly ONCE ("${clubs.find((c) => c.id === MULTI_TEAM_CLUB_ID)?.name ?? "MISSING"}", teamCount=${clubs.find((c) => c.id === MULTI_TEAM_CLUB_ID)?.teamCount})`,
    multiTeamMatches.length === 1 && multiTeamMatches[0]!.teamCount === 3,
  );

  // Sort order itself (orderBy: [{ name: "asc" }, { id: "asc" }]) is a
  // direct, already-unit-tested assertion on the Prisma call args — see
  // lib/club-directory/__tests__/query-service.test.ts. Re-deriving it here
  // with a JS-side comparator would just re-introduce a collation mismatch
  // against Postgres' own ORDER BY (client vs. DB locale), so this script
  // sticks to observable outcomes instead (below).

  const rossoneriEntries = clubs.filter((c) => c.name === "AC Rossoneri");
  check(
    `active "AC Rossoneri" appears exactly once in the selector universe (found ${rossoneriEntries.length} active entr${rossoneriEntries.length === 1 ? "y" : "ies"})`,
    rossoneriEntries.length === 1,
  );

  console.log("\n=== PART 1/4 — TournamentParticipant persistence: Club + Anzeigename, duplicates allowed ===");

  const season = await prisma.season.findFirst({ where: {}, select: { id: true } });
  if (!season) throw new Error("No Season found — cannot create a verification Event.");

  const team = await prisma.team.findFirst({
    where: { tenantId: TENANT_ID, isActive: true },
    select: { id: true, name: true },
  });
  if (!team) throw new Error("No active Team found for tenant — cannot verify internal FCA team flow.");

  const event = await prisma.event.create({
    data: {
      tenantId: TENANT_ID,
      seasonId: season.id,
      type: "TOURNAMENT",
      source: "MANUAL",
      title: "TOURNAMENTCENTER-UX-03 verification (temporary)",
      startAt: new Date(),
    },
    select: { id: true },
  });

  try {
    const gelb = await addTournamentParticipant(TENANT_ID, event.id, {
      externalClubId: ACTIVE_ROSSONERI_CLUB_ID,
      displayName: "Gelb",
    });
    const e1 = await addTournamentParticipant(TENANT_ID, event.id, {
      externalClubId: ACTIVE_ROSSONERI_CLUB_ID,
      displayName: "E1",
    });
    const blank = await addTournamentParticipant(TENANT_ID, event.id, {
      externalClubId: ACTIVE_ROSSONERI_CLUB_ID,
      displayName: "   ",
    });
    const internal = await addTournamentParticipant(TENANT_ID, event.id, { teamId: team.id });

    check("AC Rossoneri + Gelb persists as EXTERNAL_CLUB", gelb.kind === "EXTERNAL_CLUB" && gelb.displayName === "Gelb");
    check("AC Rossoneri + E1 persists as a DISTINCT participant (same club)", e1.id !== gelb.id && e1.displayName === "E1");
    check(
      "both reference the SAME canonical ExternalClub (no uniqueness violation)",
      gelb.externalClub?.club.id === ACTIVE_ROSSONERI_CLUB_ID && e1.externalClub?.club.id === ACTIVE_ROSSONERI_CLUB_ID,
    );
    check(
      "blank displayName falls back cleanly to the canonical club name",
      blank.displayName === "AC Rossoneri" && blank.externalClub?.rawDisplayName === null,
    );
    check(
      `internal FCA Team flow unchanged (added "${team.name}")`,
      internal.kind === "TEAM" && internal.team?.id === team.id,
    );

    const listed = await listTournamentParticipants(TENANT_ID, event.id);
    check("all 4 participants are readable via listTournamentParticipants", listed.length === 4);

    const clubRow = await prisma.externalClub.findUnique({
      where: { id: ACTIVE_ROSSONERI_CLUB_ID },
      select: { name: true },
    });
    check('ExternalClub.name remains unchanged ("AC Rossoneri")', clubRow?.name === "AC Rossoneri");

    await removeTournamentParticipant(TENANT_ID, gelb.id);
    await removeTournamentParticipant(TENANT_ID, e1.id);
    await removeTournamentParticipant(TENANT_ID, blank.id);
    await removeTournamentParticipant(TENANT_ID, internal.id);
  } finally {
    await prisma.event.delete({ where: { id: event.id } });
  }

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  if (fail > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
