/**
 * @vitest-environment jsdom
 *
 * SCE-DESIGN-02 — sidebar footer no longer shows personal identity;
 * account controls live in the header AccountMenu instead.
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

describe("SCE-DESIGN-02 — sidebar footer identity removed", () => {
  it("does not render personal name or email in the sidebar footer", () => {
    render(
      <AdminSidebar
        permissionKeys={CLUB_ADMIN_PERMISSIONS}
        clubName="FC Allschwil"
        logoUrl={null}
      />,
    );

    expect(screen.queryByText("Michael Duijster")).not.toBeInTheDocument();
    expect(screen.queryByText("it@fcallschwil.ch")).not.toBeInTheDocument();
    expect(screen.queryByText("Abmelden")).not.toBeInTheDocument();
  });

  it("still renders tenant brand in the header and platform brand in the footer", () => {
    render(
      <AdminSidebar
        permissionKeys={CLUB_ADMIN_PERMISSIONS}
        clubName="FC Allschwil"
        logoUrl={null}
      />,
    );

    expect(screen.getByText("FC Allschwil")).toBeInTheDocument();
    expect(screen.getByLabelText("SportClubEvo")).toBeInTheDocument();
  });
});
