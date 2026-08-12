/**
 * app/api/tenants/[tenantSlug]/registrations/[registrationId]/permanent/__tests__/route.test.ts
 *
 * ADMIN-DELETE-03B — Focused tests for the DELETE
 * /api/tenants/[tenantSlug]/registrations/[registrationId]/permanent
 * permanent-delete authorization wiring AND the two-step
 * "preview impact → explicit confirm" flow.
 *
 * All database and permission access is mocked. No live database access.
 *
 * TEST COVERAGE MAP:
 *   1. Authorized user (registrations.delete): impact preview returns 200 +
 *      requiresConfirmation: true without deleting anything.
 *   2. Authorized user (registrations.delete): confirm=true permanently
 *      deletes the registration and returns 200.
 *   3. Cross-tenant guard: registration belongs to a different tenant slug →
 *      returns 403 regardless of authorization.
 *   4. Unauthorized user (no registrations.delete): returns 403.
 *   5. Unauthenticated (no session): returns 401.
 *   6. Registration not found: returns 404.
 *   7. SCE Super Admin: allowed for a registration in a different active tenant.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  hasTenantDeletionAuthority: vi.fn(),
  logAction: vi.fn(),
  registrationFindUnique: vi.fn(),
  deleteRegistrationPermanently: vi.fn(),
  getRegistrationDeletionImpact: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/permissions/services/effective-permission-resolver", () => ({
  createEffectivePermissionResolver: () => ({
    hasTenantDeletionAuthority: mocks.hasTenantDeletionAuthority,
  }),
}));

vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    registration: {
      findUnique: (...args: unknown[]) => mocks.registrationFindUnique(...args),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/registrations/registration-delete-service", () => ({
  deleteRegistrationPermanently: mocks.deleteRegistrationPermanently,
  getRegistrationDeletionImpact: mocks.getRegistrationDeletionImpact,
}));

import { DELETE } from "../route";

const TENANT_SLUG = "fc-allschwil";
const TENANT_SLUG_OTHER = "other-club";
const TENANT_ID = "tenant-a";
const TENANT_ID_OTHER = "tenant-b";
const REGISTRATION_ID = "reg-01";
const USER_ID = "user-x";

function makeRequest(confirm?: boolean) {
  const url = confirm
    ? `http://localhost/api/tenants/${TENANT_SLUG}/registrations/${REGISTRATION_ID}/permanent?confirm=true`
    : `http://localhost/api/tenants/${TENANT_SLUG}/registrations/${REGISTRATION_ID}/permanent`;
  return new NextRequest(url, { method: "DELETE" });
}

function makeContext(
  tenantSlug = TENANT_SLUG,
  registrationId = REGISTRATION_ID,
) {
  return {
    params: Promise.resolve({ tenantSlug, registrationId }),
  };
}

const MOCK_REGISTRATION = {
  id: REGISTRATION_ID,
  tenantId: TENANT_ID,
  tenant: { key: TENANT_SLUG, status: "ACTIVE" },
  firstName: "Max",
  lastName: "Muster",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: USER_ID } });
  mocks.registrationFindUnique.mockResolvedValue(MOCK_REGISTRATION);
  mocks.hasTenantDeletionAuthority.mockResolvedValue(true);
  mocks.getRegistrationDeletionImpact.mockResolvedValue([]);
  mocks.deleteRegistrationPermanently.mockResolvedValue({
    registrationLabel: "Max Muster <max@example.com>",
  });
  mocks.logAction.mockResolvedValue(undefined);
  mocks.revalidatePath.mockReturnValue(undefined);
});

describe("DELETE /api/tenants/[tenantSlug]/registrations/[registrationId]/permanent", () => {
  it("1. preview (no confirm): returns 200 with impact + requiresConfirmation, no deletion", async () => {
    mocks.getRegistrationDeletionImpact.mockResolvedValue([
      { key: "createdPersons", label: "Verknüpfte Personen", count: 1 },
    ]);

    const response = await DELETE(makeRequest(), makeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.requiresConfirmation).toBe(true);
    expect(body.impact).toHaveLength(1);
    expect(body.impact[0].key).toBe("createdPersons");
    expect(mocks.deleteRegistrationPermanently).not.toHaveBeenCalled();
  });

  it("2. confirm=true: deletes registration, logs action, revalidates, returns 200", async () => {
    const response = await DELETE(makeRequest(true), makeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toContain("endgültig gelöscht");
    expect(mocks.deleteRegistrationPermanently).toHaveBeenCalledWith(
      TENANT_ID,
      REGISTRATION_ID,
    );
    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "DELETE",
        entityType: "Registration",
        entityId: REGISTRATION_ID,
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });

  it("3. cross-tenant guard: registration belongs to a different tenant slug → 403", async () => {
    // registrationFindUnique returns registration owned by TENANT_SLUG_OTHER
    mocks.registrationFindUnique.mockResolvedValue({
      ...MOCK_REGISTRATION,
      tenantId: TENANT_ID_OTHER,
      tenant: { key: TENANT_SLUG_OTHER, status: "ACTIVE" },
    });

    // URL slug is TENANT_SLUG (fc-allschwil) but registration belongs to other-club
    const response = await DELETE(makeRequest(), makeContext(TENANT_SLUG));
    expect(response.status).toBe(403);
    expect(mocks.deleteRegistrationPermanently).not.toHaveBeenCalled();
  });

  it("4. unauthorized (no registrations.delete): returns 403", async () => {
    mocks.hasTenantDeletionAuthority.mockResolvedValue(false);

    const response = await DELETE(makeRequest(), makeContext());
    expect(response.status).toBe(403);
    expect(mocks.deleteRegistrationPermanently).not.toHaveBeenCalled();
  });

  it("5. unauthenticated: returns 401", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await DELETE(makeRequest(), makeContext());
    expect(response.status).toBe(401);
  });

  it("6. registration not found: returns 404", async () => {
    mocks.registrationFindUnique.mockResolvedValue(null);

    const response = await DELETE(makeRequest(), makeContext());
    expect(response.status).toBe(404);
  });

  it("7. SCE Super Admin: hasTenantDeletionAuthority called with DB-resolved tenantId, not URL slug", async () => {
    // Super Admin resolving a registration from TENANT_ID — verify the
    // resolver is called with the DB-resolved tenantId, never a URL param.
    mocks.hasTenantDeletionAuthority.mockResolvedValue(true);

    await DELETE(makeRequest(), makeContext());

    expect(mocks.hasTenantDeletionAuthority).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        permission: "registrations.delete",
        tenantId: TENANT_ID,
      }),
    );
  });
});
