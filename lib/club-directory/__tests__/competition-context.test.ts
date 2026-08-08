/**
 * lib/club-directory/__tests__/competition-context.test.ts
 *
 * CLUB-DIRECTORY-04 — External Team Competition Context.
 *
 * Unit tests for the pure, provider-agnostic resolver/formatter that turns
 * an ExternalTeam's provider mapping(s) into the secondary "sporting
 * context" line shown next to its canonical name.
 */

import { describe, expect, it } from "vitest";

import {
  resolveExternalTeamCompetitionContext,
  formatExternalTeamCompetitionContext,
} from "../competition-context";

function mapping(overrides: {
  providerLeagueName?: string | null;
  providerGroupName?: string | null;
  lastSyncedAt?: Date | null;
}) {
  return {
    providerLeagueName: overrides.providerLeagueName ?? null,
    providerGroupName: overrides.providerGroupName ?? null,
    lastSyncedAt: overrides.lastSyncedAt ?? null,
  };
}

describe("resolveExternalTeamCompetitionContext", () => {
  it("resolves league and group from a single provider mapping", () => {
    const context = resolveExternalTeamCompetitionContext([
      mapping({ providerLeagueName: "3. Liga", providerGroupName: "Gruppe 1" }),
    ]);

    expect(context).toEqual({ leagueName: "3. Liga", groupName: "Gruppe 1" });
  });

  it("returns an all-null context when there are no provider mappings at all", () => {
    expect(resolveExternalTeamCompetitionContext([])).toEqual({
      leagueName: null,
      groupName: null,
    });
  });

  it("returns an all-null context when the only mapping has no real sporting context yet", () => {
    const context = resolveExternalTeamCompetitionContext([mapping({})]);
    expect(context).toEqual({ leagueName: null, groupName: null });
  });

  it("never mixes league/group from two different mapping rows — picks the freshest single row", () => {
    const context = resolveExternalTeamCompetitionContext([
      mapping({
        providerLeagueName: "2. Liga",
        providerGroupName: null,
        lastSyncedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      mapping({
        providerLeagueName: "3. Liga",
        providerGroupName: "Gruppe 1",
        lastSyncedAt: new Date("2026-06-01T00:00:00.000Z"),
      }),
    ]);

    // The freshest row's OWN pair is used — never "3. Liga" combined with a
    // group name borrowed from the older, stale row.
    expect(context).toEqual({ leagueName: "3. Liga", groupName: "Gruppe 1" });
  });

  it("skips a fresher mapping with no context in favor of an older one that has real context", () => {
    const context = resolveExternalTeamCompetitionContext([
      mapping({
        providerLeagueName: "3. Liga",
        providerGroupName: "Gruppe 1",
        lastSyncedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      mapping({ lastSyncedAt: new Date("2026-06-01T00:00:00.000Z") }),
    ]);

    expect(context).toEqual({ leagueName: "3. Liga", groupName: "Gruppe 1" });
  });

  it("trims whitespace-only provider values to null", () => {
    const context = resolveExternalTeamCompetitionContext([
      mapping({ providerLeagueName: "  ", providerGroupName: "Gruppe 1" }),
    ]);

    expect(context).toEqual({ leagueName: null, groupName: "Gruppe 1" });
  });
});

describe("formatExternalTeamCompetitionContext", () => {
  it('formats "league · group" per the CLUB-DIRECTORY-04 worked example', () => {
    expect(
      formatExternalTeamCompetitionContext({ leagueName: "3. Liga", groupName: "Gruppe 1" }),
    ).toBe("3. Liga · Gruppe 1");
  });

  it("renders league only when the group is unavailable — graceful partial context", () => {
    expect(formatExternalTeamCompetitionContext({ leagueName: "3. Liga", groupName: null })).toBe(
      "3. Liga",
    );
  });

  it("renders group only when the league is unavailable — graceful partial context", () => {
    expect(formatExternalTeamCompetitionContext({ leagueName: null, groupName: "Gruppe 2" })).toBe(
      "Gruppe 2",
    );
  });

  it("returns null (no second line) when no real sporting context is available — never invents a value", () => {
    expect(formatExternalTeamCompetitionContext({ leagueName: null, groupName: null })).toBeNull();
  });

  it("distinguishes four identically-named AC Rossoneri teams by their real, distinct contexts", () => {
    const contexts = [
      { leagueName: "3. Liga", groupName: "Gruppe 1" },
      { leagueName: "2. Liga", groupName: "Gruppe 2" },
      { leagueName: "Senioren 30+", groupName: "Gruppe 2" },
      { leagueName: "Junioren B", groupName: "Promotion" },
    ];

    const formatted = contexts.map(formatExternalTeamCompetitionContext);

    expect(formatted).toEqual([
      "3. Liga · Gruppe 1",
      "2. Liga · Gruppe 2",
      "Senioren 30+ · Gruppe 2",
      "Junioren B · Promotion",
    ]);
    expect(new Set(formatted).size).toBe(4);
  });
});
