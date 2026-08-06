/**
 * @vitest-environment jsdom
 */

/**
 * RPERM-04-C1 — Tenant Registrations Cockpit Page: Tenant-Slug Isolation
 *
 * Covers app/(admin)/tenant/[tenantSlug]/cockpit/registrations/page.tsx.
 *
 * Finding 2 fix under test: the page must resolve + validate the tenant
 * named by the URL's tenantSlug via requireTenantContextForSlug() FIRST,
 * then evaluate registrations.view/registrations.edit against that EXACT
 * tenantId — never against session.user.activeTenantId — and must fetch
 * registration/user/target-group data scoped to that same tenantId.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTenantContextForSlug: vi.fn(),
  requireAnyPermission: vi.fn(),
  hasPermission: vi.fn(),
  listRegistrationsForTenant: vi.fn(),
  userFindMany: vi.fn(),
  targetGroupFindMany: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/tenants/active-tenant", () => ({
  requireTenantContextForSlug: mocks.requireTenantContextForSlug,
}));
vi.mock("@/lib/permissions/require-any-permission", () => ({
  requireAnyPermission: mocks.requireAnyPermission,
}));
vi.mock("@/lib/permissions/has-permission", () => ({
  hasPermission: mocks.hasPermission,
}));
vi.mock("@/lib/registrations/queries", () => ({
  listRegistrationsForTenant: mocks.listRegistrationsForTenant,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findMany: mocks.userFindMany },
    targetGroup: { findMany: mocks.targetGroupFindMany },
  },
}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));
vi.mock("@/components/admin/registrations/RegistrationInbox", () => ({
  default: (props: { tenantSlug: string }) => (
    <div data-testid="registration-inbox">tenantSlug={props.tenantSlug}</div>
  ),
}));

const TENANT_A_ID = "tenant-a-id";
const TENANT_A_CONTEXT = {
  id: TENANT_A_ID,
  key: "tenant-a",
  name: "Tenant A",
  locale: "de-CH",
  timezone: "Europe/Zurich",
  membershipId: "membership-a",
};

async function renderPage(tenantSlug: string) {
  const { default: TenantRegistrationsPage } = await import(
    "@/app/(admin)/tenant/[tenantSlug]/cockpit/registrations/page"
  );
  return render(await TenantRegistrationsPage({ params: Promise.resolve({ tenantSlug }) }));
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  });
  mocks.userFindMany.mockResolvedValue([]);
  mocks.targetGroupFindMany.mockResolvedValue([]);
  mocks.listRegistrationsForTenant.mockResolvedValue([]);
  mocks.hasPermission.mockReturnValue(false);
});

describe("TenantRegistrationsPage — tenant-slug isolation", () => {
  it("redirects to /dashboard before fetching any data when the slug does not resolve to a valid, member tenant", async () => {
    mocks.requireTenantContextForSlug.mockImplementation(() => {
      // Mirrors requireTenantContextForSlug()'s real redirect behavior.
      mocks.redirect("/dashboard");
    });

    await expect(renderPage("tenant-b")).rejects.toThrow("REDIRECT:/dashboard");

    expect(mocks.requireAnyPermission).not.toHaveBeenCalled();
    expect(mocks.listRegistrationsForTenant).not.toHaveBeenCalled();
  });

  it("evaluates registrations permission against the slug-resolved tenantId, not an omitted/default tenant", async () => {
    mocks.requireTenantContextForSlug.mockResolvedValue(TENANT_A_CONTEXT);
    mocks.requireAnyPermission.mockResolvedValue({
      user: { id: "user-1", effectiveUserId: "user-1" },
    });

    await renderPage("tenant-a");

    expect(mocks.requireTenantContextForSlug).toHaveBeenCalledWith("tenant-a");
    // CRITICAL: tenantId argument must be the slug-resolved tenant.
    expect(mocks.requireAnyPermission).toHaveBeenCalledWith(
      expect.any(Array),
      TENANT_A_ID,
    );
  });

  it("fetches registrations, users, and target groups scoped to the slug-resolved tenantId", async () => {
    mocks.requireTenantContextForSlug.mockResolvedValue(TENANT_A_CONTEXT);
    mocks.requireAnyPermission.mockResolvedValue({
      user: { id: "user-1", effectiveUserId: "user-1" },
    });

    await renderPage("tenant-a");

    expect(mocks.listRegistrationsForTenant).toHaveBeenCalledWith("tenant-a");
    expect(mocks.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_A_ID }),
      }),
    );
    expect(mocks.targetGroupFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ tenantId: TENANT_A_ID }, { tenantId: null }],
        }),
      }),
    );
    expect(screen.getByTestId("registration-inbox")).toHaveTextContent("tenantSlug=tenant-a");
  });
});
