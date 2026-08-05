/**
 * lib/registrations/__tests__/person-creation.test.ts
 *
 * REGISTRATION-01F — Goal 3/11: "Create Person" workflow action.
 *
 * Verifies:
 *   - Registration data (address/guardian/football) is copied onto Person.
 *   - Registration → Person link + provenance (createdFromRegistration /
 *     createdRegistrationId) is stamped.
 *   - Never creates a Person when already linked (ALREADY_LINKED).
 *   - Never creates a Person silently next to a possible match unless the
 *     caller explicitly confirms (Goal 11 safety).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  registrationFindFirst: vi.fn(),
  personFindMany: vi.fn(),
  personCreate: vi.fn(),
  registrationUpdate: vi.fn(),
  transaction: vi.fn(),
  logAction: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    registration: {
      findFirst: mocks.registrationFindFirst,
      update: mocks.registrationUpdate,
    },
    person: {
      findMany: mocks.personFindMany,
      create: mocks.personCreate,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/tenants/require-tenant", () => ({
  requireTenant: vi.fn().mockResolvedValue({ id: "tenant-a", key: "fc-allschwil" }),
}));

vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

import { createPersonFromRegistration } from "@/lib/registrations/person-creation";

const TENANT_ID = "tenant-a";

function baseRegistration(overrides: Record<string, unknown> = {}) {
  return {
    id: "reg-1",
    tenantId: TENANT_ID,
    firstName: "Lara",
    lastName: "Muster",
    email: "lara.muster@example.ch",
    phone: "+41 79 123 45 67",
    birthDate: new Date("2015-03-22T00:00:00.000Z"),
    birthYear: 2015,
    message: null,
    payloadJson: {
      address: { street: "Baselstrasse", postalCode: "4123", city: "Allschwil", country: "CH" },
      parentOrGuardian: { firstName: "Sandra", lastName: "Muster", email: "sandra@example.ch", phone: "+41 79 999 99 99" },
      football: { desiredTeam: "E-Junioren", position: "Stürmerin" },
    },
    source: "WEBSITE",
    submittedAt: new Date("2026-08-01T10:00:00.000Z"),
    personId: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      person: { create: mocks.personCreate },
      registration: { update: mocks.registrationUpdate },
    }),
  );
});

describe("createPersonFromRegistration", () => {
  it("returns NOT_FOUND when the registration doesn't exist in this tenant", async () => {
    mocks.registrationFindFirst.mockResolvedValueOnce(null);
    const result = await createPersonFromRegistration("fc-allschwil", "missing", {}, "user-1");
    expect(result).toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  it("returns ALREADY_LINKED without creating a Person when personId is already set", async () => {
    mocks.registrationFindFirst.mockResolvedValueOnce(baseRegistration({ personId: "person-existing" }));
    const result = await createPersonFromRegistration("fc-allschwil", "reg-1", {}, "user-1");
    expect(result).toEqual({ ok: false, reason: "ALREADY_LINKED", personId: "person-existing" });
    expect(mocks.personCreate).not.toHaveBeenCalled();
  });

  it("refuses to create silently when a possible match exists (Goal 11) and returns the candidates", async () => {
    mocks.registrationFindFirst.mockResolvedValueOnce(baseRegistration());
    mocks.personFindMany.mockResolvedValueOnce([
      {
        id: "person-existing",
        firstName: "Lara",
        lastName: "Muster",
        displayName: null,
        email: "lara.muster@example.ch",
        phone: null,
        dateOfBirth: null,
      },
    ]);
    const result = await createPersonFromRegistration("fc-allschwil", "reg-1", {}, "user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("POSSIBLE_MATCH");
      if (result.reason === "POSSIBLE_MATCH") {
        expect(result.candidates[0].id).toBe("person-existing");
      }
    }
    expect(mocks.personCreate).not.toHaveBeenCalled();
  });

  it("creates the Person with copied data + provenance and links it back when confirmed despite a match", async () => {
    mocks.registrationFindFirst.mockResolvedValueOnce(baseRegistration());
    mocks.personCreate.mockResolvedValueOnce({ id: "person-new" });
    mocks.registrationUpdate.mockResolvedValueOnce({ id: "reg-1", personId: "person-new" });

    const result = await createPersonFromRegistration(
      "fc-allschwil",
      "reg-1",
      { confirmDespiteMatch: true },
      "user-1",
    );

    expect(result).toEqual({ ok: true, personId: "person-new" });
    // Confirmed despite match: no lookup needed to gate creation.
    expect(mocks.personFindMany).not.toHaveBeenCalled();

    const createArgs = mocks.personCreate.mock.calls[0][0];
    expect(createArgs.data.firstName).toBe("Lara");
    expect(createArgs.data.lastName).toBe("Muster");
    expect(createArgs.data.street).toBe("Baselstrasse");
    expect(createArgs.data.postalCode).toBe("4123");
    expect(createArgs.data.city).toBe("Allschwil");
    expect(createArgs.data.country).toBe("CH");
    expect(createArgs.data.guardianFirstName).toBe("Sandra");
    expect(createArgs.data.guardianLastName).toBe("Muster");
    expect(createArgs.data.guardianEmail).toBe("sandra@example.ch");
    expect(createArgs.data.footballJson).toMatchObject({ requestedTeam: "E-Junioren", position: "Stürmerin" });
    expect(createArgs.data.createdFromRegistration).toBe(true);
    expect(createArgs.data.createdRegistrationId).toBe("reg-1");

    const updateArgs = mocks.registrationUpdate.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: "reg-1" });
    expect(updateArgs.data).toEqual({ personId: "person-new" });

    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PERSON_CREATED", entityId: "reg-1" }),
    );
  });

  it("creates the Person directly (no confirmation needed) when there is no match at all", async () => {
    mocks.registrationFindFirst.mockResolvedValueOnce(baseRegistration());
    mocks.personFindMany.mockResolvedValueOnce([]);
    mocks.personCreate.mockResolvedValueOnce({ id: "person-new" });
    mocks.registrationUpdate.mockResolvedValueOnce({ id: "reg-1", personId: "person-new" });

    const result = await createPersonFromRegistration("fc-allschwil", "reg-1", {}, "user-1");

    expect(result).toEqual({ ok: true, personId: "person-new" });
    expect(mocks.personFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.personCreate).toHaveBeenCalledTimes(1);
  });
});
