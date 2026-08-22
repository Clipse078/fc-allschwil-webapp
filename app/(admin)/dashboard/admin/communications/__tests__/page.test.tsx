import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  getActiveTenant: vi.fn(),
  getSettings: vi.fn(),
}));

vi.mock("@/lib/permissions/require-any-permission", () => ({
  requireAnyPermission: mocks.requirePermission,
}));
vi.mock("@/lib/tenants/active-tenant", () => ({
  getActiveTenant: mocks.getActiveTenant,
}));
vi.mock("@/lib/communication/email-sender-service", () => ({
  getTenantEmailSenderSettings: mocks.getSettings,
}));

import EmailSenderPage from "../../../communication/email-sender/page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue(undefined);
  mocks.getActiveTenant.mockResolvedValue({ id: "tenant-a" });
  mocks.getSettings.mockResolvedValue({
    displayName: null,
    emailAddress: null,
    providerStatus: "NOT_CONFIGURED",
    activeSource: "PLATFORM",
    activeFrom: "SportClubEvo <noreply@mail.sportclubevo.com>",
    platformFallbackActive: true,
  });
});

describe("COMM-03B canonical email sender page authorization", () => {
  it("loads the active tenant settings for an authorized tenant admin", async () => {
    await EmailSenderPage();
    expect(mocks.requirePermission).toHaveBeenCalledWith(["users.manage"]);
    expect(mocks.getSettings).toHaveBeenCalledWith("tenant-a");
  });

  it("does not load or expose settings when authorization fails", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("Forbidden"));
    await expect(EmailSenderPage()).rejects.toThrow("Forbidden");
    expect(mocks.getActiveTenant).not.toHaveBeenCalled();
    expect(mocks.getSettings).not.toHaveBeenCalled();
  });
});
