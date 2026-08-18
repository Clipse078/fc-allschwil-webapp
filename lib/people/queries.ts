/**
 * People query helpers — server-only.
 *
 * PERSONS-01/02-C1: Updated to use dedicated PersonAssignment model.
 * Person.tenantId is now NOT NULL — all queries require exact tenantId.
 */

import { prisma } from "@/lib/db/prisma";
import { PersonAssignmentStatus } from "@prisma/client";

// ── Shared select shapes ──────────────────────────────────────────────────────

const PERSON_ASSIGNMENT_SELECT = {
  id: true,
  orgUnitId: true,
  teamId: true,
  seasonId: true,
  functionKey: true,
  status: true,
  notes: true,
  orgUnit: { select: { id: true, name: true, key: true } },
  team: { select: { id: true, name: true, shortName: true } },
  season: { select: { id: true, name: true, key: true } },
} as const;

// ── Directory list ────────────────────────────────────────────────────────────

export type PersonListFilter = {
  query?: string;
  orgUnitId?: string;
  teamId?: string;
  functionKey?: string;
  status?: "active" | "inactive";
  quickFilter?: "spieler" | "trainer_staff" | "vereinsleitung" | "freiwillige" | "ohne_zuordnung";
};

import { PERSON_FUNCTION_GROUPS } from "./functions";

export async function getPersonsForDirectory(tenantId: string, filter: PersonListFilter = {}) {
  const { query, orgUnitId, teamId, functionKey, status, quickFilter } = filter;

  // Build function key set for quick filters
  let functionKeys: string[] | null = null;
  if (quickFilter === "spieler") {
    functionKeys = [...PERSON_FUNCTION_GROUPS.SPIELER];
  } else if (quickFilter === "trainer_staff") {
    functionKeys = [...PERSON_FUNCTION_GROUPS.TRAINER_STAFF];
  } else if (quickFilter === "vereinsleitung") {
    functionKeys = [...PERSON_FUNCTION_GROUPS.VEREINSLEITUNG];
  } else if (quickFilter === "freiwillige") {
    functionKeys = [...PERSON_FUNCTION_GROUPS.FREIWILLIGE];
  } else if (functionKey) {
    functionKeys = [functionKey];
  }

  const persons = await prisma.person.findMany({
    where: {
      tenantId, // strict tenant isolation — no null fallback
      ...(status === "active" ? { isActive: true } : {}),
      ...(status === "inactive" ? { isActive: false } : {}),
      ...(query ? {
        OR: [
          { firstName: { contains: query, mode: "insensitive" as const } },
          { lastName: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
          { displayName: { contains: query, mode: "insensitive" as const } },
        ],
      } : {}),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      email: true,
      phone: true,
      imageUrl: true,
      isActive: true,
      isPlayer: true,
      isTrainer: true,
      personAssignments: {
        where: {
          tenantId,
          status: PersonAssignmentStatus.ACTIVE,
          ...(orgUnitId ? { orgUnitId } : {}),
          ...(teamId ? { teamId } : {}),
          ...(functionKeys ? { functionKey: { in: functionKeys } } : {}),
        },
        select: PERSON_ASSIGNMENT_SELECT,
      },
    },
  });

  // Post-filter: when scoped filters are active, only include persons with matching assignments
  const filtered = persons.filter((p) => {
    if (quickFilter === "ohne_zuordnung") {
      return p.personAssignments.length === 0;
    }
    if (orgUnitId || teamId || functionKeys) {
      return p.personAssignments.length > 0;
    }
    return true;
  });

  return filtered.map((p) => ({
    id: p.id,
    name: p.displayName || `${p.firstName} ${p.lastName}`,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    phone: p.phone,
    imageUrl: p.imageUrl,
    isActive: p.isActive,
    isPlayer: p.isPlayer,
    isTrainer: p.isTrainer,
    assignments: p.personAssignments,
  }));
}

// ── Legacy (non-tenant-scoped, for backward compat with older code) ───────────

export async function getPersons() {
  const persons = await prisma.person.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      email: true,
      phone: true,
      imageUrl: true,
      isActive: true,
      isPlayer: true,
      isTrainer: true,
    },
  });

  return persons.map((p) => ({
    id: p.id,
    name: p.displayName || `${p.firstName} ${p.lastName}`,
    email: p.email,
    phone: p.phone,
    imageUrl: p.imageUrl,
    isActive: p.isActive,
    isPlayer: p.isPlayer,
    isTrainer: p.isTrainer,
  }));
}

