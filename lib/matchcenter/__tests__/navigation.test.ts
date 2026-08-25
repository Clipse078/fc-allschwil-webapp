import { describe, expect, it } from "vitest";
import {
  buildMatchcenterHref,
  normalizeMatchcenterTeamFilter,
  toMatchcenterTeamOptions,
} from "../navigation";

describe("normalizeMatchcenterTeamFilter", () => {
  const validIds = new Set(["team-a", "team-b"]);

  it("returns null for empty or missing values", () => {
    expect(normalizeMatchcenterTeamFilter(undefined, validIds)).toBeNull();
    expect(normalizeMatchcenterTeamFilter("", validIds)).toBeNull();
    expect(normalizeMatchcenterTeamFilter("   ", validIds)).toBeNull();
  });

  it("returns the team id when it belongs to the tenant", () => {
    expect(normalizeMatchcenterTeamFilter("team-a", validIds)).toBe("team-a");
  });

  it("ignores unknown team ids safely", () => {
    expect(normalizeMatchcenterTeamFilter("team-other-tenant", validIds)).toBeNull();
    expect(normalizeMatchcenterTeamFilter("not-a-real-id", validIds)).toBeNull();
  });
});

describe("buildMatchcenterHref", () => {
  it("includes team in the query when set", () => {
    const href = buildMatchcenterHref("/dashboard/matchcenter", {
      tab: "SPIELPLANUNG",
      month: "2026-09",
      actionFilter: "ALLE",
      wochenplanFilter: "ALLE",
      teamFilter: "team-a",
    });

    expect(href).toContain("team=team-a");
    expect(href).toContain("tab=spielplanung");
    expect(href).toContain("month=2026-09");
  });

  it("omits team from the query when Alle Teams is selected", () => {
    const href = buildMatchcenterHref("/dashboard/matchcenter", {
      tab: "RESULTATE",
      month: "2026-09",
      actionFilter: "ALLE",
      wochenplanFilter: "ALLE",
      teamFilter: null,
    });

    expect(href).not.toContain("team=");
    expect(href).toContain("tab=resultate");
  });

  it("preserves team when switching tabs via shared params", () => {
    const href = buildMatchcenterHref("/dashboard/matchcenter", {
      tab: "RESULTATE",
      month: "2026-08",
      actionFilter: "OFFEN",
      wochenplanFilter: "IM_WOCHENPLAN",
      teamFilter: "team-b",
    });

    expect(href).toContain("team=team-b");
    expect(href).toContain("month=2026-08");
    expect(href).toContain("wochenplan=im_wochenplan");
    expect(href).not.toContain("filter=");
  });
});

describe("toMatchcenterTeamOptions", () => {
  it("maps canonical compact names without hardcoded team lists", () => {
    const options = toMatchcenterTeamOptions([
      { id: "team-1", compactName: "Junioren C1" },
      { id: "team-2", compactName: "Frauen 1" },
    ]);

    expect(options).toEqual([
      { id: "team-1", label: "Junioren C1" },
      { id: "team-2", label: "Frauen 1" },
    ]);
  });
});
