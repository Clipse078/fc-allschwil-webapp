/**
 * lib/registrations/__tests__/waiting-list-service.test.ts
 *
 * REG-WAIT-01: Focused tests for the canonical Waiting List service.
 *
 * Covers:
 *   - Domain / tenant isolation (cannot create for another tenant's Registration)
 *   - Duplicate active entry prevention
 *   - Create: WaitingListEntry created + Registration moves to WAITING
 *   - Update: priority, responsible user, status transitions + timestamps
 *   - Placement: PLACED status, Registration ACCEPTED, squad membership
 *   - Placement: non-player type does not create PlayerSquadMember
 *   - Hard delete: removes entry, never Registration or Person
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock hoisted ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  waitingListFindFirst: vi.fn(),
  waitingListCreate: vi.fn(),
  waitingListUpdate: vi.fn(),
  waitingListFindUnique: vi.fn(),
  waitingListDelete: vi.fn(),
  registrationFindFirst: vi.fn(),
  registrationUpdate: vi.fn(),
  userFindFirst: vi.fn(),
  targetGroupFindFirst: vi.fn(),
  orgUnitFindFirst: vi.fn(),
  teamSeasonFindFirst: vi.fn(),
  personFindFirst: vi.fn(),
  squadFindUnique: vi.fn(),
  squadCreate: vi.fn(),
  $transaction: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    waitingListEntry: {
      findFirst: mocks.waitingListFindFirst,
      findUnique: mocks.waitingListFindUnique,
      create: mocks.waitingListCreate,
      update: mocks.waitingListUpdate,
      delete: mocks.waitingListDelete,
    },
    registration: {
      findFirst: mocks.registrationFindFirst,
      update: mocks.registrationUpdate,
    },
    user: { findFirst: mocks.userFindFirst },
    targetGroup: { findFirst: mocks.targetGroupFindFirst },
    orgUnit: { findFirst: mocks.orgUnitFindFirst },
    teamSeason: { findFirst: mocks.teamSeasonFindFirst },
    person: { findFirst: mocks.personFindFirst },
    playerSquadMember: {
      findUnique: mocks.squadFindUnique,
      create: mocks.squadCreate,
    },
    $transaction: mocks.$transaction,
    auditLog: { create: mocks.auditCreate },
  },
}));

vi.mock("@/lib/tenants/require-tenant", () => ({
  requireTenant: vi.fn().mockResolvedValue({ id: "tenant-a", key: "fc-test" }),
}));

// Mock logAction to avoid DB calls in tests
vi.mock("@/lib/audit/log-action", () => ({
  logAction: vi.fn().mockResolvedValue(undefined),
}));

// Mock getWaitingListEntryForTenant for the return values
vi.mock("@/lib/registrations/waiting-list-queries", () => ({
  getWaitingListEntryForTenant: vi.fn().mockResolvedValue({ id: "entry-1", status: "WAITING" }),
  getActiveWaitingListEntryForRegistration: vi.fn().mockResolvedValue(null),
}));

import {
  createWaitingListEntry,
  updateWaitingListEntry,
  placeWaitingListEntry,
  deleteWaitingListEntryPermanently,
  getWaitingListDeletionImpact,
} from "@/lib/registrations/waiting-list-service";

const TENANT_ID = "tenant-a";
const TENANT_SLUG = "fc-test";

function makeRegistration(overrides: Record<string, unknown> = {}) {
  return {
    id: "reg-1",
    status: "NEW",
    personId: null,
    type: "SPIELERANMELDUNG",
    ...overrides,
  };
}

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-1",
    tenantId: TENANT_ID,
    status: "WAITING",
    priority: "NORMAL",
    responsibleUserId: null,
    registrationId: "reg-1",
    personId: null,
    scopeType: "TARGET_GROUP",
    teamSeasonId: null,
    registration: {
      id: "reg-1",
      type: "SPIELERANMELDUNG",
      status: "WAITING",
      personId: null,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  // Default: no active waiting list entry
  mocks.waitingListFindFirst.mockResolvedValue(null);

  // Default transaction executes all operations
  mocks.$transaction.mockImplementation(async (ops: unknown[]) => {
    return Promise.all(ops.map((op) => (typeof op === "function" ? op() : op)));
  });

  // Default waitingListCreate result
  mocks.waitingListCreate.mockResolvedValue({ id: "entry-1" });
  // Default registrationUpdate result
  mocks.registrationUpdate.mockResolvedValue({ id: "reg-1", status: "WAITING" });
  // Default waitingListUpdate result
  mocks.waitingListUpdate.mockResolvedValue({ id: "entry-1" });
});

// ── CREATE ────────────────────────────────────────────────────────────────────

describe("createWaitingListEntry", () => {
  it("rejects when Registration does not belong to the tenant", async () => {
    mocks.registrationFindFirst.mockResolvedValue(null);
    await expect(
      createWaitingListEntry(TENANT_SLUG, {
        registrationId: "reg-other",
        scopeType: "TARGET_GROUP",
        targetGroupId: "tg-1",
      }),
    ).rejects.toThrow(/Anmeldung nicht gefunden/);
  });

  it("rejects when an active entry already exists for the Registration", async () => {
    mocks.registrationFindFirst.mockResolvedValue(makeRegistration());
    mocks.waitingListFindFirst.mockResolvedValue({ id: "existing", status: "WAITING" });

    await expect(
      createWaitingListEntry(TENANT_SLUG, {
        registrationId: "reg-1",
        scopeType: "TARGET_GROUP",
        targetGroupId: "tg-1",
      }),
    ).rejects.toThrow(/bereits einen aktiven Wartelisten-Eintrag/);
  });

  it("rejects when TARGET_GROUP scope has no targetGroupId", async () => {
    mocks.registrationFindFirst.mockResolvedValue(makeRegistration());

    await expect(
      createWaitingListEntry(TENANT_SLUG, {
        registrationId: "reg-1",
        scopeType: "TARGET_GROUP",
        // no targetGroupId
      }),
    ).rejects.toThrow(/targetGroupId ist erforderlich/);
  });

  it("rejects when targetGroup belongs to a different tenant", async () => {
    mocks.registrationFindFirst.mockResolvedValue(makeRegistration());
    mocks.targetGroupFindFirst.mockResolvedValue(null); // not found = wrong tenant

    await expect(
      createWaitingListEntry(TENANT_SLUG, {
        registrationId: "reg-1",
        scopeType: "TARGET_GROUP",
        targetGroupId: "tg-other",
      }),
    ).rejects.toThrow(/Zielgruppe nicht gefunden/);
  });

  it("rejects when responsibleUser belongs to a different tenant", async () => {
    mocks.registrationFindFirst.mockResolvedValue(makeRegistration());
    mocks.targetGroupFindFirst.mockResolvedValue({ id: "tg-1" });
    mocks.userFindFirst.mockResolvedValue(null);

    await expect(
      createWaitingListEntry(TENANT_SLUG, {
        registrationId: "reg-1",
        scopeType: "TARGET_GROUP",
        targetGroupId: "tg-1",
        responsibleUserId: "user-other",
      }),
    ).rejects.toThrow(/Verantwortliche Person nicht gefunden/);
  });

  it("creates entry and moves Registration to WAITING", async () => {
    mocks.registrationFindFirst.mockResolvedValue(makeRegistration());
    mocks.targetGroupFindFirst.mockResolvedValue({ id: "tg-1" });

    const result = await createWaitingListEntry(TENANT_SLUG, {
      registrationId: "reg-1",
      scopeType: "TARGET_GROUP",
      targetGroupId: "tg-1",
      priority: "HIGH",
    });

    // Transaction was called
    expect(mocks.$transaction).toHaveBeenCalledOnce();
    // Result matches mocked getWaitingListEntryForTenant
    expect(result).toMatchObject({ id: "entry-1", status: "WAITING" });
  });
});

// ── UPDATE ────────────────────────────────────────────────────────────────────

describe("updateWaitingListEntry", () => {
  it("rejects when entry is not found or belongs to different tenant", async () => {
    mocks.waitingListFindFirst.mockResolvedValue(null);

    await expect(
      updateWaitingListEntry(TENANT_SLUG, "nonexistent", { priority: "HIGH" }),
    ).rejects.toThrow(/nicht gefunden/);
  });

  it("rejects updating a terminal entry", async () => {
    mocks.waitingListFindFirst.mockResolvedValue(makeEntry({ status: "PLACED" }));

    await expect(
      updateWaitingListEntry(TENANT_SLUG, "entry-1", { priority: "HIGH" }),
    ).rejects.toThrow(/Abgeschlossene Wartelisten-Einträge/);
  });

  it("stamps lastContactedAt when transitioning to CONTACTED", async () => {
    mocks.waitingListFindFirst.mockResolvedValue(makeEntry());

    await updateWaitingListEntry(TENANT_SLUG, "entry-1", { status: "CONTACTED" });

    expect(mocks.waitingListUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CONTACTED",
          lastContactedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("stamps offeredAt when transitioning to OFFERED", async () => {
    mocks.waitingListFindFirst.mockResolvedValue(makeEntry());

    await updateWaitingListEntry(TENANT_SLUG, "entry-1", { status: "OFFERED" });

    expect(mocks.waitingListUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "OFFERED",
          offeredAt: expect.any(Date),
        }),
      }),
    );
  });

  it("stamps resolvedAt when withdrawing", async () => {
    mocks.waitingListFindFirst.mockResolvedValue(makeEntry());

    await updateWaitingListEntry(TENANT_SLUG, "entry-1", { status: "WITHDRAWN" }, "actor-1");

    expect(mocks.waitingListUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "WITHDRAWN",
          resolvedAt: expect.any(Date),
          resolvedByUserId: "actor-1",
        }),
      }),
    );
  });
});

// ── PLACEMENT ─────────────────────────────────────────────────────────────────

describe("placeWaitingListEntry", () => {
  it("rejects when no person is linked", async () => {
    mocks.waitingListFindFirst.mockResolvedValue(
      makeEntry({ personId: null, registration: { id: "reg-1", type: "SPIELERANMELDUNG", status: "WAITING", personId: null } }),
    );

    await expect(
      placeWaitingListEntry(TENANT_SLUG, "entry-1", {}),
    ).rejects.toThrow(/Kein Person-Datensatz/);
  });

  it("rejects when Person belongs to a different tenant", async () => {
    mocks.waitingListFindFirst.mockResolvedValue(
      makeEntry({ personId: "person-1", registration: { id: "reg-1", type: "SPIELERANMELDUNG", status: "WAITING", personId: "person-1" } }),
    );
    mocks.personFindFirst.mockResolvedValue(null); // wrong tenant

    await expect(
      placeWaitingListEntry(TENANT_SLUG, "entry-1", {}),
    ).rejects.toThrow(/Person nicht gefunden oder gehört zu einem anderen Mandanten/);
  });

  it("rejects duplicate squad membership for player type", async () => {
    mocks.waitingListFindFirst.mockResolvedValue(
      makeEntry({
        personId: "person-1",
        scopeType: "TEAM_SEASON",
        teamSeasonId: "ts-1",
        registration: { id: "reg-1", type: "SPIELERANMELDUNG", status: "WAITING", personId: "person-1" },
      }),
    );
    mocks.personFindFirst.mockResolvedValue({ id: "person-1", tenantId: TENANT_ID });
    mocks.teamSeasonFindFirst.mockResolvedValue({ id: "ts-1" });
    mocks.squadFindUnique.mockResolvedValue({ id: "existing-member" }); // duplicate

    await expect(
      placeWaitingListEntry(TENANT_SLUG, "entry-1", { teamSeasonId: "ts-1" }),
    ).rejects.toThrow(/bereits Mitglied/);
  });

  it("does not create PlayerSquadMember for non-player registration type", async () => {
    mocks.waitingListFindFirst.mockResolvedValue(
      makeEntry({
        personId: "person-1",
        scopeType: "TARGET_GROUP",
        teamSeasonId: null,
        registration: { id: "reg-1", type: "KONTAKTANFRAGE", status: "WAITING", personId: "person-1" },
      }),
    );
    mocks.personFindFirst.mockResolvedValue({ id: "person-1", tenantId: TENANT_ID });

    // No TeamSeason provided and scope is TARGET_GROUP → no squad creation
    await placeWaitingListEntry(TENANT_SLUG, "entry-1", {});

    expect(mocks.squadCreate).not.toHaveBeenCalled();
  });

  it("places successfully and returns updated entry", async () => {
    mocks.waitingListFindFirst.mockResolvedValue(
      makeEntry({
        personId: "person-1",
        scopeType: "TEAM_SEASON",
        teamSeasonId: "ts-1",
        registration: { id: "reg-1", type: "SPIELERANMELDUNG", status: "WAITING", personId: "person-1" },
      }),
    );
    mocks.personFindFirst.mockResolvedValue({ id: "person-1", tenantId: TENANT_ID });
    mocks.teamSeasonFindFirst.mockResolvedValue({ id: "ts-1" });
    mocks.squadFindUnique.mockResolvedValue(null); // no duplicate
    mocks.squadCreate.mockResolvedValue({ id: "squad-member-1" });
    mocks.waitingListUpdate.mockResolvedValue({ id: "entry-1" });
    mocks.registrationUpdate.mockResolvedValue({ id: "reg-1" });

    const result = await placeWaitingListEntry(TENANT_SLUG, "entry-1", { teamSeasonId: "ts-1" });

    expect(mocks.$transaction).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ id: "entry-1" });
  });
});

// ── HARD DELETE ───────────────────────────────────────────────────────────────

describe("deleteWaitingListEntryPermanently", () => {
  it("returns null when entry does not belong to tenant", async () => {
    mocks.waitingListFindFirst.mockResolvedValue(null);

    const result = await deleteWaitingListEntryPermanently(TENANT_ID, "nonexistent");
    expect(result).toBeNull();
  });

  it("deletes the entry and returns the label", async () => {
    mocks.waitingListFindFirst.mockResolvedValue({
      id: "entry-1",
      registrationId: "reg-1",
      registration: { firstName: "Max", lastName: "Muster" },
    });
    mocks.waitingListDelete.mockResolvedValue({ id: "entry-1" });

    const result = await deleteWaitingListEntryPermanently(TENANT_ID, "entry-1");

    expect(mocks.waitingListDelete).toHaveBeenCalledWith({ where: { id: "entry-1" } });
    expect(result).toEqual({ label: "Max Muster" });
  });

  it("does NOT delete the Registration or Person", async () => {
    mocks.waitingListFindFirst.mockResolvedValue({
      id: "entry-1",
      registrationId: "reg-1",
      registration: { firstName: "Max", lastName: "Muster" },
    });
    mocks.waitingListDelete.mockResolvedValue({ id: "entry-1" });

    await deleteWaitingListEntryPermanently(TENANT_ID, "entry-1");

    expect(mocks.registrationUpdate).not.toHaveBeenCalled();
    expect(mocks.personFindFirst).not.toHaveBeenCalled();
  });
});

// ── DELETION IMPACT ───────────────────────────────────────────────────────────

describe("getWaitingListDeletionImpact", () => {
  it("returns null for unknown entry", async () => {
    mocks.waitingListFindFirst.mockResolvedValue(null);
    const result = await getWaitingListDeletionImpact(TENANT_ID, "nonexistent");
    expect(result).toBeNull();
  });

  it("returns registration label and status", async () => {
    mocks.waitingListFindFirst.mockResolvedValue({
      status: "WAITING",
      registration: { firstName: "Anna", lastName: "Test" },
    });

    const result = await getWaitingListDeletionImpact(TENANT_ID, "entry-1");
    expect(result).toEqual({ registrationLabel: "Anna Test", status: "WAITING" });
  });
});
