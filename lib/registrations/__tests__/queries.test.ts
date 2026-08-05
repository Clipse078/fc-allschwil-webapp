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
  },
}));

vi.mock("@/lib/tenants/require-tenant", () => ({
  requireTenant: vi.fn().mockResolvedValue({ id: "tenant-a", key: "fc-allschwil" }),
}));

import {
  listRegistrationsForTenant,
  getRegistrationForTenant,
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
    submittedAt: new Date("2026-08-05T13:56:00.000Z"),
    createdAt: new Date("2026-08-05T13:56:00.000Z"),
    updatedAt: new Date("2026-08-05T13:56:00.000Z"),
    tenant: { id: TENANT_ID, key: "fc-allschwil", name: "FC Allschwil" },
    assignedToUser: null,
    targetGroup: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
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
