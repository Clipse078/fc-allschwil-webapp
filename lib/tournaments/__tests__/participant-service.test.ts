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
    externalClub: { findFirst: vi.fn(), findMany: vi.fn() },
    tournamentParticipant: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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
  updateTournamentParticipantDisplayName,
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

function externalClubRow(id: string, name: string, shortName: string | null = null) {
  return { id, name, shortName };
}

function participantRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "participant-1",
    eventId: TOURNAMENT_ID,
    teamId: null,
    externalTeamId: null,
    externalClubId: null,
    displayName: null,
    manualLabel: null,
    displayOrder: 0,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    team: null,
    externalTeam: null,
    externalClub: null,
    dressingRoomAllocations: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.event.findFirst).mockResolvedValue({ id: TOURNAMENT_ID } as never);
  vi.mocked(prisma.externalClub.findMany).mockResolvedValue([] as never);
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

// ── TOURNAMENTCENTER-UX-03 — canonical ExternalClub participant identity ────
//
// Proves the focused requirements:
//   5.  external participant can be created with ExternalClub + displayName
//   6.  same ExternalClub may be used twice with different displayNames
//   7.  blank displayName falls back safely
//   8.  ExternalClub.name remains unchanged
//   9.  ExternalTeam is not required for new participants
//   11. cross-tenant club rejected
//   12. archived club excluded (rejected at creation, defense in depth)

describe("addTournamentParticipant — EXTERNAL_CLUB (TOURNAMENTCENTER-UX-03)", () => {
  it("creates an EXTERNAL_CLUB participant with a displayName (requirement 5)", async () => {
    vi.mocked(prisma.externalClub.findFirst).mockResolvedValue({ id: "club-1", archivedAt: null } as never);
    vi.mocked(prisma.tournamentParticipant.aggregate).mockResolvedValue({
      _max: { displayOrder: null },
    } as never);
    vi.mocked(prisma.tournamentParticipant.create).mockResolvedValue(
      participantRow({
        externalClubId: "club-1",
        displayName: "Gelb",
        externalClub: externalClubRow("club-1", "AC Rossoneri"),
      }) as never,
    );

    const result = await addTournamentParticipant(TENANT_A, TOURNAMENT_ID, {
      externalClubId: "club-1",
      displayName: "Gelb",
    });

    expect(result.kind).toBe("EXTERNAL_CLUB");
    expect(result.externalClub?.club.name).toBe("AC Rossoneri");
    expect(result.externalClub?.rawDisplayName).toBe("Gelb");
    expect(result.displayName).toBe("Gelb");
    // ExternalTeam is not required for new participants (requirement 9).
    expect(prisma.externalTeam.findFirst).not.toHaveBeenCalled();
    expect(prisma.tournamentParticipant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ externalClubId: "club-1", displayName: "Gelb", externalTeamId: null }),
      }),
    );
  });

  it("allows the same ExternalClub to be used twice with different displayNames (requirement 6)", async () => {
    vi.mocked(prisma.externalClub.findFirst).mockResolvedValue({ id: "club-1", archivedAt: null } as never);
    vi.mocked(prisma.tournamentParticipant.aggregate).mockResolvedValue({
      _max: { displayOrder: 0 },
    } as never);
    vi.mocked(prisma.tournamentParticipant.create)
      .mockResolvedValueOnce(
        participantRow({
          id: "participant-gelb",
          externalClubId: "club-1",
          displayName: "Gelb",
          externalClub: externalClubRow("club-1", "AC Rossoneri"),
        }) as never,
      )
      .mockResolvedValueOnce(
        participantRow({
          id: "participant-e1",
          externalClubId: "club-1",
          displayName: "E1",
          externalClub: externalClubRow("club-1", "AC Rossoneri"),
        }) as never,
      );

    const first = await addTournamentParticipant(TENANT_A, TOURNAMENT_ID, {
      externalClubId: "club-1",
      displayName: "Gelb",
    });
    const second = await addTournamentParticipant(TENANT_A, TOURNAMENT_ID, {
      externalClubId: "club-1",
      displayName: "E1",
    });

    expect(first.id).not.toBe(second.id);
    expect(first.externalClub?.club.name).toBe("AC Rossoneri");
    expect(second.externalClub?.club.name).toBe("AC Rossoneri");
    expect(first.displayName).toBe("Gelb");
    expect(second.displayName).toBe("E1");
    // No duplicate-participant rejection for the shared externalClubId.
    expect(prisma.tournamentParticipant.create).toHaveBeenCalledTimes(2);
  });

  it("falls back cleanly to the canonical club name when displayName is blank (requirement 7)", async () => {
    vi.mocked(prisma.externalClub.findFirst).mockResolvedValue({ id: "club-1", archivedAt: null } as never);
    vi.mocked(prisma.tournamentParticipant.aggregate).mockResolvedValue({
      _max: { displayOrder: 0 },
    } as never);
    vi.mocked(prisma.tournamentParticipant.create).mockResolvedValue(
      participantRow({
        externalClubId: "club-1",
        displayName: null,
        externalClub: externalClubRow("club-1", "BSC Old Boys"),
      }) as never,
    );

    const result = await addTournamentParticipant(TENANT_A, TOURNAMENT_ID, {
      externalClubId: "club-1",
      displayName: "   ",
    });

    expect(result.displayName).toBe("BSC Old Boys");
    expect(result.externalClub?.rawDisplayName).toBeNull();
    // Blank displayName is stored as null, never as whitespace.
    expect(prisma.tournamentParticipant.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ displayName: null }) }),
    );
  });

  it("never mutates ExternalClub.name (requirement 8)", async () => {
    vi.mocked(prisma.externalClub.findFirst).mockResolvedValue({ id: "club-1", archivedAt: null } as never);
    vi.mocked(prisma.tournamentParticipant.aggregate).mockResolvedValue({
      _max: { displayOrder: 0 },
    } as never);
    vi.mocked(prisma.tournamentParticipant.create).mockResolvedValue(
      participantRow({
        externalClubId: "club-1",
        displayName: "Gelb",
        externalClub: externalClubRow("club-1", "AC Rossoneri"),
      }) as never,
    );

    await addTournamentParticipant(TENANT_A, TOURNAMENT_ID, { externalClubId: "club-1", displayName: "Gelb" });

    // The service has no update/write path onto ExternalClub at all — only
    // a read (findFirst) for tenant/archived validation.
    expect(prisma.externalClub.findFirst).toHaveBeenCalledTimes(1);
  });

  it("rejects an ExternalClub belonging to a different tenant (requirement 11)", async () => {
    vi.mocked(prisma.externalClub.findFirst).mockResolvedValue(null as never);

    await expect(
      addTournamentParticipant(TENANT_A, TOURNAMENT_ID, { externalClubId: "other-tenant-club" }),
    ).rejects.toThrow(TournamentParticipantTenantMismatchError);
    expect(prisma.tournamentParticipant.create).not.toHaveBeenCalled();
  });

  it("rejects an archived ExternalClub for new participant creation (requirement 12)", async () => {
    vi.mocked(prisma.externalClub.findFirst).mockResolvedValue({
      id: "club-archived",
      archivedAt: new Date("2026-08-08T00:00:00.000Z"),
    } as never);

    await expect(
      addTournamentParticipant(TENANT_A, TOURNAMENT_ID, { externalClubId: "club-archived" }),
    ).rejects.toThrow(TournamentParticipantValidationError);
    expect(prisma.tournamentParticipant.create).not.toHaveBeenCalled();
  });

  it("rejects displayName provided without externalClubId", async () => {
    await expect(
      addTournamentParticipant(TENANT_A, TOURNAMENT_ID, { teamId: "team-1", displayName: "Gelb" }),
    ).rejects.toThrow(TournamentParticipantValidationError);
  });
});

