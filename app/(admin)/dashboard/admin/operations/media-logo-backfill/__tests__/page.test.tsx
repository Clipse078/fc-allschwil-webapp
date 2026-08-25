/**
 * @vitest-environment jsdom
 *
 * MEDIA-LOGO-01G7 — temporary operation page authorization tests.
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAnyPermission: vi.fn(),
  getActiveTenant: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  isMediaLogoBackfillAuthEnvironmentAllowed: vi.fn(),
}));

vi.mock("@/lib/permissions/require-any-permission", () => ({
  requireAnyPermission: mocks.requireAnyPermission,
}));

vi.mock("@/lib/tenants/active-tenant", () => ({
  getActiveTenant: mocks.getActiveTenant,
}));

vi.mock("@/lib/assets/media-logo-backfill-operation-auth", () => ({
  isMediaLogoBackfillAuthEnvironmentAllowed: mocks.isMediaLogoBackfillAuthEnvironmentAllowed,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));

vi.mock("@/components/admin/operations/MediaLogoBackfillOperationPanel", () => ({
  default: () => <div data-testid="media-logo-backfill-panel">panel</div>,
}));

const ORIGINAL_ENV = { ...process.env };

const FC_ALLSCHWIL_TENANT = {
  id: "tenant-fc-allschwil",
  key: "fc-allschwil",
  name: "FC Allschwil",
  status: "ACTIVE",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  mocks.isMediaLogoBackfillAuthEnvironmentAllowed.mockReturnValue(true);
  mocks.requireAnyPermission.mockResolvedValue({
    user: { id: "user-michael", activeTenantId: FC_ALLSCHWIL_TENANT.id },
  });
  mocks.getActiveTenant.mockResolvedValue(FC_ALLSCHWIL_TENANT);
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("MediaLogoBackfillOperationPage", () => {
  it("1. allows fc-allschwil user with WEBSITE_MANAGE to access page", async () => {
    const Page = (await import("../page")).default;
    render(await Page());

    expect(screen.getByTestId("media-logo-backfill-panel")).toBeInTheDocument();
    expect(mocks.requireAnyPermission).toHaveBeenCalledWith(["website.manage"]);
  });

  it("6. redirects when APP_ENV is not stage", async () => {
    mocks.isMediaLogoBackfillAuthEnvironmentAllowed.mockReturnValue(false);

    const Page = (await import("../page")).default;

    await expect(Page()).rejects.toThrow("REDIRECT:/dashboard");
    expect(mocks.requireAnyPermission).not.toHaveBeenCalled();
  });

  it("7. redirects in production environment", async () => {
    mocks.isMediaLogoBackfillAuthEnvironmentAllowed.mockReturnValue(false);

    const Page = (await import("../page")).default;

    await expect(Page()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("5. redirects when active tenant is not fc-allschwil", async () => {
    mocks.getActiveTenant.mockResolvedValue({
      id: "tenant-other",
      key: "other-club",
      name: "Other Club",
      status: "ACTIVE",
    });

    const Page = (await import("../page")).default;

    await expect(Page()).rejects.toThrow("REDIRECT:/dashboard");
  });
});
