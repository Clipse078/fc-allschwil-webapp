/**
 * @vitest-environment jsdom
 *
 * SCE-DESIGN-04 — AdminSidebar motion integration tests
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AdminSidebar from "@/components/admin/layout/AdminSidebar";
import { PERMISSIONS } from "@/lib/permissions/permissions";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/useSidebarResize", () => ({
  useSidebarResize: () => ({
    width: 224,
    isResizing: false,
    onResizePointerDown: vi.fn(),
    onResizeKeyDown: vi.fn(),
  }),
}));

const CLUB_ADMIN_PERMISSIONS = Object.values(PERMISSIONS);

describe("AdminSidebar motion (SCE-DESIGN-04)", () => {
  it("renders nav icons with sce-motion-icon class and motion intents", () => {
    const { container } = render(
      <AdminSidebar
        permissionKeys={CLUB_ADMIN_PERMISSIONS}
        clubName="FC Allschwil"
        logoUrl={null}
      />,
    );

    const motionIcons = container.querySelectorAll(".sce-motion-icon");
    expect(motionIcons.length).toBeGreaterThan(0);

    const dashboardIcon = container.querySelector(
      '[data-motion-intent="hover"]',
    );
    expect(dashboardIcon).toBeInTheDocument();

    const trainingIcon = container.querySelector(
      '[data-motion-intent="schedule"]',
    );
    expect(trainingIcon).toBeInTheDocument();
  });

  it("preserves navigation links and hrefs", () => {
    render(
      <AdminSidebar
        permissionKeys={CLUB_ADMIN_PERMISSIONS}
        clubName="FC Allschwil"
        logoUrl={null}
      />,
    );

    const dashboardLink = screen.getByRole("link", { name: /Dashboard/i });
    expect(dashboardLink).toHaveAttribute("href", "/dashboard");

    const matchCenterLink = screen.getByRole("link", { name: /MatchCenter/i });
    expect(matchCenterLink).toHaveAttribute("href", "/dashboard/matchcenter");
  });

  it("does not render continuous animation classes", () => {
    const { container } = render(
      <AdminSidebar
        permissionKeys={CLUB_ADMIN_PERMISSIONS}
        clubName="FC Allschwil"
        logoUrl={null}
      />,
    );

    const animatedElements = container.querySelectorAll(
      '[class*="animate-spin"], [class*="animate-pulse"], [class*="animate-bounce"]',
    );
    expect(animatedElements.length).toBe(0);
  });
});
