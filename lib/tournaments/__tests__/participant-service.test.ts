/**
 * Tests for lib/tournaments/participant-service.ts
 *
 * Proves TOURNAMENTCENTER-01B requirements:
 *   1. Tournament supports at least 4 participants.
 *   2. More than 4 participants is supported.
 *   3. Multiple FCA Teams can participate.
 *   4. Multiple ExternalTeams can participate.
 *   5. Internal + external participants coexist.
 *   6. Participants can be added/removed safely.
 *   7. Duplicate participant assignment is prevented.
 *   8. Tenant isolation holds for Team and ExternalTeam references.
 *
 * All external dependencies (Prisma) are mocked. No DB access.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    event: { findFirst: vi.fn() },
    team: { findFirst: vi.fn() },
    externalTeam: { findFirst: vi.fn() },
    tournamentParticipant: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  listTournamentParticipants,
  addTournamentParticipant,
  removeTournamentParticipant,
  getTournamentParticipant,
} from "../participant-service";
import {
  TournamentNotFoundError,
  TournamentParticipantNotFoundError,
  TournamentParticipantValidationError,
  TournamentParticipantTenantMismatchError,
  TournamentParticipantDuplicateError,
} from "../errors";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const TOURNAMENT_ID = "tournament-01";

function teamRow(id: string, name: string) {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    category: "JUNIOR",
    genderGroup: null,
    ageGroup: "E",
  };
}

function externalTeamRow(id: string, name: string, clubId: string, clubName: string) {
  return {
    id,
    name,
    shortName: null,
    categoryLabel: "E1",
    externalClub: { id: clubId, name: clubName, shortName: null },
  };
}

function participantRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "participant-1",
    eventId: TOURNAMENT_ID,
    teamId: null,
    externalTeamId: null,
    manualLabel: null,
    displayOrder: 0,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    team: null,
    externalTeam: null,
    dressingRoomAllocations: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.event.findFirst).mockResolvedValue({ id: TOURNAMENT_ID } as never);
});

describe("addTournamentParticipant", () => {
  it("adds a Team participant when the team belongs to the tenant", async () => {
    vi.mocked(prisma.team.findFirst).mockResolvedValue({ id: "team-1" } as never);
    vi.mocked(prisma.tournamentParticipant.aggregate).mockResolvedValue({
      _max: { displayOrder: null },
    } as never);
    vi.mocked(prisma.tournamentParticipant.create).mockResolvedValue(
      participantRow({ teamId: "team-1", team: teamRow("team-1", "FC Allschwil E1") }) as never,
    );

    const result = await addTournamentParticipant(TENANT_A, TOURNAMENT_ID, { teamId: "team-1" });

    expect(result.kind).toBe("TEAM");
    expect(result.team?.id).toBe("team-1");
    expect(prisma.team.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "team-1", tenantId: TENANT_A } }),
    );
  });

  it("adds an ExternalTeam participant when the external team belongs to the tenant", async () => {
    vi.mocked(prisma.externalTeam.findFirst).mockResolvedValue({ id: "ext-1" } as never);
    vi.mocked(prisma.tournamentParticipant.aggregate).mockResolvedValue({
      _max: { displayOrder: 0 },
    } as never);
    vi.mocked(prisma.tournamentParticipant.create).mockResolvedValue(
      participantRow({
        externalTeamId: "ext-1",
        externalTeam: externalTeamRow("ext-1", "BSC Old Boys E1", "club-1", "BSC Old Boys"),
      }) as never,
    );

    const result = await addTournamentParticipant(TENANT_A, TOURNAMENT_ID, { externalTeamId: "ext-1" });

    expect(result.kind).toBe("EXTERNAL_TEAM");
    expect(result.externalTeam?.club.name).toBe("BSC Old Boys");
  });

  it("adds a manual fallback participant (smallest clean fallback, no canonical team)", async () => {
    vi.mocked(prisma.tournamentParticipant.aggregate).mockResolvedValue({
      _max: { displayOrder: 1 },
    } as never);
    vi.mocked(prisma.tournamentParticipant.create).mockResolvedValue(
      participantRow({ manualLabel: "Unbekanntes Gastteam" }) as never,
    );

    const result = await addTournamentParticipant(TENANT_A, TOURNAMENT_ID, {
      manualLabel: "Unbekanntes Gastteam",
    });

    expect(result.kind).toBe("MANUAL");
    expect(result.manualLabel).toBe("Unbekanntes Gastteam");
    expect(prisma.team.findFirst).not.toHaveBeenCalled();
    expect(prisma.externalTeam.findFirst).not.toHaveBeenCalled();
  });

  it("rejects when none of teamId/externalTeamId/manualLabel are provided", async () => {
    await expect(addTournamentParticipant(TENANT_A, TOURNAMENT_ID, {})).rejects.toThrow(
      TournamentParticipantValidationError,
    );
    expect(prisma.tournamentParticipant.create).not.toHaveBeenCalled();
  });

  it("rejects when more than one of teamId/externalTeamId/manualLabel are provided", async () => {
    await expect(
      addTournamentParticipant(TENANT_A, TOURNAMENT_ID, { teamId: "team-1", manualLabel: "X" }),
    ).rejects.toThrow(TournamentParticipantValidationError);
  });

  it("throws TournamentNotFoundError for a cross-tenant tournament id", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue(null as never);

    await expect(
      addTournamentParticipant(TENANT_B, TOURNAMENT_ID, { teamId: "team-1" }),
    ).rejects.toThrow(TournamentNotFoundError);
  });

  // ── Tenant isolation (requirement 8) ───────────────────────────────────────

  it("rejects a Team belonging to a different tenant", async () => {
    vi.mocked(prisma.team.findFirst).mockResolvedValue(null as never);

    await expect(
      addTournamentParticipant(TENANT_A, TOURNAMENT_ID, { teamId: "other-tenant-team" }),
    ).rejects.toThrow(TournamentParticipantTenantMismatchError);
    expect(prisma.tournamentParticipant.create).not.toHaveBeenCalled();
  });

  it("rejects an ExternalTeam belonging to a different tenant", async () => {
    vi.mocked(prisma.externalTeam.findFirst).mockResolvedValue(null as never);

    await expect(
      addTournamentParticipant(TENANT_A, TOURNAMENT_ID, { externalTeamId: "other-tenant-ext" }),
    ).rejects.toThrow(TournamentParticipantTenantMismatchError);
    expect(prisma.tournamentParticipant.create).not.toHaveBeenCalled();
  });

  // ── Duplicate prevention (requirement 7) ───────────────────────────────────

  it("maps a unique-constraint violation to TournamentParticipantDuplicateError for a Team", async () => {
    vi.mocked(prisma.team.findFirst).mockResolvedValue({ id: "team-1" } as never);
    vi.mocked(prisma.tournamentParticipant.aggregate).mockResolvedValue({
      _max: { displayOrder: 0 },
    } as never);
    vi.mocked(prisma.tournamentParticipant.create).mockRejectedValue(
      new Error("Unique constraint failed on the fields: (`eventId`,`teamId`)"),
    );

    await expect(
      addTournamentParticipant(TENANT_A, TOURNAMENT_ID, { teamId: "team-1" }),
    ).rejects.toThrow(TournamentParticipantDuplicateError);
  });

  it("maps a unique-constraint violation to TournamentParticipantDuplicateError for an ExternalTeam", async () => {
    vi.mocked(prisma.externalTeam.findFirst).mockResolvedValue({ id: "ext-1" } as never);
    vi.mocked(prisma.tournamentParticipant.aggregate).mockResolvedValue({
      _max: { displayOrder: 0 },
    } as never);
    vi.mocked(prisma.tournamentParticipant.create).mockRejectedValue(
      new Error("Unique constraint failed on the fields: (`eventId`,`externalTeamId`)"),
    );

    await expect(
      addTournamentParticipant(TENANT_A, TOURNAMENT_ID, { externalTeamId: "ext-1" }),
    ).rejects.toThrow(TournamentParticipantDuplicateError);
  });
});

describe("removeTournamentParticipant", () => {
  it("removes an existing participant", async () => {
    vi.mocked(prisma.tournamentParticipant.findFirst).mockResolvedValue(participantRow() as never);
    vi.mocked(prisma.tournamentParticipant.delete).mockResolvedValue({} as never);

    await removeTournamentParticipant(TENANT_A, "participant-1");

    expect(prisma.tournamentParticipant.delete).toHaveBeenCalledWith({ where: { id: "participant-1" } });
  });

  it("throws TournamentParticipantNotFoundError for a cross-tenant participant", async () => {
    vi.mocked(prisma.tournamentParticipant.findFirst).mockResolvedValue(null as never);

    await expect(removeTournamentParticipant(TENANT_B, "participant-1")).rejects.toThrow(
      TournamentParticipantNotFoundError,
    );
    expect(prisma.tournamentParticipant.delete).not.toHaveBeenCalled();
  });
});

describe("getTournamentParticipant", () => {
  it("returns the DTO when found", async () => {
    vi.mocked(prisma.tournamentParticipant.findFirst).mockResolvedValue(
      participantRow({ teamId: "team-1", team: teamRow("team-1", "FC Allschwil E1") }) as never,
    );

    const result = await getTournamentParticipant(TENANT_A, "participant-1");
    expect(result.displayName).toBe("FC Allschwil E1");
  });
});

describe("listTournamentParticipants — variable participant count (requirements 1-5)", () => {
  it("supports at least 4 participants, mixing multiple FCA Teams and ExternalTeams", async () => {
    const rows = [
      participantRow({ id: "p1", teamId: "team-e1", team: teamRow("team-e1", "FC Allschwil E1") }),
      participantRow({ id: "p2", teamId: "team-e2", team: teamRow("team-e2", "FC Allschwil E2") }),
      participantRow({
        id: "p3",
        externalTeamId: "ext-oldboys",
        externalTeam: externalTeamRow("ext-oldboys", "BSC Old Boys E1", "club-oldboys", "BSC Old Boys"),
      }),
      participantRow({
        id: "p4",
        externalTeamId: "ext-basel",
        externalTeam: externalTeamRow("ext-basel", "FC Basel E2", "club-basel", "FC Basel"),
      }),
    ];
    vi.mocked(prisma.tournamentParticipant.findMany).mockResolvedValue(rows as never);

    const result = await listTournamentParticipants(TENANT_A, TOURNAMENT_ID);

    expect(result).toHaveLength(4);
    expect(result.filter((p) => p.kind === "TEAM")).toHaveLength(2);
    expect(result.filter((p) => p.kind === "EXTERNAL_TEAM")).toHaveLength(2);
  });

  it("supports more than 4 participants (no arbitrary maximum)", async () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      participantRow({
        id: `p${i}`,
        externalTeamId: `ext-${i}`,
        externalTeam: externalTeamRow(`ext-${i}`, `Gastteam ${i}`, `club-${i}`, `Club ${i}`),
      }),
    );
    vi.mocked(prisma.tournamentParticipant.findMany).mockResolvedValue(rows as never);

    const result = await listTournamentParticipants(TENANT_A, TOURNAMENT_ID);

    expect(result).toHaveLength(12);
  });

  it("throws TournamentNotFoundError for a cross-tenant tournament", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue(null as never);

    await expect(listTournamentParticipants(TENANT_B, TOURNAMENT_ID)).rejects.toThrow(
      TournamentNotFoundError,
    );
  });
});
