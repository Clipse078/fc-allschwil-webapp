/**
 * lib/registrations/__tests__/queries.test.ts
 *
 * REGISTRATION-01E — Goal 2: duplicate reference enrichment.
 *
 * Verifies that listRegistrationsForTenant / getRegistrationForTenant /
 * updateRegistrationStatusForTenant attach a resolved `duplicateReference`
 * summary (id/name/status/submittedAt) whenever a registration's payloadJson
 * carries `possibleDuplicate: true` + `possibleDuplicateOf: <id>` — WITHOUT
 * changing the (unchanged) duplicate-detection logic in public-submission.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  registrationFindMany: vi.fn(),
  registrationFindFirst: vi.fn(),
  registrationUpdate: vi.fn(),
  userFindFirst: vi.fn(),
  targetGroupFindFirst: vi.fn(),
  personFindMany: vi.fn(),
  personFindUnique: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    registration: {
      findMany: mocks.registrationFindMany,
      findFirst: mocks.registrationFindFirst,
      update: mocks.registrationUpdate,
    },
    user: { findFirst: mocks.userFindFirst },
    targetGroup: { findFirst: mocks.targetGroupFindFirst },
    // REGISTRATION-01F: person lookup used by attachPersonMatchSummaries —
    // returns no candidates by default so pre-existing duplicate-reference
    // assertions (which only count registrationFindMany calls) stay valid.
    person: { findMany: mocks.personFindMany, findUnique: mocks.personFindUnique },
  },
}));

vi.mock("@/lib/tenants/require-tenant", () => ({
  requireTenant: vi.fn().mockResolvedValue({ id: "tenant-a", key: "fc-allschwil" }),
}));

import {
  listRegistrationsForTenant,
  getRegistrationForTenant,
  updateRegistrationStatusForTenant,
} from "@/lib/registrations/queries";

const TENANT_ID = "tenant-a";

function makeRegistration(overrides: Record<string, unknown> = {}) {
  return {
    id: "reg-1",
    type: "PROBETRAINING",
    status: "NEW",
    firstName: "Michael",
    lastName: "TEST",
    email: "michael.test@example.ch",
    phone: null,
    birthDate: null,
    birthYear: 2015,
    message: null,
    payloadJson: null,
    source: "WEBSITE",
    assignedToUserId: null,
    targetGroupId: null,
    personId: null,
    duplicateIgnoredAt: null,
    duplicateIgnoredById: null,
    contactedAt: null,
    archivedAt: null,
    submittedAt: new Date("2026-08-05T13:56:00.000Z"),
    createdAt: new Date("2026-08-05T13:56:00.000Z"),
    updatedAt: new Date("2026-08-05T13:56:00.000Z"),
    tenant: { id: TENANT_ID, key: "fc-allschwil", name: "FC Allschwil" },
    assignedToUser: null,
    targetGroup: null,
    person: null,
    duplicateIgnoredBy: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.personFindMany.mockResolvedValue([]);
});

describe("listRegistrationsForTenant — duplicate reference enrichment", () => {
  it("attaches duplicateReference:null when nothing is flagged as a duplicate (no extra query)", async () => {
    mocks.registrationFindMany.mockResolvedValueOnce([makeRegistration()]);

    const result = await listRegistrationsForTenant("fc-allschwil");

    expect(result).toHaveLength(1);
    expect(result[0].duplicateReference).toBeNull();
    // Only the primary list query — no batched duplicate-reference lookup.
    expect(mocks.registrationFindMany).toHaveBeenCalledTimes(1);
  });

  it("resolves the referenced registration's name/status/submittedAt for a flagged duplicate", async () => {
    const duplicate = makeRegistration({
      id: "reg-duplicate",
      payloadJson: { possibleDuplicate: true, possibleDuplicateOf: "reg-original" },
    });

    mocks.registrationFindMany
      .mockResolvedValueOnce([duplicate]) // primary list query
      .mockResolvedValueOnce([
        {
          id: "reg-original",
          firstName: "Michael",
          lastName: "TEST",
          status: "CONTACTED",
          submittedAt: new Date("2026-08-04T10:00:00.000Z"),
        },
      ]); // batched duplicate-reference lookup

    const result = await listRegistrationsForTenant("fc-allschwil");

    expect(result).toHaveLength(1);
    expect(result[0].duplicateReference).toEqual({
      id: "reg-original",
      firstName: "Michael",
      lastName: "TEST",
      status: "CONTACTED",
      submittedAt: "2026-08-04T10:00:00.000Z",
    });
    // Second call scopes the reference lookup to the same tenant.
    expect(mocks.registrationFindMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: { in: ["reg-original"] }, tenantId: TENANT_ID },
      }),
    );
  });

  it("gracefully falls back to null when the referenced registration cannot be resolved (e.g. cross-tenant)", async () => {
    const duplicate = makeRegistration({
      payloadJson: { possibleDuplicate: true, possibleDuplicateOf: "reg-missing" },
    });

    mocks.registrationFindMany
      .mockResolvedValueOnce([duplicate])
      .mockResolvedValueOnce([]); // reference not found

    const result = await listRegistrationsForTenant("fc-allschwil");

    expect(result[0].duplicateReference).toBeNull();
  });

  it("batches a single reference lookup across multiple registrations sharing the same duplicate target", async () => {
    const dup1 = makeRegistration({
      id: "dup-1",
      payloadJson: { possibleDuplicate: true, possibleDuplicateOf: "reg-original" },
    });
    const dup2 = makeRegistration({
      id: "dup-2",
      payloadJson: { possibleDuplicate: true, possibleDuplicateOf: "reg-original" },
    });

    mocks.registrationFindMany
      .mockResolvedValueOnce([dup1, dup2])
      .mockResolvedValueOnce([
        {
          id: "reg-original",
          firstName: "Michael",
          lastName: "TEST",
          status: "NEW",
          submittedAt: new Date("2026-08-04T10:00:00.000Z"),
        },
      ]);

    const result = await listRegistrationsForTenant("fc-allschwil");

    expect(result).toHaveLength(2);
    expect(result[0].duplicateReference?.id).toBe("reg-original");
    expect(result[1].duplicateReference?.id).toBe("reg-original");
    // Exactly one batched call for the reference IDs, regardless of how many
    // registrations point at the same original.
    expect(mocks.registrationFindMany).toHaveBeenCalledTimes(2);
  });
});

describe("getRegistrationForTenant — duplicate reference enrichment", () => {
  it("returns null when the registration doesn't exist (no regression)", async () => {
    mocks.registrationFindFirst.mockResolvedValueOnce(null);
    const result = await getRegistrationForTenant("fc-allschwil", "missing-id");
    expect(result).toBeNull();
  });

  it("enriches a single registration with its resolved duplicate reference", async () => {
    mocks.registrationFindFirst.mockResolvedValueOnce(
      makeRegistration({
        payloadJson: { possibleDuplicate: true, possibleDuplicateOf: "reg-original" },
      }),
    );
    mocks.registrationFindMany.mockResolvedValueOnce([
      {
        id: "reg-original",
        firstName: "Michael",
        lastName: "TEST",
        status: "REVIEWING",
        submittedAt: new Date("2026-08-04T10:00:00.000Z"),
      },
    ]);

    const result = await getRegistrationForTenant("fc-allschwil", "reg-1");

    expect(result?.duplicateReference).toEqual({
      id: "reg-original",
      firstName: "Michael",
      lastName: "TEST",
      status: "REVIEWING",
      submittedAt: "2026-08-04T10:00:00.000Z",
    });
  });

  it("never invents a duplicate reference for legacy registrations with NULL payloadJson", async () => {
    mocks.registrationFindFirst.mockResolvedValueOnce(makeRegistration({ payloadJson: null }));

    const result = await getRegistrationForTenant("fc-allschwil", "reg-1");

    expect(result?.duplicateReference).toBeNull();
    expect(mocks.registrationFindMany).not.toHaveBeenCalled();
  });
});

// ── REGISTRATION-01F — Goal 2/6/7/8 additions ───────────────────────────────

describe("updateRegistrationStatusForTenant — quick-action timestamps (Goal 6/8)", () => {
  it("stamps contactedAt when the status transitions to CONTACTED", async () => {
    mocks.registrationFindFirst.mockResolvedValueOnce(makeRegistration());
    mocks.registrationUpdate.mockResolvedValueOnce(
      makeRegistration({ status: "CONTACTED", contactedAt: new Date("2026-08-05T14:00:00.000Z") }),
    );

    await updateRegistrationStatusForTenant("fc-allschwil", "reg-1", { status: "CONTACTED" }, "user-1");

    const updateArgs = mocks.registrationUpdate.mock.calls[0][0];
    expect(updateArgs.data.contactedAt).toBeInstanceOf(Date);
    expect(updateArgs.data.archivedAt).toBeUndefined();
  });

  it("stamps archivedAt when the status transitions to ARCHIVED", async () => {
    mocks.registrationFindFirst.mockResolvedValueOnce(makeRegistration());
    mocks.registrationUpdate.mockResolvedValueOnce(makeRegistration({ status: "ARCHIVED" }));

    await updateRegistrationStatusForTenant("fc-allschwil", "reg-1", { status: "ARCHIVED" }, "user-1");

    const updateArgs = mocks.registrationUpdate.mock.calls[0][0];
    expect(updateArgs.data.archivedAt).toBeInstanceOf(Date);
  });

  it("leaves contactedAt/archivedAt untouched for unrelated status changes", async () => {
    mocks.registrationFindFirst.mockResolvedValueOnce(makeRegistration());
    mocks.registrationUpdate.mockResolvedValueOnce(makeRegistration({ status: "REVIEWING" }));

    await updateRegistrationStatusForTenant("fc-allschwil", "reg-1", { status: "REVIEWING" }, "user-1");

    const updateArgs = mocks.registrationUpdate.mock.calls[0][0];
    expect(updateArgs.data.contactedAt).toBeUndefined();
    expect(updateArgs.data.archivedAt).toBeUndefined();
  });
});

describe("updateRegistrationStatusForTenant — person link (Goal 2)", () => {
  it("validates the person exists before linking", async () => {
    mocks.registrationFindFirst.mockResolvedValueOnce(makeRegistration());
    mocks.personFindUnique.mockResolvedValueOnce(null);

    await expect(
      updateRegistrationStatusForTenant("fc-allschwil", "reg-1", { personId: "missing-person" }, "user-1"),
    ).rejects.toThrow("Person not found.");
  });

  it("links an existing person by id", async () => {
    mocks.registrationFindFirst.mockResolvedValueOnce(makeRegistration());
    mocks.personFindUnique.mockResolvedValueOnce({ id: "person-1" });
    mocks.registrationUpdate.mockResolvedValueOnce(makeRegistration({ personId: "person-1" }));

    const result = await updateRegistrationStatusForTenant(
      "fc-allschwil",
      "reg-1",
      { personId: "person-1" },
      "user-1",
    );

    expect(result?.registration.personId).toBe("person-1");
    const updateArgs = mocks.registrationUpdate.mock.calls[0][0];
    expect(updateArgs.data.personId).toBe("person-1");
  });

  it("allows unlinking a person by passing null", async () => {
    mocks.registrationFindFirst.mockResolvedValueOnce(makeRegistration({ personId: "person-1" }));
    mocks.registrationUpdate.mockResolvedValueOnce(makeRegistration({ personId: null }));

    await updateRegistrationStatusForTenant("fc-allschwil", "reg-1", { personId: null }, "user-1");

    const updateArgs = mocks.registrationUpdate.mock.calls[0][0];
    expect(updateArgs.data.personId).toBeNull();
    // null does not trigger the existence check (only truthy ids do).
    expect(mocks.personFindUnique).not.toHaveBeenCalled();
  });
});

describe("updateRegistrationStatusForTenant — duplicate ignore (Goal 7)", () => {
  it("stamps duplicateIgnoredAt/duplicateIgnoredById when duplicateIgnored is true", async () => {
    mocks.registrationFindFirst.mockResolvedValueOnce(makeRegistration());
    mocks.registrationUpdate.mockResolvedValueOnce(
      makeRegistration({ duplicateIgnoredAt: new Date(), duplicateIgnoredById: "user-1" }),
    );

    await updateRegistrationStatusForTenant("fc-allschwil", "reg-1", { duplicateIgnored: true }, "user-1");

    const updateArgs = mocks.registrationUpdate.mock.calls[0][0];
    expect(updateArgs.data.duplicateIgnoredAt).toBeInstanceOf(Date);
    expect(updateArgs.data.duplicateIgnoredById).toBe("user-1");
  });

  it("leaves duplicate-ignore fields untouched when not requested", async () => {
    mocks.registrationFindFirst.mockResolvedValueOnce(makeRegistration());
    mocks.registrationUpdate.mockResolvedValueOnce(makeRegistration({ status: "REVIEWING" }));

    await updateRegistrationStatusForTenant("fc-allschwil", "reg-1", { status: "REVIEWING" }, "user-1");

    const updateArgs = mocks.registrationUpdate.mock.calls[0][0];
    expect(updateArgs.data.duplicateIgnoredAt).toBeUndefined();
    expect(updateArgs.data.duplicateIgnoredById).toBeUndefined();
  });
});

describe("listRegistrationsForTenant / getRegistrationForTenant — person match projection (Goal 2)", () => {
  it("attaches personMatch:LINKED without querying Person when personId is set", async () => {
    mocks.registrationFindMany.mockResolvedValueOnce([makeRegistration({ personId: "person-1" })]);

    const result = await listRegistrationsForTenant("fc-allschwil");

    expect(result[0].personMatch).toEqual({ status: "LINKED", candidates: [] });
    expect(mocks.personFindMany).not.toHaveBeenCalled();
  });

  it("attaches personMatch:NONE when no Person candidate matches", async () => {
    mocks.registrationFindFirst.mockResolvedValueOnce(makeRegistration());
    mocks.personFindMany.mockResolvedValueOnce([]);

    const result = await getRegistrationForTenant("fc-allschwil", "reg-1");

    expect(result?.personMatch).toEqual({ status: "NONE", candidates: [] });
  });
});
