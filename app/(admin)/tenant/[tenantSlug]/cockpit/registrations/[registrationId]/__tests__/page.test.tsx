/**
 * @vitest-environment jsdom
 */

/**
 * RPERM-04-C1 — Tenant Registration Detail Page: Tenant-Slug Isolation
 *
 * Covers app/(admin)/tenant/[tenantSlug]/cockpit/registrations/[registrationId]/page.tsx.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTenantContextForSlug: vi.fn(),
  requireAnyPermission: vi.fn(),
  hasPermission: vi.fn(),
  getRegistrationForTenant: vi.fn(),
  userFindMany: vi.fn(),
  targetGroupFindMany: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
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
  getRegistrationForTenant: mocks.getRegistrationForTenant,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findMany: mocks.userFindMany },
    targetGroup: { findMany: mocks.targetGroupFindMany },
  },
}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));
vi.mock("@/components/admin/registrations/RegistrationDetailCard", () => ({
  default: (props: { tenantSlug: string; initialRegistration: { id: string } }) => (
    <div data-testid="registration-detail">
      tenantSlug={props.tenantSlug} registrationId={props.initialRegistration.id}
    </div>
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

async function renderPage(tenantSlug: string, registrationId = "reg-1") {
  const { default: TenantRegistrationDetailPage } = await import(
    "@/app/(admin)/tenant/[tenantSlug]/cockpit/registrations/[registrationId]/page"
  );
  return render(
    await TenantRegistrationDetailPage({
      params: Promise.resolve({ tenantSlug, registrationId }),
    }),
  );
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  });
  mocks.notFound.mockImplementation(() => {
    throw new Error("NOT_FOUND");
  });
  mocks.userFindMany.mockResolvedValue([]);
  mocks.targetGroupFindMany.mockResolvedValue([]);
  mocks.hasPermission.mockReturnValue(false);
});

describe("TenantRegistrationDetailPage — tenant-slug isolation", () => {
  it("redirects to /dashboard before fetching the registration when the slug does not resolve to a valid, member tenant", async () => {
    mocks.requireTenantContextForSlug.mockImplementation(() => {
      mocks.redirect("/dashboard");
    });

    await expect(renderPage("tenant-b")).rejects.toThrow("REDIRECT:/dashboard");

    expect(mocks.requireAnyPermission).not.toHaveBeenCalled();
    expect(mocks.getRegistrationForTenant).not.toHaveBeenCalled();
  });

  it("evaluates registrations permission against the slug-resolved tenantId and fetches via the same slug", async () => {
    mocks.requireTenantContextForSlug.mockResolvedValue(TENANT_A_CONTEXT);
    mocks.requireAnyPermission.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getRegistrationForTenant.mockResolvedValue({ id: "reg-1" });

    await renderPage("tenant-a", "reg-1");

    expect(mocks.requireTenantContextForSlug).toHaveBeenCalledWith("tenant-a");
    expect(mocks.requireAnyPermission).toHaveBeenCalledWith(expect.any(Array), TENANT_A_ID);
    expect(mocks.getRegistrationForTenant).toHaveBeenCalledWith("tenant-a", "reg-1");
    expect(mocks.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A_ID }) }),
    );
    expect(screen.getByTestId("registration-detail")).toHaveTextContent("tenantSlug=tenant-a");
  });
});
