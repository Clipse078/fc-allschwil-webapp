import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  getEffectivePermissions: vi.fn(),
  getActiveTenant: vi.fn(),
  getEmailSenderSettings: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/permissions/services/effective-permission-resolver", () => ({
  createEffectivePermissionResolver: () => ({
    getEffectivePermissions: mocks.getEffectivePermissions,
  }),
}));
vi.mock("@/lib/tenants/active-tenant", () => ({
  getActiveTenant: mocks.getActiveTenant,
}));
vi.mock("@/lib/communication/email-sender-service", () => ({
  getTenantEmailSenderSettings: mocks.getEmailSenderSettings,
}));

import CommunicationPage from "@/app/(admin)/dashboard/communication/page";
import EmailSenderPage from "@/app/(admin)/dashboard/communication/email-sender/page";
import SponsoringPage from "@/app/(admin)/dashboard/sponsoring/page";
import { PERMISSIONS } from "@/lib/permissions/permissions";

const TENANT_ID = "tenant-fc-allschwil";
const CLUB_ADMIN_SESSION = {
  user: {
    id: "fc-allschwil-club-admin",
    activeTenantId: TENANT_ID,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(CLUB_ADMIN_SESSION);
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  });
  mocks.notFound.mockImplementation(() => {
    throw new Error("NOT_FOUND");
  });
  mocks.getActiveTenant.mockResolvedValue({
    id: TENANT_ID,
    name: "FC Allschwil",
  });
  mocks.getEmailSenderSettings.mockResolvedValue({
    displayName: "FC Allschwil",
    emailAddress: "info@fcallschwil.ch",
    providerStatus: "VERIFIED",
    activeSource: "TENANT",
    activeFrom: "FC Allschwil <info@fcallschwil.ch>",
    platformFallbackActive: false,
  });
});

describe("COMM-03B-UX-03 runtime route authorization", () => {
  it.each([
    ["Kommunikation", CommunicationPage],
    ["Sponsoring", SponsoringPage],
  ])(
    "allows an FC Allschwil-style tenant Club Admin to remain on the %s landing page",
    async (_label, page) => {
      mocks.getEffectivePermissions.mockResolvedValue({
        platform: [],
        tenant: [PERMISSIONS.USERS_MANAGE_MEMBERSHIPS],
      });

      await expect(page()).resolves.toBeTruthy();

      expect(mocks.redirect).not.toHaveBeenCalled();
      expect(mocks.getEffectivePermissions).toHaveBeenCalledWith({
        userId: CLUB_ADMIN_SESSION.user.id,
        tenantId: TENANT_ID,
      });
    },
  );

  it.each([
    ["Kommunikation", CommunicationPage],
    ["Sponsoring", SponsoringPage],
  ])("still redirects an unauthorized user away from the %s landing page", async (_label, page) => {
    mocks.getEffectivePermissions.mockResolvedValue({
      platform: [],
      tenant: [PERMISSIONS.USERS_VIEW],
    });

    await expect(page()).rejects.toThrow("REDIRECT:/dashboard");
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("allows the tenant Club Admin to manage the active tenant's sender identity", async () => {
    mocks.getEffectivePermissions.mockResolvedValue({
      platform: [],
      tenant: [PERMISSIONS.USERS_MANAGE_MEMBERSHIPS],
    });

    await expect(EmailSenderPage()).resolves.toBeTruthy();

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.getActiveTenant).toHaveBeenCalledOnce();
    expect(mocks.getEmailSenderSettings).toHaveBeenCalledWith(TENANT_ID);
  });

  it("denies sender settings before tenant data is loaded when tenant administration is absent", async () => {
    mocks.getEffectivePermissions.mockResolvedValue({
      platform: [],
      tenant: [PERMISSIONS.USERS_VIEW],
    });

    await expect(EmailSenderPage()).rejects.toThrow("REDIRECT:/dashboard");
    expect(mocks.getActiveTenant).not.toHaveBeenCalled();
    expect(mocks.getEmailSenderSettings).not.toHaveBeenCalled();
  });
});
