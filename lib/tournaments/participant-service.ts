/**
 * lib/tournaments/participant-service.ts
 *
 * TOURNAMENTCENTER-01B — canonical multi-team participation domain service.
 *
 * Manages which Teams / ExternalTeams (or, as a smallest clean fallback, a
 * free-text manual label) participate in a canonical Tournament (Event,
 * type=TOURNAMENT).
 *
 * Architecture:
 *   Event (TOURNAMENT) → TournamentParticipant → Team | ExternalTeam | manualLabel
 *
 * Canonical principles:
 *   - A tournament may hold any number of participants — no arbitrary
 *     maximum (typical tournaments have 4+, and there is no upper bound).
 *   - Participants may be tenant-owned canonical Teams and Club-Directory
 *     ExternalTeams together, in any mix.
 *   - Duplicate participation (the same Team or ExternalTeam added twice to
 *     the same tournament) is rejected.
 *   - manualLabel is the smallest clean fallback for a genuinely unknown
 *     team with no canonical Team/ExternalTeam yet — never a second/parallel
 *     team identity model. Exactly one of teamId / externalTeamId /
 *     manualLabel must be provided per participant.
 *
 * Security invariants:
 *   - tenantId always comes from a trusted session context — never from input.
 *   - All DB queries are scoped by tenantId (Team, ExternalTeam AND the
 *     tournament itself) — tenant A cannot read or modify tenant B's
 *     participants, and cannot attach tenant B's Team/ExternalTeam to its
 *     own tournament.
 */

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { CreateTournamentParticipantInput, TournamentParticipantDto } from "./types";
import {
  TournamentNotFoundError,
  TournamentParticipantNotFoundError,
  TournamentParticipantValidationError,
  TournamentParticipantDuplicateError,
  TournamentParticipantTenantMismatchError,
} from "./errors";

// TOURNAMENTCENTER-UX-03: canonical external-participant identity for NEW
// participants is a Club-Directory ExternalClub (+ tournament-specific
// Anzeigename), not an ExternalTeam. externalTeamId stays fully supported
// for HISTORICAL rows only — see the mutual-exclusivity + toDto handling
// below.

// ── Row type + include (mirrors lib/tournaments/queries.ts's participant shape) ─

const participantInclude = {
  team: {
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      genderGroup: true,
      ageGroup: true,
    },
  },
  externalTeam: {
    select: {
      id: true,
      name: true,
      shortName: true,
      categoryLabel: true,
      externalClub: { select: { id: true, name: true, shortName: true } },
    },
  },
  externalClub: {
    select: { id: true, name: true, shortName: true },
  },
  dressingRoomAllocations: {
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      notes: true,
      displayOrder: true,
      facilityResource: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          facilityId: true,
          facility: { select: { name: true } },
        },
      },
    },
  },
  // `satisfies` (not `as const`) — the nested `orderBy` array above must
  // stay an ordinary mutable array to match Prisma's
  // TournamentParticipantAllocationOrderByWithRelationInput[] type.
} satisfies Prisma.TournamentParticipantInclude;

type ParticipantRow = {
  id: string;
  eventId: string;
  teamId: string | null;
  externalTeamId: string | null;
  externalClubId: string | null;
  displayName: string | null;
  manualLabel: string | null;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
  team: {
    id: string;
    name: string;
    slug: string;
    category: string;
    genderGroup: string | null;
    ageGroup: string | null;
  } | null;
  externalTeam: {
    id: string;
    name: string;
    shortName: string | null;
    categoryLabel: string | null;
    externalClub: { id: string; name: string; shortName: string | null };
  } | null;
  externalClub: { id: string; name: string; shortName: string | null } | null;
  dressingRoomAllocations: Array<{
    id: string;
    notes: string | null;
    displayOrder: number;
    facilityResource: {
      id: string;
      code: string;
      name: string;
      type: string;
      facilityId: string;
      facility: { name: string };
    };
  }>;
};

