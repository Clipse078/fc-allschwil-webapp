/**
 * Tests for lib/competitions/competition-service.ts
 *
 * Covers:
 *   A. createCompetition — validation, success, duplicate prevention
 *   B. updateCompetition — field updates, not-found error
 *   C. archiveCompetition / unarchiveCompetition — lifecycle
 *
 * All external dependencies (Prisma) are mocked. No DB access.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    competition: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  createCompetition,
  updateCompetition,
  archiveCompetition,
  unarchiveCompetition,
  CompetitionNotFoundError,
  CompetitionConflictError,
} from "../competition-service";
import { CompetitionValidationError } from "../validators";

// ── Fixtures ────────────────────────────────────────────────────────────────────

const TENANT_ID = "tenant-abc";
const COMPETITION_ID = "comp-01-id";

const baseRow = {
  id: COMPETITION_ID,
  tenantId: TENANT_ID,
  provider: "SFV",
  externalCompetitionId: 101,
  externalSeasonId: 2027,
  officialName: "3. Liga Frauen",
  shortName: null,
  groupName: "Gruppe 1",
  competitionType: "LEAGUE" as const,
  gender: "FEMALE" as const,
  ageCategory: null,
  isArchived: false,
  lastSyncedAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

// ── Setup ────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── A. createCompetition ──────────────────────────────────────────────────────

describe("A. createCompetition", () => {
  it("creates a competition with valid input", async () => {
    vi.mocked(prisma.competition.create).mockResolvedValue(baseRow as never);

    const result = await createCompetition(TENANT_ID, {
      provider: "SFV",
      officialName: "3. Liga Frauen",
      competitionType: "LEAGUE",
      gender: "FEMALE",
      externalCompetitionId: 101,
      externalSeasonId: 2027,
    });

    expect(result.id).toBe(COMPETITION_ID);
    expect(result.officialName).toBe("3. Liga Frauen");
    expect(result.tenantId).toBe(TENANT_ID);
    expect(prisma.competition.create).toHaveBeenCalledOnce();
  });

  it("passes correct tenantId and never derives it from input", async () => {
    vi.mocked(prisma.competition.create).mockResolvedValue(baseRow as never);

    await createCompetition(TENANT_ID, {
      provider: "MANUAL",
      officialName: "Test Cup",
    });

    const call = vi.mocked(prisma.competition.create).mock.calls[0][0];
    expect(call.data.tenantId).toBe(TENANT_ID);
  });

  it("throws CompetitionValidationError when officialName is empty", async () => {
    await expect(
      createCompetition(TENANT_ID, { provider: "SFV", officialName: "" }),
    ).rejects.toThrow(CompetitionValidationError);
  });

  it("throws CompetitionValidationError when provider is empty", async () => {
    await expect(
      createCompetition(TENANT_ID, { provider: "", officialName: "Test" }),
    ).rejects.toThrow(CompetitionValidationError);
  });

  it("throws CompetitionConflictError on unique constraint violation", async () => {
    vi.mocked(prisma.competition.create).mockRejectedValue(
      new Error("Unique constraint failed on the fields: (`Competition`)"),
    );

    await expect(
      createCompetition(TENANT_ID, {
        provider: "SFV",
        officialName: "3. Liga Frauen",
        externalCompetitionId: 101,
        externalSeasonId: 2027,
      }),
    ).rejects.toThrow(CompetitionConflictError);
  });

  it("defaults competitionType to LEAGUE", async () => {
    vi.mocked(prisma.competition.create).mockResolvedValue({
      ...baseRow,
      competitionType: "LEAGUE",
    } as never);

    await createCompetition(TENANT_ID, { provider: "MANUAL", officialName: "Foo Cup" });

    const call = vi.mocked(prisma.competition.create).mock.calls[0][0];
    expect(call.data.competitionType).toBe("LEAGUE");
  });
});

// ── B. updateCompetition ──────────────────────────────────────────────────────

describe("B. updateCompetition", () => {
  it("updates fields when competition exists", async () => {
    vi.mocked(prisma.competition.findFirst).mockResolvedValue({ id: COMPETITION_ID } as never);
    vi.mocked(prisma.competition.update).mockResolvedValue({
      ...baseRow,
      shortName: "3L Frauen",
    } as never);

    const result = await updateCompetition(TENANT_ID, COMPETITION_ID, {
      shortName: "3L Frauen",
    });

    expect(result.shortName).toBe("3L Frauen");
    expect(prisma.competition.update).toHaveBeenCalledOnce();
  });

  it("scopes findFirst by tenantId", async () => {
    vi.mocked(prisma.competition.findFirst).mockResolvedValue(null as never);

    await expect(
      updateCompetition(TENANT_ID, COMPETITION_ID, { shortName: "X" }),
    ).rejects.toThrow(CompetitionNotFoundError);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const findCall = (vi.mocked(prisma.competition.findFirst).mock.calls[0] as any)[0];
    expect(findCall.where.tenantId).toBe(TENANT_ID);
  });

  it("throws CompetitionNotFoundError when competition not found", async () => {
    vi.mocked(prisma.competition.findFirst).mockResolvedValue(null as never);

    await expect(
      updateCompetition(TENANT_ID, "nonexistent-id", { shortName: "X" }),
    ).rejects.toThrow(CompetitionNotFoundError);
  });

  it("throws CompetitionValidationError for invalid competitionType", async () => {
    await expect(
      updateCompetition(TENANT_ID, COMPETITION_ID, {
        competitionType: "INVALID_TYPE" as never,
      }),
    ).rejects.toThrow(CompetitionValidationError);
  });
});

// ── C. archiveCompetition / unarchiveCompetition ─────────────────────────────

describe("C. archiveCompetition", () => {
  it("sets isArchived to true", async () => {
    vi.mocked(prisma.competition.findFirst).mockResolvedValue({ id: COMPETITION_ID } as never);
    vi.mocked(prisma.competition.update).mockResolvedValue({
      ...baseRow,
      isArchived: true,
    } as never);

    const result = await archiveCompetition(TENANT_ID, COMPETITION_ID);
    expect(result.isArchived).toBe(true);

    const updateCall = vi.mocked(prisma.competition.update).mock.calls[0][0];
    expect(updateCall.data.isArchived).toBe(true);
  });

  it("throws CompetitionNotFoundError when not found", async () => {
    vi.mocked(prisma.competition.findFirst).mockResolvedValue(null as never);

    await expect(archiveCompetition(TENANT_ID, "missing-id")).rejects.toThrow(
      CompetitionNotFoundError,
    );
  });
});

describe("C. unarchiveCompetition", () => {
  it("sets isArchived to false", async () => {
    vi.mocked(prisma.competition.findFirst).mockResolvedValue({ id: COMPETITION_ID } as never);
    vi.mocked(prisma.competition.update).mockResolvedValue({
      ...baseRow,
      isArchived: false,
    } as never);

    const result = await unarchiveCompetition(TENANT_ID, COMPETITION_ID);
    expect(result.isArchived).toBe(false);
  });
});
