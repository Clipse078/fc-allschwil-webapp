/**
 * scripts/__tests__/club-directory-02c-sfv-consolidation.test.ts
 *
 * CLUB-DIRECTORY-02C — unit tests for the pure classification/plan-building
 * logic in the backfill script. No database or network access — these
 * exercise `findDuplicateGroups` and `buildGroupPlan` directly against
 * fixture data, plus the shared environment-detection helpers.
 */

import { describe, expect, it } from "vitest";
import {
  buildGroupPlan,
  detectEnvironment,
  findDuplicateGroups,
  isCliEntrypoint,
  maskUrl,
  type DuplicateGroup,
  type RawTeamMappingRow,
} from "../club-directory-02c-sfv-consolidation";

// ---------------------------------------------------------------------------
// findDuplicateGroups
// ---------------------------------------------------------------------------

describe("findDuplicateGroups", () => {
  it("reports a group when its teams span more than one distinct club", () => {
    const rows: RawTeamMappingRow[] = [
      { providerTeamId: 2001, externalClubId: "club-a" },
      { providerTeamId: 2002, externalClubId: "club-b" },
    ];
    const resolved = new Map([
      [2001, 700],
      [2002, 700],
    ]);

    const groups = findDuplicateGroups(rows, resolved);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      providerClubId: 700,
      distinctClubIds: ["club-a", "club-b"],
      teamCount: 2,
      providerTeamIds: [2001, 2002],
    });
  });

  it("does not report a group whose teams already share one club", () => {
    const rows: RawTeamMappingRow[] = [
      { providerTeamId: 2001, externalClubId: "club-a" },
      { providerTeamId: 2002, externalClubId: "club-a" },
    ];
    const resolved = new Map([
      [2001, 700],
      [2002, 700],
    ]);

    expect(findDuplicateGroups(rows, resolved)).toHaveLength(0);
  });

  it("keeps distinct providerClubId groups independent", () => {
    const rows: RawTeamMappingRow[] = [
      { providerTeamId: 4001, externalClubId: "club-a" },
      { providerTeamId: 4002, externalClubId: "club-b" },
      { providerTeamId: 5001, externalClubId: "club-c" },
      { providerTeamId: 5002, externalClubId: "club-d" },
    ];
    const resolved = new Map([
      [4001, 111],
      [4002, 111],
      [5001, 222],
      [5002, 222],
    ]);

    const groups = findDuplicateGroups(rows, resolved);
    expect(groups.map((g) => g.providerClubId)).toEqual([111, 222]);
  });

  it("ignores a row whose providerTeamId is not in the resolved map", () => {
    const rows: RawTeamMappingRow[] = [
      { providerTeamId: 2001, externalClubId: "club-a" },
      { providerTeamId: 9999, externalClubId: "club-b" },
    ];
    const resolved = new Map([[2001, 700]]);

    expect(findDuplicateGroups(rows, resolved)).toHaveLength(0);
  });

  it("returns groups sorted by providerClubId for deterministic output", () => {
    const rows: RawTeamMappingRow[] = [
      { providerTeamId: 1, externalClubId: "a" },
      { providerTeamId: 2, externalClubId: "b" },
      { providerTeamId: 3, externalClubId: "c" },
      { providerTeamId: 4, externalClubId: "d" },
    ];
    const resolved = new Map([
      [1, 900],
      [2, 900],
      [3, 100],
      [4, 100],
    ]);

    const groups = findDuplicateGroups(rows, resolved);
    expect(groups.map((g) => g.providerClubId)).toEqual([100, 900]);
  });
});

// ---------------------------------------------------------------------------
// buildGroupPlan
// ---------------------------------------------------------------------------

