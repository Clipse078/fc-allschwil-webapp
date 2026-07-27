/**
 * Tests for lib/competitions/competition-resolver.ts
 *
 * Covers:
 *   A. resolveCompetition — returns competition, null when missing, null when archived
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    competition: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { resolveCompetition } from "../competition-resolver";

const TENANT_A = "tenant-a";

const activeCompetition = {
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
};

beforeEach(() => vi.clearAllMocks());

describe("A. resolveCompetition", () => {
  it("returns the competition when found and active", async () => {
    vi.mocked(prisma.competition.findUnique).mockResolvedValue(activeCompetition as never);

    const result = await resolveCompetition(TENANT_A, "SFV", 200, 2027);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("comp-01");
  });

  it("returns null when competition does not exist", async () => {
    vi.mocked(prisma.competition.findUnique).mockResolvedValue(null as never);

    const result = await resolveCompetition(TENANT_A, "SFV", 999, 2027);
    expect(result).toBeNull();
  });

  it("returns null when competition is archived", async () => {
    vi.mocked(prisma.competition.findUnique).mockResolvedValue({
      ...activeCompetition,
      isArchived: true,
    } as never);

    const result = await resolveCompetition(TENANT_A, "SFV", 200, 2027);
    expect(result).toBeNull();
  });

  it("passes tenantId to underlying query", async () => {
    vi.mocked(prisma.competition.findUnique).mockResolvedValue(null as never);

    await resolveCompetition(TENANT_A, "SFV", 200, 2027);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (vi.mocked(prisma.competition.findUnique).mock.calls[0] as any)[0];
    expect(call.where.tenantId_provider_externalCompetitionId_externalSeasonId.tenantId).toBe(
      TENANT_A,
    );
  });
});
