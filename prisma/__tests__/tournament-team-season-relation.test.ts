import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const schema = fs.readFileSync(
  path.join(process.cwd(), "prisma", "schema.prisma"),
  "utf8",
);
const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260830090000_tournament_team_season_relation",
    "migration.sql",
  ),
  "utf8",
);

describe("canonical Tournament Event ↔ TeamSeason schema", () => {
  it("keeps the relation nullable and defines both relation sides", () => {
    expect(schema).toContain("teamSeasonId String?");
    expect(schema).toContain(
      'teamSeason           TeamSeason?           @relation("TournamentTeamSeason", fields: [teamSeasonId], references: [id], onDelete: SetNull, onUpdate: Cascade)',
    );
    expect(schema).toContain(
      'tournamentEvents        Event[]                 @relation("TournamentTeamSeason")',
    );
  });

  it("retains formal TeamSeason team+season uniqueness", () => {
    expect(schema).toContain("@@unique([teamId, seasonId])");
  });

  it("defines the tenant-safe upcoming lookup index", () => {
    expect(schema).toContain(
      "@@index([tenantId, teamSeasonId, type, startAt])",
    );
    expect(migration).toContain(
      'CREATE INDEX "Event_tenantId_teamSeasonId_type_startAt_idx"',
    );
  });

  it("uses SetNull/Cascade FK behavior", () => {
    expect(migration).toMatch(
      /FOREIGN KEY \("teamSeasonId"\) REFERENCES "TeamSeason"\("id"\)\s+ON DELETE SET NULL ON UPDATE CASCADE/,
    );
  });
});

describe("canonical Tournament Event ↔ TeamSeason backfill", () => {
  it("matches the exact legacy team and season pair", () => {
    expect(migration).toContain('ts."teamId" = e."teamId"');
    expect(migration).toContain('ts."seasonId" = e."seasonId"');
  });

  it("backfills only exactly one candidate and never guesses ambiguity", () => {
    expect(migration).toContain('HAVING COUNT(ts."id") = 1');
    expect(migration).toContain(
      'SET "teamSeasonId" = candidate."teamSeasonId"',
    );
  });

  it("leaves missing or unresolved mappings NULL", () => {
    expect(migration).toContain('e."teamSeasonId" IS NULL');
    expect(migration).toContain('e."teamId" IS NOT NULL');
    expect(migration).toContain('e."seasonId" IS NOT NULL');
    expect(migration).toContain('e."tenantId" IS NOT NULL');
    expect(migration).not.toMatch(
      /SET\s+"teamSeasonId"\s*=\s*(?!candidate\."teamSeasonId")/i,
    );
  });

  it("never backfills non-tournament Events", () => {
    expect(migration).toContain(`e."type" = 'TOURNAMENT'`);
  });

  it("rejects cross-tenant legacy mappings in SQL", () => {
    expect(migration).toContain('t."id" = ts."teamId"');
    expect(migration).toContain('t."tenantId" = e."tenantId"');
  });
});
