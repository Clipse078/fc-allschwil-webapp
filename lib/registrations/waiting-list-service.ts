/**
 * lib/registrations/waiting-list-service.ts
 *
 * REG-WAIT-01: Transactional service layer for the canonical Waiting List domain.
 *
 * Invariants enforced here:
 *   - Tenant isolation: Registration, Person, OrgUnit, TeamSeason, responsibleUser
 *     all validated against the same tenantId.
 *   - No duplicate active entries: at most one non-terminal WaitingListEntry
 *     per Registration at any time.
 *   - Scope consistency: exactly the FK matching scopeType is set.
 *   - Atomic transitions: Registration.status and WaitingListEntry mutations
 *     run in a single transaction where possible.
 *   - Placement safety: PlayerSquadMember uniqueness is enforced; non-player
 *     registrations do NOT create squad records.
 */

import { WaitingListStatus, WaitingListPriority, WaitingListScopeType, RegistrationType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenants/require-tenant";
import { logAction } from "@/lib/audit/log-action";
import { getWaitingListEntryForTenant } from "./waiting-list-queries";

// ── Constants ────────────────────────────────────────────────────────────────

const TERMINAL_STATUSES: WaitingListStatus[] = ["PLACED", "WITHDRAWN", "REJECTED", "ARCHIVED"];

// Registration types that represent a player wanting to join a team.
const PLAYER_REGISTRATION_TYPES: RegistrationType[] = [
  "PROBETRAINING",
  "SPIELERANMELDUNG",
];

// ── Input types ──────────────────────────────────────────────────────────────

export type CreateWaitingListEntryInput = {
  registrationId: string;
  scopeType: WaitingListScopeType;
  targetGroupId?: string | null;
  orgUnitId?: string | null;
  teamSeasonId?: string | null;
  priority?: WaitingListPriority;
  responsibleUserId?: string | null;
  reason?: string | null;
  internalNote?: string | null;
};

export type UpdateWaitingListEntryInput = {
  priority?: WaitingListPriority;
  responsibleUserId?: string | null;
  reason?: string | null;
  internalNote?: string | null;
  status?: WaitingListStatus;
};

export type PlaceWaitingListEntryInput = {
  teamSeasonId?: string | null;
};

// ── Scope validation ─────────────────────────────────────────────────────────

async function validateScope(
  tenantId: string,
  scopeType: WaitingListScopeType,
  targetGroupId: string | null | undefined,
  orgUnitId: string | null | undefined,
  teamSeasonId: string | null | undefined,
) {
  if (scopeType === "TARGET_GROUP") {
    if (!targetGroupId) throw new Error("targetGroupId ist erforderlich für Scope TARGET_GROUP.");
    const tg = await prisma.targetGroup.findFirst({
      where: { id: targetGroupId, OR: [{ tenantId }, { tenantId: null }] },
      select: { id: true },
    });
    if (!tg) throw new Error("Zielgruppe nicht gefunden oder gehört zu einem anderen Mandanten.");
  } else if (scopeType === "ORG_UNIT") {
    if (!orgUnitId) throw new Error("orgUnitId ist erforderlich für Scope ORG_UNIT.");
    const ou = await prisma.orgUnit.findFirst({
      where: { id: orgUnitId, OR: [{ tenantId }, { tenantId: null }] },
      select: { id: true },
    });
    if (!ou) throw new Error("Organisationseinheit nicht gefunden oder gehört zu einem anderen Mandanten.");
  } else if (scopeType === "TEAM_SEASON") {
    if (!teamSeasonId) throw new Error("teamSeasonId ist erforderlich für Scope TEAM_SEASON.");
    const ts = await prisma.teamSeason.findFirst({
      where: { id: teamSeasonId, team: { tenantId } },
      select: { id: true },
    });
    if (!ts) throw new Error("TeamSeason nicht gefunden oder gehört zu einem anderen Mandanten.");
  }
}

// ── CREATE ────────────────────────────────────────────────────────────────────

export async function createWaitingListEntry(
  tenantSlug: string,
  input: CreateWaitingListEntryInput,
  actorUserId: string | null = null,
) {
  const tenant = await requireTenant(tenantSlug);
  const tenantId = tenant.id;

  // Validate Registration belongs to this tenant.
  const registration = await prisma.registration.findFirst({
    where: { id: input.registrationId, tenantId },
    select: { id: true, status: true, personId: true, type: true },
  });
  if (!registration) {
    throw new Error("Anmeldung nicht gefunden oder gehört zu einem anderen Mandanten.");
  }

  // Check no active entry already exists.
  const existing = await prisma.waitingListEntry.findFirst({
    where: {
      tenantId,
      registrationId: input.registrationId,
      status: { notIn: TERMINAL_STATUSES },
    },
    select: { id: true, status: true },
  });
  if (existing) {
    throw new Error("Diese Anmeldung hat bereits einen aktiven Wartelisten-Eintrag.");
  }

  // Validate scope FK.
  await validateScope(tenantId, input.scopeType, input.targetGroupId, input.orgUnitId, input.teamSeasonId);

  // Validate responsible user belongs to this tenant.
  if (input.responsibleUserId) {
    const u = await prisma.user.findFirst({
      where: { id: input.responsibleUserId, tenantId },
      select: { id: true },
    });
    if (!u) throw new Error("Verantwortliche Person nicht gefunden oder gehört zu einem anderen Mandanten.");
  }

  // Transactional: create WaitingListEntry + update Registration status.
  const [entry] = await prisma.$transaction([
    prisma.waitingListEntry.create({
      data: {
        tenantId,
        registrationId: input.registrationId,
        personId: registration.personId ?? undefined,
        scopeType: input.scopeType,
        targetGroupId: input.scopeType === "TARGET_GROUP" ? (input.targetGroupId ?? null) : null,
        orgUnitId: input.scopeType === "ORG_UNIT" ? (input.orgUnitId ?? null) : null,
        teamSeasonId: input.scopeType === "TEAM_SEASON" ? (input.teamSeasonId ?? null) : null,
        status: "WAITING",
        priority: input.priority ?? "NORMAL",
        responsibleUserId: input.responsibleUserId ?? null,
        reason: input.reason ?? null,
        internalNote: input.internalNote ?? null,
        addedAt: new Date(),
        addedByUserId: actorUserId,
      },
      select: { id: true },
    }),
    prisma.registration.update({
      where: { id: input.registrationId },
      data: { status: "WAITING" },
      select: { id: true, status: true },
    }),
  ]);

  // Audit log for both entities.
  await Promise.all([
    logAction({
      actorUserId,
      moduleKey: "registrations",
      entityType: "WaitingListEntry",
      entityId: entry.id,
      action: "WAITING_LIST_CREATED",
      afterJson: {
        registrationId: input.registrationId,
        scopeType: input.scopeType,
        targetGroupId: input.targetGroupId ?? null,
        orgUnitId: input.orgUnitId ?? null,
        teamSeasonId: input.teamSeasonId ?? null,
        priority: input.priority ?? "NORMAL",
        responsibleUserId: input.responsibleUserId ?? null,
      },
    }),
    logAction({
      actorUserId,
      moduleKey: "registrations",
      entityType: "Registration",
      entityId: input.registrationId,
      action: "STATUS_CHANGE",
      beforeJson: { status: registration.status },
      afterJson: { status: "WAITING", waitingListEntryId: entry.id },
    }),
  ]);

  return getWaitingListEntryForTenant(tenantSlug, entry.id);
}

// ── UPDATE ────────────────────────────────────────────────────────────────────

export async function updateWaitingListEntry(
  tenantSlug: string,
  entryId: string,
  input: UpdateWaitingListEntryInput,
  actorUserId: string | null = null,
) {
  const tenant = await requireTenant(tenantSlug);
  const tenantId = tenant.id;

  const existing = await prisma.waitingListEntry.findFirst({
    where: { id: entryId, tenantId },
    select: { id: true, status: true, priority: true, responsibleUserId: true },
  });
  if (!existing) throw new Error("Wartelisten-Eintrag nicht gefunden.");

  if (TERMINAL_STATUSES.includes(existing.status)) {
    throw new Error("Abgeschlossene Wartelisten-Einträge können nicht mehr bearbeitet werden.");
  }

  // Validate responsible user.
  if (input.responsibleUserId !== undefined && input.responsibleUserId !== null) {
    const u = await prisma.user.findFirst({
      where: { id: input.responsibleUserId, tenantId },
      select: { id: true },
    });
    if (!u) throw new Error("Verantwortliche Person nicht gefunden oder gehört zu einem anderen Mandanten.");
  }

  // Compute lifecycle timestamps.
  const now = new Date();
  const statusData: Record<string, unknown> = {};
  if (input.status === "CONTACTED") statusData.lastContactedAt = now;
  if (input.status === "OFFERED") statusData.offeredAt = now;
  if (input.status && TERMINAL_STATUSES.includes(input.status)) {
    statusData.resolvedAt = now;
    statusData.resolvedByUserId = actorUserId;
  }

  const updated = await prisma.waitingListEntry.update({
    where: { id: entryId },
    data: {
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.responsibleUserId !== undefined && { responsibleUserId: input.responsibleUserId }),
      ...(input.reason !== undefined && { reason: input.reason }),
      ...(input.internalNote !== undefined && { internalNote: input.internalNote }),
      ...(input.status !== undefined && { status: input.status }),
      ...statusData,
    },
    select: { id: true },
  });

  await logAction({
    actorUserId,
    moduleKey: "registrations",
    entityType: "WaitingListEntry",
    entityId: entryId,
    action: input.status ? "WAITING_LIST_STATUS_CHANGE" : "WAITING_LIST_UPDATED",
    beforeJson: { status: existing.status, priority: existing.priority },
    afterJson: {
      status: input.status ?? existing.status,
      priority: input.priority ?? existing.priority,
      responsibleUserId: input.responsibleUserId,
    },
  });

  return getWaitingListEntryForTenant(tenantSlug, updated.id);
}

