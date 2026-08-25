/**
 * MEDIA-LOGO-01G7/G10 — temporary operation authorization tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isMediaLogoBackfillAuthEnvironmentAllowed,
  requireMediaLogoBackfillApiAccess,
} from "../media-logo-backfill-operation-auth";
import { MEDIA_LOGO_CONTROLLED_PREVIEW_BRANCH } from "../media-logo-backfill-operation-environment";
import { PERMISSIONS } from "@/lib/permissions/permissions";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  getCurrentTenantContextById: vi.fn(),
}));

vi.mock("@/lib/permissions/require-api-permission", () => ({
  requireApiPermission: (...args: unknown[]) => mocks.requireApiPermission(...args),
}));

vi.mock("@/lib/tenants/context", () => ({
  getCurrentTenantContextById: (...args: unknown[]) => mocks.getCurrentTenantContextById(...args),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));

const ORIGINAL_ENV = { ...process.env };

const STAGE_DATABASE_URL =
  "postgresql://neondb_owner:secret@ep-wispy-hall-aso93dy6-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require";

const FC_ALLSCHWIL_TENANT = {
  id: "tenant-fc-allschwil",
  key: "fc-allschwil",
  name: "FC Allschwil",
  status: "ACTIVE",
};

function authorizedApiAccess() {
  return {
    ok: true,
    status: 200,
    error: null,
    session: {
      user: {
        id: "user-michael",
        activeTenantId: FC_ALLSCHWIL_TENANT.id,
      },
    },
  };
}

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
  mocks.requireApiPermission.mockResolvedValue(authorizedApiAccess());
  mocks.getCurrentTenantContextById.mockResolvedValue(FC_ALLSCHWIL_TENANT);
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("isMediaLogoBackfillAuthEnvironmentAllowed", () => {
  it("allows APP_ENV=stage", () => {
    expect(isMediaLogoBackfillAuthEnvironmentAllowed()).toBe(true);
  });

  it("allows controlled Preview with PROD APP_ENV and STAGE database", () => {
    enableControlledPreviewRuntime();
    expect(isMediaLogoBackfillAuthEnvironmentAllowed()).toBe(true);
  });

  it("denies APP_ENV=local", () => {
    process.env.APP_ENV = "local";
    expect(isMediaLogoBackfillAuthEnvironmentAllowed()).toBe(false);
  });

  it("denies production APP_ENV=prod without controlled Preview", () => {
    process.env.APP_ENV = "prod";
    expect(isMediaLogoBackfillAuthEnvironmentAllowed()).toBe(false);
  });
});

describe("requireMediaLogoBackfillApiAccess", () => {
  it("1. grants fc-allschwil user with WEBSITE_MANAGE for preflight/execute auth", async () => {
    const access = await requireMediaLogoBackfillApiAccess();

    expect(access.ok).toBe(true);
    expect(mocks.requireApiPermission).toHaveBeenCalledWith(PERMISSIONS.WEBSITE_MANAGE);
    expect(access.tenant?.key).toBe("fc-allschwil");
  });

  it("10. grants fc-allschwil WEBSITE_MANAGE user on controlled Preview", async () => {
    enableControlledPreviewRuntime();

    const access = await requireMediaLogoBackfillApiAccess();

    expect(access.ok).toBe(true);
    expect(mocks.requireApiPermission).toHaveBeenCalledWith(PERMISSIONS.WEBSITE_MANAGE);
    expect(access.tenant?.key).toBe("fc-allschwil");
  });

  it("4. denies user without WEBSITE_MANAGE", async () => {
    mocks.requireApiPermission.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Forbidden",
      session: { user: { id: "user-1", activeTenantId: FC_ALLSCHWIL_TENANT.id } },
    });

    const access = await requireMediaLogoBackfillApiAccess();

    expect(access.ok).toBe(false);
    expect(access.status).toBe(403);
    expect(mocks.getCurrentTenantContextById).not.toHaveBeenCalled();
  });

  it("12. denies WEBSITE_MANAGE user for another tenant", async () => {
    mocks.getCurrentTenantContextById.mockResolvedValue({
      id: "tenant-other",
      key: "other-club",
      name: "Other Club",
      status: "ACTIVE",
    });

    const access = await requireMediaLogoBackfillApiAccess();

    expect(access.ok).toBe(false);
    expect(access.status).toBe(403);
  });

  it("6. denies fc-allschwil user when APP_ENV is not stage and Preview is not controlled", async () => {
    process.env.APP_ENV = "local";

    const access = await requireMediaLogoBackfillApiAccess();

    expect(access.ok).toBe(false);
    expect(access.status).toBe(403);
    expect(mocks.requireApiPermission).not.toHaveBeenCalled();
  });

  it("7. fails closed in production environment without controlled Preview", async () => {
    process.env.APP_ENV = "prod";

    const access = await requireMediaLogoBackfillApiAccess();

    expect(access.ok).toBe(false);
    expect(access.status).toBe(403);
    expect(mocks.requireApiPermission).not.toHaveBeenCalled();
  });

  it("8. does not require TENANTS_MANAGE", async () => {
    await requireMediaLogoBackfillApiAccess();

    expect(mocks.requireApiPermission).toHaveBeenCalledWith(PERMISSIONS.WEBSITE_MANAGE);
    expect(mocks.requireApiPermission).not.toHaveBeenCalledWith(PERMISSIONS.TENANTS_MANAGE);
  });

  it("denies when active tenant is missing", async () => {
    mocks.requireApiPermission.mockResolvedValue({
      ok: true,
      status: 200,
      error: null,
      session: { user: { id: "user-1", activeTenantId: null } },
    });

    const access = await requireMediaLogoBackfillApiAccess();

    expect(access.ok).toBe(false);
    expect(access.status).toBe(403);
  });
});
