/**
 * Tests for lib/integrations/sfv/sync/competition-sync.ts
 *
 * Covers:
 *   A. syncSfvCompetitions — success, fetch error, tenant isolation
 *   B. Duplicate prevention (idempotency)
 *   C. Archival of absent competitions
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/integrations/sfv/tenant-config-service", () => ({
  requireEnabledSfvConfigForTenant: vi.fn(),
}));

vi.mock("@/lib/integrations/sfv/tenant-config-repository", () => ({
  markCompetitionSyncSuccessful: vi.fn(),
}));

vi.mock("@/lib/integrations/sfv/client", () => ({
  fetchTeamList: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    competition: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { requireEnabledSfvConfigForTenant } from "@/lib/integrations/sfv/tenant-config-service";
import { markCompetitionSyncSuccessful } from "@/lib/integrations/sfv/tenant-config-repository";
import { fetchTeamList } from "@/lib/integrations/sfv/client";
import { prisma } from "@/lib/db/prisma";
import { syncSfvCompetitions } from "../competition-sync";

// ── Fixtures ────────────────────────────────────────────────────────────────────

const TENANT_ID = "tenant-sfv";

const sfvConfig = {
  id: "config-01",
  tenantId: TENANT_ID,
  clubId: 483,
  defaultSeasonId: 2027,
  organisationId: null,
  enabled: true,
  lastTeamSyncAt: null,
  lastScheduleSyncAt: null,
  lastMatchDetailSyncAt: null,
  lastCompetitionSyncAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const teamListResponse = [
  {
    isHomeTeam: true,
    teamId: 1,
    teamName: "FC Allschwil 1",
    teamFullname: "FC Allschwil 1. Mannschaft",
    clubNumber: 483,
    clubName: "FC Allschwil",
    teamLeagueId: 100,
    teamLeagueName: "3. Liga Frauen",
    teamDivisionName: "Gruppe 1",
    teamOrganisationId: 1,
    isTeamActive: true,
  },
  {
    isHomeTeam: true,
    teamId: 2,
    teamName: "FC Allschwil 2",
    teamFullname: "FC Allschwil 2. Mannschaft",
    clubNumber: 483,
    clubName: "FC Allschwil",
    teamLeagueId: 200,
    teamLeagueName: "Promotion",
    teamDivisionName: null,
    teamOrganisationId: 1,
    isTeamActive: true,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireEnabledSfvConfigForTenant).mockResolvedValue(sfvConfig as never);
  vi.mocked(fetchTeamList).mockResolvedValue(teamListResponse as never);
  vi.mocked(prisma.competition.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.competition.create).mockResolvedValue({} as never);
  vi.mocked(prisma.competition.update).mockResolvedValue({} as never);
  vi.mocked(prisma.competition.updateMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(markCompetitionSyncSuccessful).mockResolvedValue(undefined as never);
});

// ── A. syncSfvCompetitions ────────────────────────────────────────────────────

describe("A. syncSfvCompetitions", () => {
  it("returns a sync result with correct counts", async () => {
    const result = await syncSfvCompetitions(TENANT_ID);

    expect(result.tenantId).toBe(TENANT_ID);
    expect(result.source).toBe("SFV");
    expect(result.fetched).toBe(2);
    expect(result.created).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.unchanged).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("marks competition sync as successful on zero failures", async () => {
    await syncSfvCompetitions(TENANT_ID);

    expect(markCompetitionSyncSuccessful).toHaveBeenCalledOnce();
    expect(vi.mocked(markCompetitionSyncSuccessful).mock.calls[0][0]).toBe(TENANT_ID);
  });

  it("does not mark sync successful when failures occurred", async () => {
    vi.mocked(prisma.competition.create).mockRejectedValue(new Error("DB error"));

    const result = await syncSfvCompetitions(TENANT_ID);

    expect(result.failed).toBe(2);
    expect(markCompetitionSyncSuccessful).not.toHaveBeenCalled();
  });

  it("returns fetch error result when fetchTeamList fails", async () => {
    vi.mocked(fetchTeamList).mockRejectedValue(
      Object.assign(new Error("Network failure"), { code: "SFV_UNAVAILABLE" }),
    );

    const result = await syncSfvCompetitions(TENANT_ID);

    expect(result.fetched).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors[0].message).toContain("Failed to fetch team list");
  });

  it("uses tenantId from trusted context, not caller input", async () => {
    await syncSfvCompetitions(TENANT_ID);

    expect(requireEnabledSfvConfigForTenant).toHaveBeenCalledWith(TENANT_ID);
  });
});

// ── B. Idempotency (unchanged) ─────────────────────────────────────────────────

describe("B. Idempotency (unchanged)", () => {
  it("returns unchanged for competitions that haven't changed", async () => {
    vi.mocked(prisma.competition.findMany).mockResolvedValue([
      {
        id: "comp-01",
        externalCompetitionId: 100,
        officialName: "3. Liga Frauen",
        groupName: "Gruppe 1",
        isArchived: false,
      },
      {
        id: "comp-02",
        externalCompetitionId: 200,
        officialName: "Promotion",
        groupName: null,
        isArchived: false,
      },
    ] as never);

    vi.mocked(prisma.competition.update).mockResolvedValue({} as never);

    const result = await syncSfvCompetitions(TENANT_ID);

    expect(result.unchanged).toBe(2);
    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
  });
});

// ── C. Archival ────────────────────────────────────────────────────────────────

describe("C. Archival of absent competitions", () => {
  it("archives competitions absent from the provider response", async () => {
    vi.mocked(prisma.competition.findMany).mockResolvedValue([
      {
        id: "comp-old",
        externalCompetitionId: 999,
        officialName: "Old Liga",
        groupName: null,
        isArchived: false,
      },
    ] as never);

    vi.mocked(prisma.competition.updateMany).mockResolvedValue({ count: 1 } as never);

    const result = await syncSfvCompetitions(TENANT_ID);

    expect(result.archived).toBe(1);
    expect(prisma.competition.updateMany).toHaveBeenCalledOnce();
  });

  it("does not archive when fetch returned empty list", async () => {
    vi.mocked(fetchTeamList).mockResolvedValue([] as never);
    vi.mocked(prisma.competition.findMany).mockResolvedValue([
      {
        id: "comp-existing",
        externalCompetitionId: 100,
        officialName: "Liga",
        groupName: null,
        isArchived: false,
      },
    ] as never);

    const result = await syncSfvCompetitions(TENANT_ID);
    expect(result.archived).toBe(0);
    expect(prisma.competition.updateMany).not.toHaveBeenCalled();
  });
});
