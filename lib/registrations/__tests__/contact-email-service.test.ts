import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTenant: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  logAction: vi.fn(),
}));

vi.mock("@/lib/tenants/require-tenant", () => ({
  requireTenant: mocks.requireTenant,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    registration: {
      findFirst: mocks.findFirst,
      update: mocks.update,
    },
  },
}));
vi.mock("@/lib/audit/log-action", () => ({
  logAction: mocks.logAction,
}));

import { updateRegistrationContactEmailForTenant } from "@/lib/registrations/contact-email-service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireTenant.mockResolvedValue({ id: "tenant-a" });
  mocks.findFirst.mockResolvedValue({ id: "reg-a", email: "old@example.com" });
  mocks.update.mockResolvedValue({ id: "reg-a", email: "new@example.com" });
});

describe("registration contact email update", () => {
  it("validates and normalizes email, without touching workflow status", async () => {
    await updateRegistrationContactEmailForTenant("fc-a", "reg-a", " New@Example.COM ", "actor-a");

    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "reg-a", tenantId: "tenant-a" } }),
    );
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "reg-a" },
        data: { email: "new@example.com" },
      }),
    );
    const updateCall = mocks.update.mock.calls[0]?.[0] as { data?: Record<string, unknown> };
    expect(updateCall.data).not.toHaveProperty("status");
    expect(mocks.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleKey: "registrations",
        entityType: "Registration",
        entityId: "reg-a",
        action: "CONTACT_EMAIL_UPDATED",
      }),
    );
  });

  it("rejects invalid emails", async () => {
    await expect(
      updateRegistrationContactEmailForTenant("fc-a", "reg-a", "not-an-email", "actor-a"),
    ).rejects.toThrow("Bitte gib eine gültige E-Mail-Adresse ein.");
  });

  it("enforces tenant boundary (not found)", async () => {
    mocks.findFirst.mockResolvedValue(null);
    await expect(
      updateRegistrationContactEmailForTenant("fc-a", "reg-foreign", "a@b.com", "actor-a"),
    ).rejects.toThrow("Anmeldung nicht gefunden.");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

