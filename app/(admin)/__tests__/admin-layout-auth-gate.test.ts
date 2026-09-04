/**
 * SCE-AUTH-LOGOUT-03 — admin shell rejects unauthenticated users.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockRedirect = vi.fn((url: string): never => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("@/lib/tenants/active-tenant", () => ({
  getActiveTenant: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/people/queries", () => ({
  getPersonProfileByUserId: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/components/admin/layout/AdminSidebar", () => ({
  default: () => null,
}));
vi.mock("@/components/admin/layout/AppTopNav", () => ({
  default: () => null,
}));
vi.mock("@/components/admin/deployment/StageEnvironmentBanner", () => ({
  default: () => null,
}));

describe("admin layout auth gate", () => {
  beforeEach(() => {
    vi.resetModules();
    mockRedirect.mockImplementation((url: string): never => {
      throw new Error(`REDIRECT:${url}`);
    });
  });

  it("redirects unauthenticated users to /login", async () => {
    mockAuth.mockResolvedValue(null);

    const { default: AdminLayout } = await import("../layout");

    await expect(AdminLayout({ children: null })).rejects.toThrow("REDIRECT:/login");
  });
});
