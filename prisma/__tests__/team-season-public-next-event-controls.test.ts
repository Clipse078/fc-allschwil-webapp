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
    "20260830100000_team_season_public_next_event_controls",
    "migration.sql",
  ),
  "utf8",
);
const foundationMigration = fs.readFileSync(
  path.join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260830090000_tournament_team_season_relation",
    "migration.sql",
  ),
  "utf8",
);

describe("TeamSeason public next-event controls", () => {
  it("defaults existing and new TeamSeasons to match on and tournament off", () => {
    expect(schema).toMatch(/showNextMatch\s+Boolean\s+@default\(true\)/);
    expect(schema).toMatch(/showNextTournament\s+Boolean\s+@default\(false\)/);
    expect(migration).toContain(
      'ADD COLUMN "showNextMatch" BOOLEAN NOT NULL DEFAULT true',
    );
    expect(migration).toContain(
      'ADD COLUMN "showNextTournament" BOOLEAN NOT NULL DEFAULT false',
    );
  });

  it("is a second additive migration with no destructive SQL", () => {
    expect(migration).toMatch(/^-- TEAM-PUBLIC-NEXT-EVENT-01B/m);
    expect(migration).not.toMatch(/\b(DROP|DELETE|TRUNCATE|UPDATE)\b/i);
    expect(migration.match(/ADD COLUMN/g)).toHaveLength(2);
  });

  it("keeps the accepted 01A migration separate", () => {
    expect(foundationMigration).toContain(
      'ALTER TABLE "Event" ADD COLUMN "teamSeasonId" TEXT;',
    );
    expect(foundationMigration).not.toContain("showNextMatch");
    expect(foundationMigration).not.toContain("showNextTournament");
  });

  it("contains no category, name, slug, or tenant-specific inference", () => {
    expect(migration).not.toMatch(/F2|Kinderfussball|category|slug|Allschwil/i);
  });
});
