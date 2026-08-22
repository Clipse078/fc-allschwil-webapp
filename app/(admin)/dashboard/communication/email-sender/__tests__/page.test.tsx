// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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

import EmailSenderPage from "../page";
import { PERMISSIONS } from "@/lib/permissions/permissions";

const settings = {
  displayName: "FC Allschwil",
  emailAddress: "info@fcallschwil.ch",
  providerStatus: "VERIFIED" as const,
  activeSource: "TENANT" as const,
  activeFrom: "FC Allschwil <info@fcallschwil.ch>",
  platformFallbackActive: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue(undefined);
  mocks.getActiveTenant.mockResolvedValue({ id: "tenant-a" });
  mocks.getSettings.mockResolvedValue(settings);
});

describe("canonical Kommunikation email sender page", () => {
  it("renders the real sender form with loaded tenant settings", async () => {
    render(await EmailSenderPage());

    expect(mocks.requirePermission).toHaveBeenCalledWith([
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.USERS_MANAGE_MEMBERSHIPS,
    ]);
    expect(mocks.getSettings).toHaveBeenCalledWith("tenant-a");
    expect(screen.getByTestId("email-sender-form")).toBeInTheDocument();
    expect(screen.getByLabelText("Absendername")).toHaveValue("FC Allschwil");
    expect(screen.getByLabelText("Absender-E-Mail-Adresse")).toHaveValue(
      "info@fcallschwil.ch",
    );
    expect(
      screen.getByRole("button", { name: "E-Mail-Absender speichern" }),
    ).toBeEnabled();
  });

  it("denies access before loading tenant sender data", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("Forbidden"));

    await expect(EmailSenderPage()).rejects.toThrow("Forbidden");
    expect(mocks.getActiveTenant).not.toHaveBeenCalled();
    expect(mocks.getSettings).not.toHaveBeenCalled();
  });
});
