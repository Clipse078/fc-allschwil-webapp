/**
 * @vitest-environment jsdom
 *
 * MEDIA-LOGO-01G7/G10 — temporary operation page authorization tests.
 */

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MEDIA_LOGO_CONTROLLED_PREVIEW_BRANCH } from "@/lib/assets/media-logo-backfill-operation-environment";

const mocks = vi.hoisted(() => ({
  requireAnyPermission: vi.fn(),
  getActiveTenant: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("@/lib/permissions/require-any-permission", () => ({
  requireAnyPermission: mocks.requireAnyPermission,
}));

vi.mock("@/lib/tenants/active-tenant", () => ({
  getActiveTenant: mocks.getActiveTenant,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));

vi.mock("@/components/admin/operations/MediaLogoBackfillOperationPanel", () => ({
  default: () => <div data-testid="media-logo-backfill-panel">panel</div>,
}));

const ORIGINAL_ENV = { ...process.env };

const STAGE_DATABASE_URL =
  "postgresql://neondb_owner:secret@ep-wispy-hall-aso93dy6-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require";

const FC_ALLSCHWIL_TENANT = {
  id: "tenant-fc-allschwil",
  key: "fc-allschwil",
  name: "FC Allschwil",
  status: "ACTIVE",
};

function enableControlledPreviewRuntime() {
  process.env.APP_ENV = "prod";
  process.env.VERCEL = "1";
  process.env.VERCEL_ENV = "preview";
  process.env.VERCEL_GIT_COMMIT_REF = MEDIA_LOGO_CONTROLLED_PREVIEW_BRANCH;
  process.env.DATABASE_URL = STAGE_DATABASE_URL;
  process.env.STAGE_DB_URL = STAGE_DATABASE_URL;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "stage";
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

  it("9. allows Michael-equivalent fc-allschwil user on controlled Preview", async () => {
    enableControlledPreviewRuntime();

    const Page = (await import("../page")).default;
    render(await Page());

    expect(screen.getByTestId("media-logo-backfill-panel")).toBeInTheDocument();
    expect(mocks.requireAnyPermission).toHaveBeenCalledWith(["website.manage"]);
  });

  it("6. redirects when APP_ENV is not stage and Preview is not controlled", async () => {
    process.env.APP_ENV = "local";

    const Page = (await import("../page")).default;

    await expect(Page()).rejects.toThrow("REDIRECT:/dashboard");
    expect(mocks.requireAnyPermission).not.toHaveBeenCalled();
  });

  it("7. redirects in production environment without controlled Preview", async () => {
    process.env.APP_ENV = "prod";

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