describe("updateTournamentParticipantDisplayName — Anzeigename edit (PART 6)", () => {
  it("updates the Anzeigename of an EXTERNAL_CLUB participant", async () => {
    vi.mocked(prisma.tournamentParticipant.findFirst).mockResolvedValue(
      participantRow({
        externalClubId: "club-1",
        displayName: "Gelb",
        externalClub: externalClubRow("club-1", "AC Rossoneri"),
      }) as never,
    );
    vi.mocked(prisma.tournamentParticipant.update).mockResolvedValue(
      participantRow({
        externalClubId: "club-1",
        displayName: "E1",
        externalClub: externalClubRow("club-1", "AC Rossoneri"),
      }) as never,
    );

    const result = await updateTournamentParticipantDisplayName(TENANT_A, "participant-1", "E1");

    expect(result.displayName).toBe("E1");
    expect(prisma.tournamentParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "participant-1" }, data: { displayName: "E1" } }),
    );
  });

  it("rejects editing displayName on a non-EXTERNAL_CLUB participant", async () => {
    vi.mocked(prisma.tournamentParticipant.findFirst).mockResolvedValue(
      participantRow({ teamId: "team-1", team: teamRow("team-1", "FC Allschwil E1") }) as never,
    );

    await expect(
      updateTournamentParticipantDisplayName(TENANT_A, "participant-1", "Gelb"),
    ).rejects.toThrow(TournamentParticipantValidationError);
    expect(prisma.tournamentParticipant.update).not.toHaveBeenCalled();
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

  // TOURNAMENTCENTER-UX-03 — requirement 10: a HISTORICAL externalTeamId-linked
  // participant remains fully readable, alongside NEW EXTERNAL_CLUB participants.
  it("lists a historical EXTERNAL_TEAM participant alongside new EXTERNAL_CLUB participants", async () => {
    const rows = [
      participantRow({ id: "p1", teamId: "team-e1", team: teamRow("team-e1", "FC Allschwil E1") }),
      participantRow({
        id: "p2",
        externalTeamId: "ext-oldboys",
        externalTeam: externalTeamRow("ext-oldboys", "BSC Old Boys E1", "club-oldboys", "BSC Old Boys"),
      }),
      participantRow({
        id: "p3",
        externalClubId: "club-rossoneri",
        displayName: "Gelb",
        externalClub: externalClubRow("club-rossoneri", "AC Rossoneri"),
      }),
      participantRow({
        id: "p4",
        externalClubId: "club-rossoneri",
        displayName: "E1",
        externalClub: externalClubRow("club-rossoneri", "AC Rossoneri"),
      }),
    ];
    vi.mocked(prisma.tournamentParticipant.findMany).mockResolvedValue(rows as never);

    const result = await listTournamentParticipants(TENANT_A, TOURNAMENT_ID);

    expect(result).toHaveLength(4);
    const historical = result.find((p) => p.id === "p2");
    expect(historical?.kind).toBe("EXTERNAL_TEAM");
    expect(historical?.externalTeam?.club.name).toBe("BSC Old Boys");
    const rossoneriParticipants = result.filter((p) => p.externalClub?.club.id === "club-rossoneri");
    expect(rossoneriParticipants).toHaveLength(2);
    expect(rossoneriParticipants.map((p) => p.displayName).sort()).toEqual(["E1", "Gelb"]);
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