function toDto(row: ParticipantRow): TournamentParticipantDto {
  const dressingRoomAllocations = row.dressingRoomAllocations.map((allocation) => ({
    id: allocation.id,
    facilityResourceId: allocation.facilityResource.id,
    facilityResourceCode: allocation.facilityResource.code,
    facilityResourceName: allocation.facilityResource.name,
    facilityResourceType: allocation.facilityResource.type,
    facilityId: allocation.facilityResource.facilityId,
    facilityName: allocation.facilityResource.facility.name,
    notes: allocation.notes,
    displayOrder: allocation.displayOrder,
  }));

  if (row.team) {
    return {
      id: row.id,
      tournamentId: row.eventId,
      kind: "TEAM",
      displayName: row.team.name,
      team: row.team,
      externalTeam: null,
      externalClub: null,
      manualLabel: null,
      displayOrder: row.displayOrder,
      dressingRoomAllocations,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // TOURNAMENTCENTER-UX-03 — canonical NEW external-participant kind.
  if (row.externalClub) {
    const rawDisplayName = row.displayName?.trim() || null;
    return {
      id: row.id,
      tournamentId: row.eventId,
      kind: "EXTERNAL_CLUB",
      displayName: rawDisplayName ?? row.externalClub.name,
      team: null,
      externalTeam: null,
      externalClub: {
        club: {
          id: row.externalClub.id,
          name: row.externalClub.name,
          shortName: row.externalClub.shortName,
        },
        rawDisplayName,
      },
      manualLabel: null,
      displayOrder: row.displayOrder,
      dressingRoomAllocations,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // HISTORICAL ONLY — rows created before TOURNAMENTCENTER-UX-03. Never
  // written by new participant creation; remains fully readable here.
  if (row.externalTeam) {
    return {
      id: row.id,
      tournamentId: row.eventId,
      kind: "EXTERNAL_TEAM",
      displayName: row.externalTeam.name,
      team: null,
      externalTeam: {
        id: row.externalTeam.id,
        name: row.externalTeam.name,
        shortName: row.externalTeam.shortName,
        categoryLabel: row.externalTeam.categoryLabel,
        club: row.externalTeam.externalClub,
      },
      externalClub: null,
      manualLabel: null,
      displayOrder: row.displayOrder,
      dressingRoomAllocations,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  return {
    id: row.id,
    tournamentId: row.eventId,
    kind: "MANUAL",
    displayName: row.manualLabel ?? "Unbenannt",
    team: null,
    externalTeam: null,
    externalClub: null,
    manualLabel: row.manualLabel,
    displayOrder: row.displayOrder,
    dressingRoomAllocations,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── Private helpers ───────────────────────────────────────────────────────────

async function requireTournament(tenantId: string, tournamentId: string): Promise<void> {
  const event = await prisma.event.findFirst({
    where: { id: tournamentId, tenantId, type: "TOURNAMENT" },
    select: { id: true },
  });
  if (!event) throw new TournamentNotFoundError(tournamentId);
}

async function requireParticipant(
  tenantId: string,
  participantId: string,
): Promise<ParticipantRow> {
  const participant = await prisma.tournamentParticipant.findFirst({
    where: { id: participantId, tenantId },
    include: participantInclude,
  });
  if (!participant) throw new TournamentParticipantNotFoundError(participantId);
  return participant as unknown as ParticipantRow;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Lists all participants of a tournament, ordered by displayOrder.
 *
 * @throws {TournamentNotFoundError} Not found, cross-tenant, or not a TOURNAMENT event.
 */
export async function listTournamentParticipants(
  tenantId: string,
  tournamentId: string,
): Promise<TournamentParticipantDto[]> {
  await requireTournament(tenantId, tournamentId);

  const rows = await prisma.tournamentParticipant.findMany({
    where: { tenantId, eventId: tournamentId },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    include: participantInclude,
  });

  return (rows as unknown as ParticipantRow[]).map(toDto);
}

/**
 * Adds a participant (Team, ExternalClub, ExternalTeam, or manual fallback)
 * to a tournament.
 *
 * Validates:
 *   - Tournament must exist for the tenant and be type=TOURNAMENT.
 *   - Exactly one of teamId / externalTeamId / externalClubId / manualLabel
 *     must be set. `externalTeamId` is HISTORICAL ONLY — new participants
 *     should use `externalClubId` (+ optional `displayName`) instead.
 *   - `displayName` is only valid together with `externalClubId`.
 *   - Team/ExternalTeam/ExternalClub must belong to the same tenant as the
 *     tournament, and an ExternalClub must not be archived.
 *   - No duplicate participation of the same Team/ExternalTeam.
 *     `externalClubId` is deliberately NOT unique per tournament — the same
 *     canonical club may participate multiple times with distinct
 *     displayName values (e.g. "AC Rossoneri" + "Gelb" and "AC Rossoneri" +
 *     "E1" as two separate participants).
 *
 * @throws {TournamentNotFoundError}
 * @throws {TournamentParticipantValidationError}
 * @throws {TournamentParticipantTenantMismatchError}
 * @throws {TournamentParticipantDuplicateError}
 */
export async function addTournamentParticipant(
  tenantId: string,
  tournamentId: string,
  input: CreateTournamentParticipantInput,
): Promise<TournamentParticipantDto> {
  await requireTournament(tenantId, tournamentId);

  const teamId = input.teamId?.trim() || undefined;
  const externalTeamId = input.externalTeamId?.trim() || undefined;
  const externalClubId = input.externalClubId?.trim() || undefined;
  const manualLabel = input.manualLabel?.trim() || undefined;
  const displayName = input.displayName?.trim() || undefined;

  const providedCount = [teamId, externalTeamId, externalClubId, manualLabel].filter(Boolean).length;
  if (providedCount !== 1) {
    throw new TournamentParticipantValidationError(
      "Exactly one of teamId, externalTeamId, externalClubId, or manualLabel must be provided.",
    );
  }

  if (displayName !== undefined && !externalClubId) {
    throw new TournamentParticipantValidationError(
      "displayName is only valid together with externalClubId.",
    );
  }

  if (teamId) {
    const team = await prisma.team.findFirst({ where: { id: teamId, tenantId }, select: { id: true } });
    if (!team) {
      throw new TournamentParticipantTenantMismatchError("teamId does not belong to this tenant");
    }
  }

  if (externalTeamId) {
    const externalTeam = await prisma.externalTeam.findFirst({
      where: { id: externalTeamId, tenantId },
      select: { id: true },
    });
    if (!externalTeam) {
      throw new TournamentParticipantTenantMismatchError(
        "externalTeamId does not belong to this tenant",
      );
    }
  }

  if (externalClubId) {
    const externalClub = await prisma.externalClub.findFirst({
      where: { id: externalClubId, tenantId },
      select: { id: true, archivedAt: true },
    });
    if (!externalClub) {
      throw new TournamentParticipantTenantMismatchError(
        "externalClubId does not belong to this tenant",
      );
    }
    if (externalClub.archivedAt) {
      throw new TournamentParticipantValidationError(
        "externalClubId refers to an archived club and cannot be added as a new participant.",
      );
    }
  }

  let displayOrder = input.displayOrder;
  if (displayOrder === undefined) {
    const maxRow = await prisma.tournamentParticipant.aggregate({
      where: { eventId: tournamentId },
      _max: { displayOrder: true },
    });
    displayOrder = (maxRow._max.displayOrder ?? -1) + 1;
  }

  try {
    const created = await prisma.tournamentParticipant.create({
      data: {
        tenantId,
        eventId: tournamentId,
        teamId: teamId ?? null,
        externalTeamId: externalTeamId ?? null,
        externalClubId: externalClubId ?? null,
        displayName: displayName ?? null,
        manualLabel: manualLabel ?? null,
        displayOrder,
      },
      include: participantInclude,
    });

    return toDto(created as unknown as ParticipantRow);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Unique constraint")) {
      throw new TournamentParticipantDuplicateError(
        teamId
          ? `Team "${teamId}" already participates in this tournament.`
          : `ExternalTeam "${externalTeamId}" already participates in this tournament.`,
      );
    }
    throw err;
  }
}

/**
 * Updates the tournament-specific Anzeigename ("displayName") of an
 * EXTERNAL_CLUB participant. Never touches ExternalClub.name/ExternalTeam.name
 * — this is purely the participant-level override.
 *
 * @throws {TournamentParticipantNotFoundError}
 * @throws {TournamentParticipantValidationError} Participant is not an EXTERNAL_CLUB kind.
 */
export async function updateTournamentParticipantDisplayName(
  tenantId: string,
  participantId: string,
  displayName: string | null,
): Promise<TournamentParticipantDto> {
  const existing = await requireParticipant(tenantId, participantId);

  if (!existing.externalClubId) {
    throw new TournamentParticipantValidationError(
      "displayName can only be edited for an ExternalClub participant.",
    );
  }

  const updated = await prisma.tournamentParticipant.update({
    where: { id: participantId },
    data: { displayName: displayName?.trim() || null },
    include: participantInclude,
  });

  return toDto(updated as unknown as ParticipantRow);
}

/**
 * Removes a participant from a tournament. Cascades to its dressing-room
 * allocations (TournamentParticipantAllocation), enforced by the DB FK.
 *
 * @throws {TournamentParticipantNotFoundError}
 */
export async function removeTournamentParticipant(
  tenantId: string,
  participantId: string,
): Promise<void> {
  await requireParticipant(tenantId, participantId);
  await prisma.tournamentParticipant.delete({ where: { id: participantId } });
}

/**
 * Retrieves a single participant by id.
 *
 * @throws {TournamentParticipantNotFoundError}
 */
export async function getTournamentParticipant(
  tenantId: string,
  participantId: string,
): Promise<TournamentParticipantDto> {
  return toDto(await requireParticipant(tenantId, participantId));
}
