/**
 * lib/integrations/sfv/__tests__/sync-team-mapper.test.ts
 *
 * Unit tests for pure mapping functions in team-mapper.ts.
 *
 * No database or network access. All functions are pure and deterministic.
 */

import { describe, it, expect } from "vitest";
import {
  inferTeamCategory,
  buildSfvTeamSlug,
  buildNewTeamFields,
  buildMappingFields,
  hasProviderChanges,
} from "../sync/team-mapper";
import type { TeamDetail } from "../client";
import type { SfvTeamSyncContext } from "../sync/types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CONTEXT: SfvTeamSyncContext = {
  tenantId: "tenant-abc",
  clubId: 483,
  seasonId: 2027,
  organisationId: null,
  syncedAt: new Date("2026-07-13T12:00:00.000Z"),
};

function makeDetail(overrides: Partial<TeamDetail> = {}): TeamDetail {
  return {
    isHomeTeam: true,
    teamId: 31927,
    teamName: "FC Allschwil 1",
    teamFullname: "FC Allschwil 1 (4. Liga)",
    clubNumber: 3502,
    clubName: "FC Allschwil",
    teamLeagueId: 17131,
    teamLeagueName: "4. Liga",
    teamDivisionName: "Gruppe 1",
    teamOrganisationId: 8,
    isTeamActive: true,
    ...overrides,
  };
}

// ── inferTeamCategory ─────────────────────────────────────────────────────────

describe("inferTeamCategory", () => {
  it("returns JUNIOREN for league name containing Junioren", () => {
    expect(inferTeamCategory("FC Club U14", "Junioren D")).toBe("JUNIOREN");
  });

  it("returns JUNIOREN for team name containing U16", () => {
    expect(inferTeamCategory("FC Club U16", "Liga")).toBe("JUNIOREN");
  });

  it("returns FRAUEN for league name containing Frauen", () => {
    expect(inferTeamCategory("FC Club", "2. Liga Frauen")).toBe("FRAUEN");
  });

  it("returns FRAUEN for league name containing Damen", () => {
    expect(inferTeamCategory("FC Club Damen", "Regional")).toBe("FRAUEN");
  });

  it("returns SENIOREN for league name containing Senioren", () => {
    expect(inferTeamCategory("FC Club", "Senioren 40+")).toBe("SENIOREN");
  });

  it("returns KINDERFUSSBALL for league name containing Kinder", () => {
    expect(inferTeamCategory("FC Club", "Kinderfussball")).toBe("KINDERFUSSBALL");
  });

  it("returns AKTIVE as default for unknown league", () => {
    expect(inferTeamCategory("FC Club 1", "4. Liga")).toBe("AKTIVE");
  });

  it("handles null teamName and leagueName", () => {
    expect(inferTeamCategory(null, null)).toBe("AKTIVE");
  });
});

// ── buildSfvTeamSlug ──────────────────────────────────────────────────────────

describe("buildSfvTeamSlug", () => {
  it("produces slug in format sfv-{teamId}", () => {
    expect(buildSfvTeamSlug(31927)).toBe("sfv-31927");
  });

  it("produces unique slugs for different teamIds", () => {
    expect(buildSfvTeamSlug(31927)).not.toBe(buildSfvTeamSlug(60413));
  });

  it("slug is URL-safe (no spaces or special chars)", () => {
    const slug = buildSfvTeamSlug(12345);
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });
});

// ── buildNewTeamFields ────────────────────────────────────────────────────────

describe("buildNewTeamFields", () => {
  it("uses teamFullname when available", () => {
    const fields = buildNewTeamFields(makeDetail({ teamFullname: "FC Allschwil 1 (4. Liga)" }), CONTEXT);
    expect(fields.name).toBe("FC Allschwil 1 (4. Liga)");
  });

  it("falls back to teamName when teamFullname is null", () => {
    const fields = buildNewTeamFields(makeDetail({ teamFullname: null, teamName: "FC Allschwil" }), CONTEXT);
    expect(fields.name).toBe("FC Allschwil");
  });

  it("falls back to synthetic name when both teamName and teamFullname are null", () => {
    const fields = buildNewTeamFields(makeDetail({ teamFullname: null, teamName: null, teamId: 99 }), CONTEXT);
    expect(fields.name).toBe("SFV-Team 99");
  });

  it("sets tenantId from context", () => {
    const fields = buildNewTeamFields(makeDetail(), CONTEXT);
    expect(fields.tenantId).toBe(CONTEXT.tenantId);
  });

  it("sets isActive to true", () => {
    const fields = buildNewTeamFields(makeDetail(), CONTEXT);
    expect(fields.isActive).toBe(true);
  });

  it("produces a slug starting with sfv-", () => {
    const fields = buildNewTeamFields(makeDetail(), CONTEXT);
    expect(fields.slug).toMatch(/^sfv-/);
  });
});

