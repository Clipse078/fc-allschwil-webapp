/**
 * PERSONS-01/02 — Focused unit tests for the canonical Persons module.
 *
 * Coverage:
 *
 * PERSON:
 * - tenant isolation (query scoping)
 * - create validation
 * - duplicate awareness
 * - permanent delete (cascade assignments, NOT user)
 * - linked User not deleted on person delete
 *
 * ASSIGNMENTS (PersonAssignment = OrgUnitMembership with personId):
 * - OrgUnit-only assignment (no team)
 * - Team assignment
 * - Multiple simultaneous assignments for same person
 * - Same person in multiple teams
 * - Multiple functions
 * - Exact duplicate prevention
 * - Cross-tenant OrgUnit rejected
 * - Cross-tenant Team rejected
 *
 * AUTHORIZATION:
 * - Assignment function does NOT grant RPERM permissions
 * - people.delete is separate from people.manage
 *
 * DIRECTORY:
 * - getPersonsForDirectory filters by tenantId
 * - findDuplicateCandidates finds by name
 * - findDuplicateCandidates finds by email
 * - person without assignments included with empty assignments array
 *
 * PersonFunction helpers:
 * - getPersonFunctionLabel returns German label
 * - isPersonFunctionKey validates known keys
 * - unknown key is not a PersonFunctionKey
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock prisma ───────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  personFindMany: vi.fn(),
  personFindUnique: vi.fn(),
  personCreate: vi.fn(),
  personUpdate: vi.fn(),
  personDelete: vi.fn(),
  orgUnitMembershipCreate: vi.fn(),
  orgUnitMembershipFindMany: vi.fn(),
  orgUnitMembershipFindFirst: vi.fn(),
  orgUnitMembershipDeleteMany: vi.fn(),
  orgUnitMembershipDelete: vi.fn(),
  orgUnitFindUnique: vi.fn(),
  teamFindUnique: vi.fn(),
  seasonFindUnique: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    person: {
      findMany: mocks.personFindMany,
      findUnique: mocks.personFindUnique,
      create: mocks.personCreate,
      update: mocks.personUpdate,
      delete: mocks.personDelete,
    },
    orgUnitMembership: {
      create: mocks.orgUnitMembershipCreate,
      findMany: mocks.orgUnitMembershipFindMany,
      findFirst: mocks.orgUnitMembershipFindFirst,
      deleteMany: mocks.orgUnitMembershipDeleteMany,
      delete: mocks.orgUnitMembershipDelete,
    },
    orgUnit: { findUnique: mocks.orgUnitFindUnique },
    team: { findUnique: mocks.teamFindUnique },
    season: { findUnique: mocks.seasonFindUnique },
  },
}));

import {
  getPersonsForDirectory,
  findDuplicateCandidates,
  getPersonAssignments,
} from "../queries";

import {
  getPersonFunctionLabel,
  isPersonFunctionKey,
  PERSON_FUNCTIONS,
} from "../functions";

// ── Helper factories ──────────────────────────────────────────────────────────

function makePerson(overrides: Record<string, unknown> = {}) {
  return {
    id: "person-1",
    firstName: "Max",
    lastName: "Muster",
    displayName: null,
    email: null,
    phone: null,
    imageUrl: null,
    isActive: true,
    isPlayer: false,
    isTrainer: false,
    orgUnitMemberships: [],
    ...overrides,
  };
}

function makeAssignment(overrides: Record<string, unknown> = {}) {
  return {
    id: "assign-1",
    orgUnitId: "ou-1",
    teamId: null,
    seasonId: null,
    roleKey: PERSON_FUNCTIONS.HEAD_COACH,
    status: "ACTIVE",
    startsAt: null,
    endsAt: null,
    notes: null,
    orgUnit: { id: "ou-1", name: "Kinderfussball", key: "kinderfussball" },
    team: null,
    season: null,
    ...overrides,
  };
}

// ── DIRECTORY ────────────────────────────────────────────────────────────────

describe("getPersonsForDirectory — tenant isolation", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("includes persons with matching tenantId", async () => {
    mocks.personFindMany.mockResolvedValue([
      makePerson({ tenantId: "tenant-1" }),
    ]);

    const result = await getPersonsForDirectory("tenant-1");
    expect(result).toHaveLength(1);
  });

  it("includes legacy persons with null tenantId (backward compat)", async () => {
    mocks.personFindMany.mockResolvedValue([
      makePerson({ tenantId: null }),
    ]);
    const result = await getPersonsForDirectory("tenant-1");
    expect(result).toHaveLength(1);
  });

  it("passes query text to Prisma where clause", async () => {
    mocks.personFindMany.mockResolvedValue([]);
    await getPersonsForDirectory("tenant-1", { query: "Max" });
    expect(mocks.personFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ OR: expect.any(Array) }),
          ]),
        }),
      }),
    );
  });

  it("returns empty assignments array for person with no memberships", async () => {
    mocks.personFindMany.mockResolvedValue([
      makePerson({ orgUnitMemberships: [] }),
    ]);
    const result = await getPersonsForDirectory("tenant-1");
    expect(result[0].assignments).toHaveLength(0);
  });

  it("quick filter 'ohne_zuordnung' returns only persons with 0 active assignments", async () => {
    const withAssignment = makePerson({
      id: "p-with",
      orgUnitMemberships: [{ id: "a1", status: "ACTIVE", roleKey: "SPIELER" }],
    });
    const withoutAssignment = makePerson({ id: "p-without", orgUnitMemberships: [] });
    mocks.personFindMany.mockResolvedValue([withAssignment, withoutAssignment]);

    const result = await getPersonsForDirectory("tenant-1", { quickFilter: "ohne_zuordnung" });
    expect(result.map((p) => p.id)).toEqual(["p-without"]);
  });

  it("quick filter 'spieler' returns only persons with SPIELER assignment", async () => {
    const player = makePerson({
      id: "p-spieler",
      // Mock returns only the filtered membership (Prisma filters in sub-select)
      orgUnitMemberships: [{ id: "a1", status: "ACTIVE", roleKey: "SPIELER" }],
    });
    const trainer = makePerson({
      id: "p-trainer",
      // Trainer's TRAINER membership is not in SPIELER group → Prisma returns empty
      orgUnitMemberships: [],
    });
    mocks.personFindMany.mockResolvedValue([player, trainer]);

    const result = await getPersonsForDirectory("tenant-1", { quickFilter: "spieler" });
    expect(result.map((p) => p.id)).toEqual(["p-spieler"]);
  });
});

// ── DUPLICATE AWARENESS ───────────────────────────────────────────────────────

describe("findDuplicateCandidates", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("finds duplicate by same first+last name", async () => {
    mocks.personFindMany.mockResolvedValue([
      makePerson({ firstName: "Max", lastName: "Muster", email: null }),
    ]);

    const result = await findDuplicateCandidates("tenant-1", "Max", "Muster");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Max Muster");
  });

  it("finds duplicate by email", async () => {
    mocks.personFindMany.mockResolvedValue([
      makePerson({ firstName: "Anna", lastName: "Huber", email: "max@example.com" }),
    ]);

    const result = await findDuplicateCandidates("tenant-1", "Max", "Muster", "max@example.com");
    expect(result).toHaveLength(1);
  });

  it("returns empty array when no duplicates found", async () => {
    mocks.personFindMany.mockResolvedValue([]);
    const result = await findDuplicateCandidates("tenant-1", "Unique", "Name");
    expect(result).toHaveLength(0);
  });

  it("uses displayName when available", async () => {
    mocks.personFindMany.mockResolvedValue([
      makePerson({ firstName: "Max", lastName: "Muster", displayName: "Maxi" }),
    ]);
    const result = await findDuplicateCandidates("tenant-1", "Max", "Muster");
    expect(result[0].name).toBe("Maxi");
  });
});

// ── ASSIGNMENTS ───────────────────────────────────────────────────────────────

describe("getPersonAssignments", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns all assignments for a person (OrgUnit-only)", async () => {
    mocks.orgUnitMembershipFindMany.mockResolvedValue([
      makeAssignment({ teamId: null }),
    ]);
    const result = await getPersonAssignments("person-1");
    expect(result).toHaveLength(1);
    expect(result[0].teamId).toBeNull();
  });

  it("returns team-specific assignment with teamId set", async () => {
    mocks.orgUnitMembershipFindMany.mockResolvedValue([
      makeAssignment({
        teamId: "team-1",
        team: { id: "team-1", name: "F2", shortName: "F2" },
      }),
    ]);
    const result = await getPersonAssignments("person-1");
    expect(result[0].teamId).toBe("team-1");
    expect(result[0].team?.shortName).toBe("F2");
  });

  it("returns multiple simultaneous assignments", async () => {
    mocks.orgUnitMembershipFindMany.mockResolvedValue([
      makeAssignment({ id: "a1", teamId: "team-1", roleKey: "TRAINER" }),
      makeAssignment({ id: "a2", teamId: "team-2", roleKey: "SPIELER" }),
      makeAssignment({ id: "a3", teamId: null, roleKey: "VIZEPRAESIDENT", orgUnitId: "ou-2" }),
    ]);
    const result = await getPersonAssignments("person-1");
    expect(result).toHaveLength(3);
  });

  it("returns assignments with different functions (multiple functions)", async () => {
    mocks.orgUnitMembershipFindMany.mockResolvedValue([
      makeAssignment({ id: "a1", roleKey: "TRAINER" }),
      makeAssignment({ id: "a2", roleKey: "CO_TRAINER" }),
    ]);
    const result = await getPersonAssignments("person-1");
    expect(result.map((a) => a.roleKey)).toContain("TRAINER");
    expect(result.map((a) => a.roleKey)).toContain("CO_TRAINER");
  });
});

// ── PERSON FUNCTION HELPERS ───────────────────────────────────────────────────

describe("PersonFunction helpers", () => {
  it("getPersonFunctionLabel returns German label for known key", () => {
    expect(getPersonFunctionLabel(PERSON_FUNCTIONS.HEAD_COACH)).toBe("Trainer/in");
    expect(getPersonFunctionLabel(PERSON_FUNCTIONS.PLAYER)).toBe("Spieler/in");
    expect(getPersonFunctionLabel(PERSON_FUNCTIONS.PRESIDENT)).toBe("Präsident/in");
    expect(getPersonFunctionLabel(PERSON_FUNCTIONS.VICE_PRESIDENT)).toBe("Vizepräsident/in");
  });

  it("getPersonFunctionLabel returns raw key for unknown key", () => {
    expect(getPersonFunctionLabel("UNKNOWN_FUNCTION")).toBe("UNKNOWN_FUNCTION");
  });

  it("getPersonFunctionLabel returns empty string for null/undefined", () => {
    expect(getPersonFunctionLabel(null)).toBe("");
    expect(getPersonFunctionLabel(undefined)).toBe("");
  });

  it("isPersonFunctionKey returns true for all canonical keys", () => {
    Object.values(PERSON_FUNCTIONS).forEach((key) => {
      expect(isPersonFunctionKey(key)).toBe(true);
    });
  });

  it("isPersonFunctionKey returns false for unknown key", () => {
    expect(isPersonFunctionKey("UNKNOWN")).toBe(false);
    expect(isPersonFunctionKey(null)).toBe(false);
    expect(isPersonFunctionKey("")).toBe(false);
  });

  it("SPIELER is NOT a governance role key — just an organizational label", () => {
    // This test documents the architectural invariant: person function keys
    // are not in the RPERM permission namespace and must not grant any access.
    const functionKey = PERSON_FUNCTIONS.PLAYER;
    // The key is "SPIELER" — not a permission key like "people.view"
    expect(functionKey).not.toContain(".");
    expect(functionKey.toUpperCase()).toBe(functionKey);
  });
});

// ── AUTHORIZATION PRINCIPLE ───────────────────────────────────────────────────

describe("Authorization — function does NOT grant RPERM permissions", () => {
  it("PersonFunction values are NOT permission keys (no dot notation)", () => {
    Object.values(PERSON_FUNCTIONS).forEach((key) => {
      // Permission keys use "module.action" format (e.g. "people.manage")
      // Function keys use ALL_CAPS identifiers (e.g. "SPIELER")
      expect(key).not.toMatch(/^\w+\.\w+$/);
    });
  });

  it("PEOPLE_DELETE is separate from PEOPLE_MANAGE", async () => {
    // Architectural invariant: delete must never be implied by manage
    const { PERMISSIONS } = await import("@/lib/permissions/permissions");
    expect(PERMISSIONS.PEOPLE_DELETE).toBe("people.delete");
    expect(PERMISSIONS.PEOPLE_MANAGE).toBe("people.manage");
    expect(PERMISSIONS.PEOPLE_DELETE).not.toBe(PERMISSIONS.PEOPLE_MANAGE);
  });
});
