/**
 * Tests for lib/competitions/queries.ts
 *
 * Covers:
 *   A. listCompetitions — filtering, search, tenant isolation
 *   B. getCompetitionById — found / not found
 *   C. getEligibleCompetitions — season filtering, archived exclusion
 *   D. resolveCompetitionByProviderIds — exact match, not found
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    competition: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  listCompetitions,
  getCompetitionById,
  getEligibleCompetitions,
  resolveCompetitionByProviderIds,
} from "../queries";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

const baseRow = {
  id: "comp-01",
  tenantId: TENANT_A,
  provider: "SFV",
  externalCompetitionId: 200,
  externalSeasonId: 2027,
  officialName: "3. Liga Frauen",
  shortName: null,
  groupName: null,
  competitionType: "LEAGUE",
  gender: "FEMALE",
  ageCategory: null,
  isArchived: false,
  lastSyncedAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  _count: { teamSeasonCompetitions: 2 },
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── A. listCompetitions ────────────────────────────────────────────────────────

describe("A. listCompetitions", () => {
  it("returns competitions for the tenant", async () => {
    vi.mocked(prisma.competition.findMany).mockResolvedValue([baseRow] as never);

    const result = await listCompetitions(TENANT_A);
    expect(result).toHaveLength(1);
    expect(result[0].officialName).toBe("3. Liga Frauen");
  });

  it("scopes query to tenantId", async () => {
    vi.mocked(prisma.competition.findMany).mockResolvedValue([] as never);

    await listCompetitions(TENANT_A);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (vi.mocked(prisma.competition.findMany).mock.calls[0] as any)[0];
    expect(call.where.tenantId).toBe(TENANT_A);
  });

  it("excludes archived by default", async () => {
    vi.mocked(prisma.competition.findMany).mockResolvedValue([] as never);

    await listCompetitions(TENANT_A);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (vi.mocked(prisma.competition.findMany).mock.calls[0] as any)[0];
    expect(call.where.isArchived).toBe(false);
  });

  it("includes archived when includeArchived = true", async () => {
    vi.mocked(prisma.competition.findMany).mockResolvedValue([] as never);

    await listCompetitions(TENANT_A, { includeArchived: true });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (vi.mocked(prisma.competition.findMany).mock.calls[0] as any)[0];
    expect(call.where.isArchived).toBeUndefined();
  });

  it("filters by provider", async () => {
    vi.mocked(prisma.competition.findMany).mockResolvedValue([] as never);

    await listCompetitions(TENANT_A, { provider: "SFV" });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (vi.mocked(prisma.competition.findMany).mock.calls[0] as any)[0];
    expect(call.where.provider).toBe("SFV");
  });

  it("filters by externalSeasonId", async () => {
    vi.mocked(prisma.competition.findMany).mockResolvedValue([] as never);

    await listCompetitions(TENANT_A, { externalSeasonId: 2027 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (vi.mocked(prisma.competition.findMany).mock.calls[0] as any)[0];
    expect(call.where.externalSeasonId).toBe(2027);
  });

  it("includes search filter when search is provided", async () => {
    vi.mocked(prisma.competition.findMany).mockResolvedValue([] as never);

    await listCompetitions(TENANT_A, { search: "Frauen" });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (vi.mocked(prisma.competition.findMany).mock.calls[0] as any)[0];
    expect(call.where.OR).toBeDefined();
    expect(call.where.OR[0].officialName.contains).toBe("Frauen");
  });

  it("maps assignedTeamCount from _count", async () => {
    vi.mocked(prisma.competition.findMany).mockResolvedValue([baseRow] as never);

    const result = await listCompetitions(TENANT_A);
    expect(result[0].assignedTeamCount).toBe(2);
  });

  it("does not return data for a different tenant (isolation)", async () => {
    vi.mocked(prisma.competition.findMany).mockResolvedValue([] as never);

    const result = await listCompetitions(TENANT_B);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (vi.mocked(prisma.competition.findMany).mock.calls[0] as any)[0];
    expect(call.where.tenantId).toBe(TENANT_B);
    expect(result).toHaveLength(0);
  });
});

// ── B. getCompetitionById ──────────────────────────────────────────────────────

describe("B. getCompetitionById", () => {
  it("returns competition when found", async () => {
    vi.mocked(prisma.competition.findFirst).mockResolvedValue(baseRow as never);

    const result = await getCompetitionById(TENANT_A, "comp-01");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("comp-01");
  });

  it("returns null when not found", async () => {
    vi.mocked(prisma.competition.findFirst).mockResolvedValue(null as never);

    const result = await getCompetitionById(TENANT_A, "missing");
    expect(result).toBeNull();
  });

  it("scopes by tenantId", async () => {
    vi.mocked(prisma.competition.findFirst).mockResolvedValue(null as never);

    await getCompetitionById(TENANT_A, "comp-01");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (vi.mocked(prisma.competition.findFirst).mock.calls[0] as any)[0];
    expect(call.where.tenantId).toBe(TENANT_A);
    expect(call.where.id).toBe("comp-01");
  });
});

// ── C. getEligibleCompetitions ────────────────────────────────────────────────

describe("C. getEligibleCompetitions", () => {
  it("excludes archived competitions", async () => {
    vi.mocked(prisma.competition.findMany).mockResolvedValue([baseRow] as never);

    await getEligibleCompetitions(TENANT_A);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (vi.mocked(prisma.competition.findMany).mock.calls[0] as any)[0];
    expect(call.where.isArchived).toBe(false);
  });

  it("includes both season-specific and manual (null-season) competitions when seasonId provided", async () => {
    vi.mocked(prisma.competition.findMany).mockResolvedValue([] as never);

    await getEligibleCompetitions(TENANT_A, 2027);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (vi.mocked(prisma.competition.findMany).mock.calls[0] as any)[0];
    expect(call.where.OR).toBeDefined();
    expect(call.where.OR).toContainEqual({ externalSeasonId: 2027 });
    expect(call.where.OR).toContainEqual({ externalSeasonId: null });
  });

  it("does not filter by externalSeasonId when seasonId is undefined", async () => {
    vi.mocked(prisma.competition.findMany).mockResolvedValue([baseRow] as never);

    await getEligibleCompetitions(TENANT_A, undefined);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (vi.mocked(prisma.competition.findMany).mock.calls[0] as any)[0];
    expect(call.where.OR).toBeUndefined();
    expect(call.where.externalSeasonId).toBeUndefined();
  });

  it("returns all non-archived when no seasonId provided", async () => {
    vi.mocked(prisma.competition.findMany).mockResolvedValue([baseRow] as never);

    const result = await getEligibleCompetitions(TENANT_A);
    expect(result).toHaveLength(1);
  });
});

// ── D. resolveCompetitionByProviderIds ────────────────────────────────────────

describe("D. resolveCompetitionByProviderIds", () => {
  it("resolves competition by provider identifiers", async () => {
    vi.mocked(prisma.competition.findUnique).mockResolvedValue(baseRow as never);

    const result = await resolveCompetitionByProviderIds(TENANT_A, "SFV", 200, 2027);

    expect(result).not.toBeNull();
    expect(result!.externalCompetitionId).toBe(200);
    expect(result!.externalSeasonId).toBe(2027);
  });

  it("returns null when not found", async () => {
    vi.mocked(prisma.competition.findUnique).mockResolvedValue(null as never);

    const result = await resolveCompetitionByProviderIds(TENANT_A, "SFV", 999, 2027);
    expect(result).toBeNull();
  });

  it("passes correct composite key to Prisma", async () => {
    vi.mocked(prisma.competition.findUnique).mockResolvedValue(null as never);

    await resolveCompetitionByProviderIds(TENANT_A, "SFV", 200, 2027);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (vi.mocked(prisma.competition.findUnique).mock.calls[0] as any)[0];
    expect(call.where.tenantId_provider_externalCompetitionId_externalSeasonId).toEqual({
      tenantId: TENANT_A,
      provider: "SFV",
      externalCompetitionId: 200,
      externalSeasonId: 2027,
    });
  });
});