// ── Detail ─────────────────────────────────────────────────────────────────

export async function getPersonById(id: string) {
  return prisma.person.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      email: true,
      phone: true,
      dateOfBirth: true,
      notes: true,
      imageUrl: true,
      isActive: true,
      isPlayer: true,
      isTrainer: true,
      // PERSON-UX-07: standard capacity flags
      isFunctionary: true,
      isVolunteer: true,
      isReferee: true,
      isSponsorContact: true,
      customFunctions: true,
      tenantId: true,
      createdAt: true,
      updatedAt: true,
      // Address fields
      street: true,
      houseNumber: true,
      postalCode: true,
      city: true,
      country: true,
      // Guardian fields
      guardianFirstName: true,
      guardianLastName: true,
      guardianEmail: true,
      guardianPhone: true,
      // ADMIN-MASTERDATA-UX-01: canonical, explicit Person <-> User link
      userId: true,
      user: {
        select: { id: true, email: true, isActive: true },
      },
    },
  });
}

// ── Assignments ───────────────────────────────────────────────────────────────

export async function getPersonAssignments(personId: string) {
  return prisma.personAssignment.findMany({
    where: { personId },
    orderBy: [
      { status: "asc" },
      { orgUnit: { name: "asc" } },
      { createdAt: "asc" },
    ],
    select: {
      ...PERSON_ASSIGNMENT_SELECT,
      tenantId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// ── OrgUnit + Team + Season options for pickers ───────────────────────────────

export async function getOrgUnitsForTenant(tenantId: string) {
  return prisma.orgUnit.findMany({
    where: {
      OR: [{ tenantId }, { tenantId: null }],
      status: "ACTIVE",
    },
    orderBy: [{ level: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      key: true,
      type: true,
      level: true,
      parentId: true,
    },
  });
}

export async function getTeamsForTenant(tenantId: string) {
  return prisma.team.findMany({
    where: {
      OR: [{ tenantId }, { tenantId: null }],
      isActive: true,
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      shortName: true,
      orgUnitId: true,
      teamSeasons: {
        where: {
          season: { isActive: true },
        },
        select: {
          id: true,
          seasonId: true,
          orgUnits: {
            select: { orgUnitId: true },
          },
        },
        take: 1,
      },
    },
  });
}

export async function getActiveSeasonForTenant(_tenantId: string) {
  return prisma.season.findFirst({
    where: { isActive: true },
    select: { id: true, name: true, key: true },
  });
}

// ── Duplicate awareness ──────────────────────────────────────────────────────

export async function findDuplicateCandidates(
  tenantId: string,
  firstName: string,
  lastName: string,
  email?: string | null,
): Promise<Array<{ id: string; name: string; email: string | null }>> {
  const nameCondition = {
    firstName: { equals: firstName, mode: "insensitive" as const },
    lastName: { equals: lastName, mode: "insensitive" as const },
  };

  const conditions = email
    ? [nameCondition, { email: { equals: email, mode: "insensitive" as const } }]
    : [nameCondition];

  const candidates = await prisma.person.findMany({
    where: {
      tenantId, // strict tenant isolation
      OR: conditions,
    },
    select: { id: true, firstName: true, lastName: true, displayName: true, email: true },
    take: 5,
  });

  return candidates.map((c) => ({
    id: c.id,
    name: c.displayName || `${c.firstName} ${c.lastName}`,
    email: c.email,
  }));
}

// ── User linking ─────────────────────────────────────────────────────────────

/**
 * DASHBOARD-SHELL-UX-01-C1 — resolves the first name of the Person canonically
 * linked to a User.
 */
export async function getPersonFirstNameByUserId(userId: string): Promise<string | null> {
  const person = await prisma.person.findUnique({
    where: { userId },
    select: { firstName: true },
  });
  return person?.firstName?.trim() || null;
}

/**
 * DASHBOARD-SHELL-UX-01-C2 — resolves the full name of the Person canonically
 * linked to a User.
 */
export async function getPersonNameByUserId(
  userId: string,
): Promise<{ firstName: string; lastName: string } | null> {
  const person = await prisma.person.findUnique({
    where: { userId },
    select: { firstName: true, lastName: true },
  });
  const firstName = person?.firstName?.trim();
  if (!firstName) return null;
  return { firstName, lastName: person?.lastName?.trim() || "" };
}

/**
 * Returns the linked Person's name AND imageUrl for a given userId.
 * Used by the admin shell layout to display the correct avatar everywhere.
 */
export async function getPersonProfileByUserId(
  userId: string,
): Promise<{ firstName: string; lastName: string; imageUrl: string | null } | null> {
  const person = await prisma.person.findUnique({
    where: { userId },
    select: { firstName: true, lastName: true, imageUrl: true },
  });
  const firstName = person?.firstName?.trim();
  if (!firstName) return null;
  return {
    firstName,
    lastName: person?.lastName?.trim() || "",
    imageUrl: person?.imageUrl ?? null,
  };
}

// ── Squad / trainer memberships (for Person 360° workspace) ──────────────────

/**
 * PERSON-UX-01: Returns all PlayerSquadMember records for this person,
 * ordered by season start date desc (most recent first).
 *
 * Season-trustworthiness: PlayerSquadMember → TeamSeason → Season is a fully
 * persisted historical chain. Each squad membership record is its own row and
 * does NOT disappear when the current season changes.
 */
export async function getPersonSquadMemberships(personId: string) {
  return prisma.playerSquadMember.findMany({
    where: { personId },
    orderBy: [{ teamSeason: { season: { startDate: "desc" } } }],
    select: {
      id: true,
      status: true,
      shirtNumber: true,
      positionLabel: true,
      isCaptain: true,
      isViceCaptain: true,
      remarks: true,
      teamSeason: {
        select: {
          id: true,
          displayName: true,
          shortName: true,
          participationType: true,
          team: { select: { id: true, name: true, shortName: true } },
          season: { select: { id: true, name: true, key: true, isActive: true, startDate: true, endDate: true } },
        },
      },
    },
  });
}

/**
 * PERSON-UX-01: Returns all TrainerTeamMember records for this person,
 * ordered by season start date desc (most recent first).
 */
export async function getPersonTrainerMemberships(personId: string) {
  return prisma.trainerTeamMember.findMany({
    where: { personId },
    orderBy: [{ teamSeason: { season: { startDate: "desc" } } }],
    select: {
      id: true,
      status: true,
      roleLabel: true,
      remarks: true,
      teamSeason: {
        select: {
          id: true,
          displayName: true,
          shortName: true,
          team: { select: { id: true, name: true, shortName: true } },
          season: { select: { id: true, name: true, key: true, isActive: true, startDate: true, endDate: true } },
        },
      },
    },
  });
}

// ── Club memberships (PERSON-UX-04) ──────────────────────────────────────────

/**
 * PERSON-UX-04: Returns all PersonMembership records for this person,
 * ordered newest first (most recent startsAt desc).
 *
 * Historical records are returned permanently — ENDED memberships remain
 * visible. The caller is responsible for distinguishing current vs historical.
 */
export async function getPersonMemberships(personId: string) {
  return prisma.personMembership.findMany({
    where: { personId },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      tenantId: true,
      personId: true,
      membershipType: true,
      status: true,
      memberNumber: true,
      startsAt: true,
      endsAt: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// ── PERSON-UX-05/06: Assessment queries ──────────────────────────────────────

/**
 * Returns all development assessments for a person, newest first.
 * Includes full rating list with criterion snapshots.
 * PERSON-UX-06: Includes ratingModeSnapshot, rawValue, rawLabelSnapshot.
 * Caller is responsible for verifying read authorization before calling.
 */
export async function getPersonAssessments(personId: string, tenantId: string) {
  return prisma.developmentAssessment.findMany({
    where: { personId, tenantId },
    orderBy: [{ assessedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      tenantId: true,
      personId: true,
      seasonId: true,
      teamSeasonId: true,
      assessedAt: true,
      assessorUserId: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      season: { select: { id: true, name: true, key: true, isActive: true } },
      teamSeason: {
        select: {
          id: true,
          team: { select: { id: true, name: true, shortName: true } },
        },
      },
      assessor: { select: { id: true, firstName: true, lastName: true } },
      ratings: {
        select: {
          id: true,
          criterionId: true,
          normalizedScore: true,
          criterionNameSnapshot: true,
          criterionCategorySnapshot: true,
          ratingModeSnapshot: true,
          rawValue: true,
          rawLabelSnapshot: true,
          comment: true,
          createdAt: true,
        },
        orderBy: [
          { criterionCategorySnapshot: "asc" },
          { criterionNameSnapshot: "asc" },
        ],
      },
    },
  });
}

/**
 * Returns active DevelopmentCriteria for a tenant, sorted for display.
 * Used when populating assessment create/edit forms.
 * PERSON-UX-06: Includes ratingMode, qualitativeLabels, benchmark flags.
 */
export async function getTenantActiveCriteria(tenantId: string) {
  return prisma.developmentCriterion.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      sortOrder: true,
      ratingMode: true,
      qualitativeLabels: true,
      showTeamBenchmark: true,
      showJahrgangBenchmark: true,
    },
  });
}

/**
 * Returns ALL (active + inactive) DevelopmentCriteria for a tenant.
 * Used in admin criterion management.
 * PERSON-UX-06: Includes ratingMode, qualitativeLabels, benchmark flags.
 */
export async function getTenantAllCriteria(tenantId: string) {
  return prisma.developmentCriterion.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      sortOrder: true,
      isActive: true,
      ratingMode: true,
      qualitativeLabels: true,
      showTeamBenchmark: true,
      showJahrgangBenchmark: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// ── PersonDocument ─────────────────────────────────────────────────────────
// PERSON-UX-07: server-side pre-fetch for the Dokumente tab.
// Only called when viewer holds people.private_documents.view.
// storageKey and storageUrl are NOT returned here; those fields
// are only accessed internally by the document service.

export async function getPersonDocuments(personId: string, tenantId: string) {
  return prisma.personDocument.findMany({
    where: { personId, tenantId },
    orderBy: [{ category: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      personId: true,
      tenantId: true,
      category: true,
      title: true,
      originalFilename: true,
      mimeType: true,
      sizeBytes: true,
      issueDate: true,
      expiryDate: true,
      notes: true,
      uploadedByUserId: true,
      createdAt: true,
      updatedAt: true,
      // storageKey and storageUrl intentionally excluded — never sent to client
    },
  });
}

export type PersonListItem = Awaited<ReturnType<typeof getPersons>>[number];
export type PersonDetail = NonNullable<Awaited<ReturnType<typeof getPersonById>>>;
export type PersonDirectoryItem = Awaited<ReturnType<typeof getPersonsForDirectory>>[number];
export type PersonAssignment = Awaited<ReturnType<typeof getPersonAssignments>>[number];
export type PersonSquadMembership = Awaited<ReturnType<typeof getPersonSquadMemberships>>[number];
export type PersonTrainerMembership = Awaited<ReturnType<typeof getPersonTrainerMemberships>>[number];
export type PersonMembershipRecord = Awaited<ReturnType<typeof getPersonMemberships>>[number];
export type PersonAssessmentRecord = Awaited<ReturnType<typeof getPersonAssessments>>[number];
export type PersonDocumentItem = Awaited<ReturnType<typeof getPersonDocuments>>[number];
export type TenantCriterion = Awaited<ReturnType<typeof getTenantActiveCriteria>>[number];
export type TenantCriterionAdmin = Awaited<ReturnType<typeof getTenantAllCriteria>>[number];