// ── PLACE ─────────────────────────────────────────────────────────────────────

export async function placeWaitingListEntry(
  tenantSlug: string,
  entryId: string,
  input: PlaceWaitingListEntryInput,
  actorUserId: string | null = null,
) {
  const tenant = await requireTenant(tenantSlug);
  const tenantId = tenant.id;

  const entry = await prisma.waitingListEntry.findFirst({
    where: { id: entryId, tenantId },
    select: {
      id: true,
      status: true,
      registrationId: true,
      personId: true,
      scopeType: true,
      teamSeasonId: true,
      registration: { select: { id: true, type: true, personId: true, status: true } },
    },
  });
  if (!entry) throw new Error("Wartelisten-Eintrag nicht gefunden.");
  if (TERMINAL_STATUSES.includes(entry.status)) {
    throw new Error("Dieser Eintrag wurde bereits abgeschlossen.");
  }

  // Determine effective personId — from WaitingListEntry or Registration.
  const effectivePersonId = entry.personId ?? entry.registration.personId;
  if (!effectivePersonId) {
    throw new Error(
      "Kein Person-Datensatz verknüpft. Bitte zuerst eine Person anlegen oder verknüpfen.",
    );
  }

  // Validate person belongs to this tenant.
  const person = await prisma.person.findFirst({
    where: { id: effectivePersonId, tenantId },
    select: { id: true, tenantId: true },
  });
  if (!person) {
    throw new Error("Person nicht gefunden oder gehört zu einem anderen Mandanten.");
  }

  // Determine target TeamSeason: prefer explicit input, fall back to entry's teamSeasonId.
  const targetTeamSeasonId = input.teamSeasonId ?? (entry.scopeType === "TEAM_SEASON" ? entry.teamSeasonId : null);

  let squadMemberId: string | null = null;

  // Only create squad membership for player-type registrations with a concrete TeamSeason.
  const isPlayerType = PLAYER_REGISTRATION_TYPES.includes(entry.registration.type);

  if (targetTeamSeasonId) {
    // Validate TeamSeason belongs to this tenant.
    const ts = await prisma.teamSeason.findFirst({
      where: { id: targetTeamSeasonId, team: { tenantId } },
      select: { id: true },
    });
    if (!ts) throw new Error("TeamSeason nicht gefunden oder gehört zu einem anderen Mandanten.");

    if (isPlayerType) {
      // Check for duplicate squad membership.
      const existingMember = await prisma.playerSquadMember.findUnique({
        where: { teamSeasonId_personId: { teamSeasonId: targetTeamSeasonId, personId: effectivePersonId } },
        select: { id: true },
      });
      if (existingMember) {
        throw new Error("Diese Person ist bereits Mitglied in diesem Team.");
      }

      // Create squad membership.
      const now = new Date();
      const [squadMember] = await prisma.$transaction([
        prisma.playerSquadMember.create({
          data: {
            teamSeasonId: targetTeamSeasonId,
            personId: effectivePersonId,
            status: "ACTIVE",
          },
          select: { id: true },
        }),
        prisma.waitingListEntry.update({
          where: { id: entryId },
          data: {
            status: "PLACED",
            resolvedAt: now,
            resolvedByUserId: actorUserId,
            personId: effectivePersonId,
          },
          select: { id: true },
        }),
        prisma.registration.update({
          where: { id: entry.registrationId },
          data: { status: "ACCEPTED", personId: effectivePersonId },
          select: { id: true },
        }),
      ]);
      squadMemberId = squadMember.id;
    } else {
      // Non-player: place without squad membership.
      const now = new Date();
      await prisma.$transaction([
        prisma.waitingListEntry.update({
          where: { id: entryId },
          data: { status: "PLACED", resolvedAt: now, resolvedByUserId: actorUserId, personId: effectivePersonId },
          select: { id: true },
        }),
        prisma.registration.update({
          where: { id: entry.registrationId },
          data: { status: "ACCEPTED", personId: effectivePersonId },
          select: { id: true },
        }),
      ]);
    }
  } else {
    // No TeamSeason: mark placed without squad assignment.
    const now = new Date();
    await prisma.$transaction([
      prisma.waitingListEntry.update({
        where: { id: entryId },
        data: { status: "PLACED", resolvedAt: now, resolvedByUserId: actorUserId, personId: effectivePersonId },
        select: { id: true },
      }),
      prisma.registration.update({
        where: { id: entry.registrationId },
        data: { status: "ACCEPTED", personId: effectivePersonId },
        select: { id: true },
      }),
    ]);
  }

  // Audit.
  await Promise.all([
    logAction({
      actorUserId,
      moduleKey: "registrations",
      entityType: "WaitingListEntry",
      entityId: entryId,
      action: "WAITING_LIST_PLACED",
      afterJson: { personId: effectivePersonId, teamSeasonId: targetTeamSeasonId, squadMemberId },
    }),
    logAction({
      actorUserId,
      moduleKey: "registrations",
      entityType: "Registration",
      entityId: entry.registrationId,
      action: "STATUS_CHANGE",
      beforeJson: { status: entry.registration.status },
      afterJson: { status: "ACCEPTED", waitingListEntryId: entryId },
    }),
  ]);

  return getWaitingListEntryForTenant(tenantSlug, entryId);
}

// ── HARD DELETE ───────────────────────────────────────────────────────────────

export async function deleteWaitingListEntryPermanently(
  tenantId: string,
  entryId: string,
): Promise<{ label: string } | null> {
  const entry = await prisma.waitingListEntry.findFirst({
    where: { id: entryId, tenantId },
    select: {
      id: true,
      registrationId: true,
      registration: { select: { firstName: true, lastName: true } },
    },
  });
  if (!entry) return null;

  const label = `${entry.registration.firstName} ${entry.registration.lastName}`;

  await prisma.waitingListEntry.delete({ where: { id: entryId } });

  return { label };
}

export async function getWaitingListDeletionImpact(
  tenantId: string,
  entryId: string,
): Promise<{ registrationLabel: string; status: string } | null> {
  const entry = await prisma.waitingListEntry.findFirst({
    where: { id: entryId, tenantId },
    select: {
      status: true,
      registration: { select: { firstName: true, lastName: true } },
    },
  });
  if (!entry) return null;
  return {
    registrationLabel: `${entry.registration.firstName} ${entry.registration.lastName}`,
    status: entry.status,
  };
}
