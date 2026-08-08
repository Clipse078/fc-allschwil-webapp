/**
 * Tests for lib/tournaments/tournament-service.ts
 *
 * Covers:
 *   A. listTournaments   — tenant scoping, status filter
 *   B. getTournament     — retrieval, not-found, cross-tenant
 *   C. updateTournament  — field updates, validation, teamId tenant check
 *   D. cancelTournament  — lifecycle, idempotency, invalid transitions
 *   E. restoreTournament — lifecycle, idempotency, invalid transitions
 *
 * All external dependencies (Prisma) are mocked. No DB access.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    team: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  listTournaments,
  getTournament,
  updateTournament,
  cancelTournament,
  restoreTournament,
} from "../tournament-service";
import {
  TournamentNotFoundError,
  TournamentValidationError,
  TournamentInvalidTransitionError,
} from "../errors";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const TOURNAMENT_ID = "tournament-01";
const TEAM_ID = "team-01";

const baseRow = {
  id: TOURNAMENT_ID,
  tenantId: TENANT_A,
  title: "E1 Hallenturnier",
  description: null,
  status: "SCHEDULED" as const,
  source: "MANUAL",
  reviewStage: "APPROVED",
  startAt: new Date("2026-09-05T16:00:00.000Z"),
  endAt: null,
  meetingTime: null,
  location: "Turnhalle Binningen",
  organizerName: "FC Aesch",
  competitionLabel: null,
  resultLabel: null,
  remarks: null,
  websiteVisible: true,
  infoboardVisible: false,
  homepageVisible: false,
  wochenplanVisible: false,
  teamPageVisible: false,
  pitchCode: null,
  homeDressingRoomCode: null,
  awayDressingRoomCode: null,
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
  season: { id: "season-1", key: "2026-27", name: "2026/27" },
  team: { id: TEAM_ID, name: "FC Allschwil E1", slug: "e1", category: "JUNIOR", genderGroup: null, ageGroup: "E" },
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── A. listTournaments ─────────────────────────────────────────────────────────

describe("A. listTournaments", () => {
  it("scopes the query to the tenant and TOURNAMENT type", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([baseRow] as never);

    const result = await listTournaments(TENANT_A);

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(TOURNAMENT_ID);
    const call = vi.mocked(prisma.event.findMany).mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(call.where).toMatchObject({ tenantId: TENANT_A, type: "TOURNAMENT" });
  });

  it("applies a status filter when provided", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([] as never);

    await listTournaments(TENANT_A, { status: ["CANCELLED"] });

    const call = vi.mocked(prisma.event.findMany).mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(call.where).toMatchObject({ status: { in: ["CANCELLED"] } });
  });
});

// ── B. getTournament ───────────────────────────────────────────────────────────

describe("B. getTournament", () => {
  it("returns the DTO when found", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue(baseRow as never);

    const result = await getTournament(TENANT_A, TOURNAMENT_ID);

    expect(result.id).toBe(TOURNAMENT_ID);
    expect(result.tenantId).toBe(TENANT_A);
    expect(result.team?.id).toBe(TEAM_ID);
  });

  it("throws TournamentNotFoundError when not found", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue(null as never);

    await expect(getTournament(TENANT_A, "nope")).rejects.toThrow(TournamentNotFoundError);
  });

  it("cannot resolve a cross-tenant tournament (query is tenant-scoped)", async () => {
    // Simulates the tenant-scoped WHERE clause never matching another tenant's row.
    vi.mocked(prisma.event.findFirst).mockResolvedValue(null as never);

    await expect(getTournament(TENANT_B, TOURNAMENT_ID)).rejects.toThrow(TournamentNotFoundError);

    const call = vi.mocked(prisma.event.findFirst).mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(call.where).toMatchObject({ tenantId: TENANT_B, type: "TOURNAMENT" });
  });
});

// ── C. updateTournament ────────────────────────────────────────────────────────

describe("C. updateTournament", () => {
  beforeEach(() => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue(baseRow as never);
    vi.mocked(prisma.event.update).mockResolvedValue(baseRow as never);
  });

  it("updates provided fields only (partial update)", async () => {
    await updateTournament(TENANT_A, TOURNAMENT_ID, { title: "Neuer Titel" });

    const call = vi.mocked(prisma.event.update).mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(call.data).toEqual({ title: "Neuer Titel" });
  });

  it("throws TournamentValidationError for an empty title", async () => {
    await expect(updateTournament(TENANT_A, TOURNAMENT_ID, { title: "   " })).rejects.toThrow(
      TournamentValidationError,
    );
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("throws TournamentValidationError when endAt precedes startAt", async () => {
    await expect(
      updateTournament(TENANT_A, TOURNAMENT_ID, {
        startAt: new Date("2026-09-05T16:00:00.000Z"),
        endAt: new Date("2026-09-05T10:00:00.000Z"),
      }),
    ).rejects.toThrow(TournamentValidationError);
  });

  it("throws TournamentNotFoundError for a cross-tenant tournament", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue(null as never);

    await expect(updateTournament(TENANT_B, TOURNAMENT_ID, { title: "X" })).rejects.toThrow(
      TournamentNotFoundError,
    );
  });

  it("validates teamId belongs to the same tenant", async () => {
    vi.mocked(prisma.team.findFirst).mockResolvedValue(null as never);

    await expect(
      updateTournament(TENANT_A, TOURNAMENT_ID, { teamId: "other-tenant-team" }),
    ).rejects.toThrow(TournamentValidationError);

    const call = vi.mocked(prisma.team.findFirst).mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(call.where).toMatchObject({ id: "other-tenant-team", tenantId: TENANT_A });
  });

  it("allows clearing teamId to null without a team lookup", async () => {
    await updateTournament(TENANT_A, TOURNAMENT_ID, { teamId: null });

    expect(prisma.team.findFirst).not.toHaveBeenCalled();
    const call = vi.mocked(prisma.event.update).mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(call.data.teamId).toBeNull();
  });

  it("persists facility allocation fields", async () => {
    await updateTournament(TENANT_A, TOURNAMENT_ID, {
      pitchCode: "STADION",
      homeDressingRoomCode: "E1",
      awayDressingRoomCode: "E2",
    });

    const call = vi.mocked(prisma.event.update).mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(call.data).toMatchObject({
      pitchCode: "STADION",
      homeDressingRoomCode: "E1",
      awayDressingRoomCode: "E2",
    });
  });
});

// ── D. cancelTournament ────────────────────────────────────────────────────────

describe("D. cancelTournament", () => {
  it("cancels a SCHEDULED tournament", async () => {
    vi.mocked(prisma.event.findFirst)
      .mockResolvedValueOnce(baseRow as never)
      .mockResolvedValueOnce({ ...baseRow, status: "CANCELLED" } as never);
    vi.mocked(prisma.event.update).mockResolvedValue({ ...baseRow, status: "CANCELLED" } as never);

    const result = await cancelTournament(TENANT_A, TOURNAMENT_ID);

    expect(result.status).toBe("CANCELLED");
    expect(prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "CANCELLED" } }),
    );
  });

  it("is idempotent when already CANCELLED", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue({ ...baseRow, status: "CANCELLED" } as never);

    const result = await cancelTournament(TENANT_A, TOURNAMENT_ID);

    expect(result.status).toBe("CANCELLED");
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("throws TournamentInvalidTransitionError for a COMPLETED tournament", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue({ ...baseRow, status: "COMPLETED" } as never);

    await expect(cancelTournament(TENANT_A, TOURNAMENT_ID)).rejects.toThrow(
      TournamentInvalidTransitionError,
    );
  });

  it("throws TournamentNotFoundError for a cross-tenant tournament", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue(null as never);

    await expect(cancelTournament(TENANT_B, TOURNAMENT_ID)).rejects.toThrow(TournamentNotFoundError);
  });
});

// ── E. restoreTournament ───────────────────────────────────────────────────────

describe("E. restoreTournament", () => {
  it("restores a CANCELLED tournament to SCHEDULED", async () => {
    vi.mocked(prisma.event.findFirst)
      .mockResolvedValueOnce({ ...baseRow, status: "CANCELLED" } as never)
      .mockResolvedValueOnce({ ...baseRow, status: "SCHEDULED" } as never);
    vi.mocked(prisma.event.update).mockResolvedValue({ ...baseRow, status: "SCHEDULED" } as never);

    const result = await restoreTournament(TENANT_A, TOURNAMENT_ID);

    expect(result.status).toBe("SCHEDULED");
    expect(prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "SCHEDULED" } }),
    );
  });

  it("is idempotent when already SCHEDULED", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue(baseRow as never);

    const result = await restoreTournament(TENANT_A, TOURNAMENT_ID);

    expect(result.status).toBe("SCHEDULED");
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("throws TournamentInvalidTransitionError for a non-cancelled, non-scheduled tournament", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue({ ...baseRow, status: "ARCHIVED" } as never);

    await expect(restoreTournament(TENANT_A, TOURNAMENT_ID)).rejects.toThrow(
      TournamentInvalidTransitionError,
    );
  });

  it("throws TournamentNotFoundError for a cross-tenant tournament", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue(null as never);

    await expect(restoreTournament(TENANT_B, TOURNAMENT_ID)).rejects.toThrow(TournamentNotFoundError);
  });
});
