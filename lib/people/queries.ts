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

export type PersonListItem = Awaited<ReturnType<typeof getPersons>>[number];
export type PersonDetail = NonNullable<Awaited<ReturnType<typeof getPersonById>>>;
export type PersonDirectoryItem = Awaited<ReturnType<typeof getPersonsForDirectory>>[number];
export type PersonAssignment = Awaited<ReturnType<typeof getPersonAssignments>>[number];
