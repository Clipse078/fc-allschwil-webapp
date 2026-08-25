/**
 * lib/integrations/sfv/__tests__/team-season-resolution.test.ts
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

const mockTeamFindUnique = vi.fn();
const mockTeamSeasonFindMany = vi.fn();
const mockResolveSeason = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    team: {
      findUnique: (...args: unknown[]) => mockTeamFindUnique(...args),
    },
    teamSeason: {
      findMany: (...args: unknown[]) => mockTeamSeasonFindMany(...args),
    },
  },
}));

vi.mock("../season-bridge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../season-bridge")>();
  return {
    ...actual,
    resolveCanonicalSeasonFromSfvExternalSeasonId: (...args: unknown[]) =>
      mockResolveSeason(...args),
  };
});

const { resolveTeamSeasonForExternalMapping } = await import("../team-season-resolution");

const TENANT = "tenant-a";
const TEAM = "team-a";

beforeEach(() => {
  vi.clearAllMocks();
  mockTeamFindUnique.mockResolvedValue({ id: TEAM, tenantId: TENANT });
  mockResolveSeason.mockResolvedValue({ id: "season-1", key: "2026/2027" });
});

describe("resolveTeamSeasonForExternalMapping", () => {
  it("resolves exactly one TeamSeason for tenant + team + externalSeasonId", async () => {
    mockTeamSeasonFindMany.mockResolvedValueOnce([{ id: "ts-1" }]);

    const result = await resolveTeamSeasonForExternalMapping({
      tenantId: TENANT,
      teamId: TEAM,
      provider: "SFV",
      externalSeasonId: 2027,
    });

    expect(result).toEqual({
      ok: true,
      teamSeasonId: "ts-1",
      seasonId: "season-1",
      seasonKey: "2026/2027",
    });
  });

  it("rejects cross-tenant teams", async () => {
    mockTeamFindUnique.mockResolvedValueOnce({ id: TEAM, tenantId: "other-tenant" });

    const result = await resolveTeamSeasonForExternalMapping({
      tenantId: TENANT,
      teamId: TEAM,
      provider: "SFV",
      externalSeasonId: 2027,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("TEAM_TENANT_MISMATCH");
    }
  });

  it("fails closed when season row is missing", async () => {
    mockResolveSeason.mockResolvedValueOnce(null);

    const result = await resolveTeamSeasonForExternalMapping({
      tenantId: TENANT,
      teamId: TEAM,
      provider: "SFV",
      externalSeasonId: 2027,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("SEASON_NOT_FOUND");
    }
  });

  it("reports missing TeamSeason", async () => {
    mockTeamSeasonFindMany.mockResolvedValueOnce([]);

    const result = await resolveTeamSeasonForExternalMapping({
      tenantId: TENANT,
      teamId: TEAM,
      provider: "SFV",
      externalSeasonId: 2027,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("TEAM_SEASON_NOT_FOUND");
    }
  });

  it("fails closed on ambiguous TeamSeason matches", async () => {
    mockTeamSeasonFindMany.mockResolvedValueOnce([{ id: "ts-1" }, { id: "ts-2" }]);

    const result = await resolveTeamSeasonForExternalMapping({
      tenantId: TENANT,
      teamId: TEAM,
      provider: "SFV",
      externalSeasonId: 2027,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("AMBIGUOUS");
    }
  });

  it("rejects wrong-season resolution when no TeamSeason exists for bridged season", async () => {
    mockResolveSeason.mockResolvedValueOnce({ id: "season-old", key: "2025/2026" });
    mockTeamSeasonFindMany.mockResolvedValueOnce([]);

    const result = await resolveTeamSeasonForExternalMapping({
      tenantId: TENANT,
      teamId: TEAM,
      provider: "SFV",
      externalSeasonId: 2026,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("TEAM_SEASON_NOT_FOUND");
    }
  });
});
