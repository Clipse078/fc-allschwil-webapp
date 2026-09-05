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
    "20260830180000_team_season_multi_channel_publication",
    "migration.sql",
  ),
  "utf8",
);
const executableSql = migration.replace(/^--.*$/gm, "");

describe("TeamSeason canonical multi-channel publication migration", () => {
  it("defines the exact channel and content concepts without TEAM_PAGE", () => {
    const channelEnum =
      schema.match(/enum TeamPublicationChannel \{[\s\S]*?\}/)?.[0] ?? "";
    const contentEnum =
      schema.match(/enum TeamPublicationContent \{[\s\S]*?\}/)?.[0] ?? "";

    expect(channelEnum).toMatch(
      /WEBSITE\s+MOBILE_APP\s+INFOBOARD/,
    );
    expect(contentEnum).toMatch(
      /TRAINING_TIMES\s+NEXT_MATCH\s+NEXT_TOURNAMENT\s+TRAINER_TEAM\s+SQUAD\s+TEAM_PHOTO\s+STANDINGS/,
    );
    expect(contentEnum).not.toMatch(/\bTEAM_PAGE\b/);
  });

  it("creates season-scoped unique channel and content settings", () => {
    expect(schema).toMatch(
      /model TeamSeasonPublicationChannel[\s\S]*@@unique\(\[teamSeasonId, channel\]\)/,
    );
    expect(schema).toMatch(
      /model TeamSeasonPublicationContent[\s\S]*@@unique\(\[teamSeasonId, channel, content\]\)/,
    );
    expect(schema).toContain(
      "publicationChannels     TeamSeasonPublicationChannel[]",
    );
    expect(schema).toContain(
      "publicationContents     TeamSeasonPublicationContent[]",
    );
  });

  it("is additive and preserves every legacy visibility field", () => {
    expect(executableSql).not.toMatch(
      /(?:^|;)\s*(?:DROP|DELETE|TRUNCATE)\b/im,
    );
    for (const field of [
      "websiteVisible",
      "infoboardVisible",
      "squadWebsiteVisible",
      "trainerTeamWebsiteVisible",
      "showNextMatch",
      "showNextTournament",
    ]) {
      expect(schema).toContain(field);
    }
  });

  it("backfills Website and Infoboard masters from Team AND TeamSeason", () => {
    expect(migration).toContain(
      '(t."websiteVisible" AND ts."websiteVisible")',
    );
    expect(migration).toContain(
      '(t."infoboardVisible" AND ts."infoboardVisible")',
    );
    expect(migration).toContain(
      "'MOBILE_APP'::\"TeamPublicationChannel\",\n    false",
    );
  });

  it("backfills the exact Website legacy mappings and compatibility defaults", () => {
    expect(migration).toContain(
      "('TRAINING_TIMES'::\"TeamPublicationContent\", true)",
    );
    expect(migration).toContain(
      "('NEXT_MATCH'::\"TeamPublicationContent\", ts.\"showNextMatch\")",
    );
    expect(migration).toContain(
      "('NEXT_TOURNAMENT'::\"TeamPublicationContent\", ts.\"showNextTournament\")",
    );
    expect(migration).toContain(
      "('TRAINER_TEAM'::\"TeamPublicationContent\", ts.\"trainerTeamWebsiteVisible\")",
    );
    expect(migration).toContain(
      "('SQUAD'::\"TeamPublicationContent\", ts.\"squadWebsiteVisible\")",
    );
    expect(migration).toContain(
      "('TEAM_PHOTO'::\"TeamPublicationContent\", false)",
    );
    expect(migration).toContain(
      "('STANDINGS'::\"TeamPublicationContent\", true)",
    );
  });

  it("makes data backfills conflict-safe and creates no Infoboard content rows", () => {
    expect(executableSql.match(/ON CONFLICT/g)).toHaveLength(4);
    expect(
      migration.match(/INSERT INTO "TeamSeasonPublicationContent"/g),
    ).toHaveLength(1);
    const contentBackfill =
      migration.split(
        'INSERT INTO "TeamSeasonPublicationContent"',
      )[1] ?? "";
    expect(contentBackfill).toContain(
      "'WEBSITE'::\"TeamPublicationChannel\"",
    );
    expect(contentBackfill).not.toContain(
      "'INFOBOARD'::\"TeamPublicationChannel\"",
    );
  });
});