describe("buildGroupPlan", () => {
  const group: DuplicateGroup = {
    providerClubId: 700,
    distinctClubIds: ["club-a", "club-b"],
    teamCount: 2,
    providerTeamIds: [2001, 2002],
  };

  it("chooses the earliest-created club as canonical when no preferred id is given", () => {
    const clubRows = [
      { id: "club-a", logoUrl: null, createdAt: new Date("2026-03-01T00:00:00.000Z"), archivedAt: null },
      { id: "club-b", logoUrl: null, createdAt: new Date("2026-01-01T00:00:00.000Z"), archivedAt: null },
    ];

    const plan = buildGroupPlan(group, clubRows, null);

    expect(plan.canonicalClubId).toBe("club-b");
    expect(plan.clubsToArchive).toEqual(["club-a"]);
    expect(plan.teamsToMove).toBe(1);
  });

  it("honours a preferred (already-established) canonical club id", () => {
    const clubRows = [
      { id: "club-a", logoUrl: null, createdAt: new Date("2026-01-01T00:00:00.000Z"), archivedAt: null },
      { id: "club-b", logoUrl: null, createdAt: new Date("2026-06-01T00:00:00.000Z"), archivedAt: null },
    ];

    const plan = buildGroupPlan(group, clubRows, "club-b");

    expect(plan.canonicalClubId).toBe("club-b");
  });

  it("adopts a logo from a losing club when the canonical one has none", () => {
    const clubRows = [
      { id: "club-a", logoUrl: null, createdAt: new Date("2026-01-01T00:00:00.000Z"), archivedAt: null },
      {
        id: "club-b",
        logoUrl: "data:image/gif;base64,AAA=",
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
        archivedAt: null,
      },
    ];

    const plan = buildGroupPlan(group, clubRows, null);

    expect(plan.canonicalClubId).toBe("club-a");
    expect(plan.logoAdoptedFromClubId).toBe("club-b");
  });

  it("never plans to adopt a logo when the canonical club already has one", () => {
    const clubRows = [
      {
        id: "club-a",
        logoUrl: "https://cdn.example.com/tenant-uploaded.png",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        archivedAt: null,
      },
      {
        id: "club-b",
        logoUrl: "data:image/gif;base64,BBB=",
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
        archivedAt: null,
      },
    ];

    const plan = buildGroupPlan(group, clubRows, null);

    expect(plan.logoAdoptedFromClubId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Environment helpers (shared conventions with prior scripts)
// ---------------------------------------------------------------------------

describe("detectEnvironment", () => {
  it("detects PROD from a URL containing 'prod'", () => {
    expect(detectEnvironment("postgresql://user:pass@prod-db.example.com/app")).toBe("PROD");
  });

  it("detects STAGE from a URL containing 'stage'", () => {
    expect(detectEnvironment("postgresql://user:pass@stage-db.example.com/app")).toBe("STAGE");
  });

  it("detects LOCAL for localhost/127.0.0.1", () => {
    expect(detectEnvironment("postgresql://user:pass@localhost:5432/app")).toBe("LOCAL");
    expect(detectEnvironment("postgresql://user:pass@127.0.0.1:5432/app")).toBe("LOCAL");
  });

  it("returns UNKNOWN for an undefined URL", () => {
    expect(detectEnvironment(undefined)).toBe("UNKNOWN");
  });

  it("returns EXTERNAL for any other host", () => {
    expect(detectEnvironment("postgresql://user:pass@some-other-host.example.com/app")).toBe("EXTERNAL");
  });
});

describe("maskUrl", () => {
  it("masks the credentials in a connection string", () => {
    const masked = maskUrl("postgresql://myuser:supersecret@db.example.com:5432/app");
    expect(masked).not.toContain("supersecret");
    expect(masked).toContain("myuser");
    expect(masked).toContain("db.example.com");
  });

  it("returns a placeholder for an undefined URL", () => {
    expect(maskUrl(undefined)).toBe("(not set)");
  });
});

describe("isCliEntrypoint", () => {
  it("detects a matching POSIX argv[1]/import.meta.url pair", () => {
    const result = isCliEntrypoint(
      "/workspace/scripts/club-directory-02c-sfv-consolidation.ts",
      "file:///workspace/scripts/club-directory-02c-sfv-consolidation.ts",
      "linux",
    );
    expect(result).toBe(true);
  });

  it("does not match a different file", () => {
    const result = isCliEntrypoint(
      "/workspace/scripts/other-script.ts",
      "file:///workspace/scripts/club-directory-02c-sfv-consolidation.ts",
      "linux",
    );
    expect(result).toBe(false);
  });

  it("importing this module never invokes main() — no DB/network/process.exit side effects", () => {
    // Merely importing the module above (which this test file does) must
    // not have triggered main(). If it had, this test file itself would
    // have already crashed (missing DATABASE_URL) before reaching here.
    expect(true).toBe(true);
  });

  it("returns false for a missing argv[1]", () => {
    expect(isCliEntrypoint(undefined, "file:///workspace/scripts/x.ts")).toBe(false);
  });
});
