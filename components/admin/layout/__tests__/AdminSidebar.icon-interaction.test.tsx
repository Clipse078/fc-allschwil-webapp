/**
 * @vitest-environment jsdom
 *
 * SCE-DESIGN-04C/04D — Pointer enter/leave interaction tests
 */

import { render, fireEvent } from "@testing-library/react";
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

describe("AdminSidebar icon interaction (SCE-DESIGN-04C)", () => {
  it("deterministically resets icon state after pointer leave", () => {
    const { container } = render(
      <AdminSidebar
        permissionKeys={CLUB_ADMIN_PERMISSIONS}
        clubName="FC Allschwil"
        logoUrl={null}
      />,
    );

    const websiteLink = container.querySelector(
      'a.sce-nav-item[href="/dashboard/website"]',
    ) as HTMLElement;
    expect(websiteLink).toBeTruthy();

    const icon = websiteLink.querySelector(".sce-animated-nav-icon");
    expect(icon).toBeTruthy();

    fireEvent.mouseEnter(websiteLink);
    fireEvent.mouseLeave(websiteLink);

    expect(icon).not.toHaveStyle({ transform: "rotate(14deg)" });
    expect(icon).not.toHaveClass("sce-motion-icon");
  });

  it("replays hover animation on re-hover without accumulating transforms", () => {
    const { container } = render(
      <AdminSidebar
        permissionKeys={CLUB_ADMIN_PERMISSIONS}
        clubName="FC Allschwil"
        logoUrl={null}
      />,
    );

    const link = container.querySelector(
      'a.sce-nav-child[href="/dashboard/website/news"]',
    ) as HTMLElement;
    expect(link).toBeTruthy();

    const icon = link.querySelector("svg.sce-animated-nav-icon");
    expect(icon).toBeTruthy();

    fireEvent.mouseEnter(link);
    fireEvent.mouseLeave(link);
    fireEvent.mouseEnter(link);
    fireEvent.mouseLeave(link);

    expect(icon).not.toHaveAttribute("style");
  });

  it("keeps nav links keyboard-focusable", () => {
    const { container } = render(
      <AdminSidebar
        permissionKeys={CLUB_ADMIN_PERMISSIONS}
        clubName="FC Allschwil"
        logoUrl={null}
      />,
    );

    const links = container.querySelectorAll("a.sce-nav-item, a.sce-nav-child");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute("href");
    }
  });

  it("does not use whole-icon transform on animated icons", () => {
    const { container } = render(
      <AdminSidebar
        permissionKeys={CLUB_ADMIN_PERMISSIONS}
        clubName="FC Allschwil"
        logoUrl={null}
      />,
    );

    const icons = container.querySelectorAll(".sce-animated-nav-icon");
    for (const icon of icons) {
      expect(icon).not.toHaveClass("sce-motion-icon");
      expect(icon).toHaveAttribute("data-nav-icon");
    }
  });
});