// ── buildMappingFields ────────────────────────────────────────────────────────

describe("buildMappingFields", () => {
  it("sets provider to SFV", () => {
    const fields = buildMappingFields(makeDetail(), CONTEXT);
    expect(fields.provider).toBe("SFV");
  });

  it("maps externalTeamId from teamId", () => {
    const fields = buildMappingFields(makeDetail({ teamId: 31927 }), CONTEXT);
    expect(fields.externalTeamId).toBe(31927);
  });

  it("maps externalSeasonId from context.seasonId", () => {
    const fields = buildMappingFields(makeDetail(), CONTEXT);
    expect(fields.externalSeasonId).toBe(CONTEXT.seasonId);
  });

  it("maps providerIsActive from isTeamActive", () => {
    expect(buildMappingFields(makeDetail({ isTeamActive: true }), CONTEXT).providerIsActive).toBe(true);
    expect(buildMappingFields(makeDetail({ isTeamActive: false }), CONTEXT).providerIsActive).toBe(false);
  });

  it("sets lastSyncedAt from context.syncedAt", () => {
    const fields = buildMappingFields(makeDetail(), CONTEXT);
    expect(fields.lastSyncedAt).toBe(CONTEXT.syncedAt);
  });

  it("prefers teamFullname for providerTeamName", () => {
    const fields = buildMappingFields(makeDetail({ teamFullname: "Full", teamName: "Short" }), CONTEXT);
    expect(fields.providerTeamName).toBe("Full");
  });

  it("falls back to teamName when teamFullname is null", () => {
    const fields = buildMappingFields(makeDetail({ teamFullname: null, teamName: "Short" }), CONTEXT);
    expect(fields.providerTeamName).toBe("Short");
  });
});

// ── hasProviderChanges ────────────────────────────────────────────────────────

describe("hasProviderChanges", () => {
  function makeExisting(overrides: Partial<{
    providerTeamName: string | null;
    providerLeagueId: number | null;
    providerLeagueName: string | null;
    providerOrganisationId: number | null;
    providerIsActive: boolean;
  }> = {}) {
    return {
      providerTeamName: "FC Allschwil 1 (4. Liga)",
      providerLeagueId: 17131,
      providerLeagueName: "4. Liga",
      providerOrganisationId: 8,
      providerIsActive: true,
      ...overrides,
    };
  }

  it("returns false when all fields match", () => {
    const incoming = buildMappingFields(makeDetail(), CONTEXT);
    expect(hasProviderChanges(makeExisting(), incoming)).toBe(false);
  });

  it("returns true when leagueName differs", () => {
    const incoming = buildMappingFields(makeDetail({ teamLeagueName: "3. Liga" }), CONTEXT);
    expect(hasProviderChanges(makeExisting(), incoming)).toBe(true);
  });

  it("returns true when providerIsActive changes", () => {
    const incoming = buildMappingFields(makeDetail({ isTeamActive: false }), CONTEXT);
    expect(hasProviderChanges(makeExisting({ providerIsActive: true }), incoming)).toBe(true);
  });

  it("returns true when teamName changes", () => {
    const incoming = buildMappingFields(makeDetail({ teamFullname: "New Name" }), CONTEXT);
    expect(hasProviderChanges(makeExisting({ providerTeamName: "Old Name" }), incoming)).toBe(true);
  });

  it("returns false when only lastSyncedAt changes (not a tracked field in existing)", () => {
    // lastSyncedAt is not in the existing mapping comparison set
    const incoming = buildMappingFields(makeDetail(), CONTEXT);
    expect(hasProviderChanges(makeExisting(), incoming)).toBe(false);
  });
});
