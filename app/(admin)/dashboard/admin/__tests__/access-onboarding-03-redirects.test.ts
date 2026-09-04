import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

describe("ACCESS-ONBOARDING-03 — legacy route redirects", () => {
  it("redirects /dashboard/admin/users to people-access", async () => {
    const { default: AdminUsersRedirectPage } = await import(
      "@/app/(admin)/dashboard/admin/users/page"
    );
    expect(() => AdminUsersRedirectPage()).toThrow("REDIRECT:/dashboard/admin/people-access");
  });

  it("redirects /dashboard/admin/users/new to people-access/new", async () => {
    const { default: AdminUsersNewRedirectPage } = await import(
      "@/app/(admin)/dashboard/admin/users/new/page"
    );
    expect(() => AdminUsersNewRedirectPage()).toThrow("REDIRECT:/dashboard/admin/people-access/new");
  });
});
