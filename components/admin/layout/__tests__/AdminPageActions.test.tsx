/**
 * @vitest-environment jsdom
 *
 * DASHBOARD-SHELL-UX-01 — the tenant dashboard top bar no longer surfaces
 * the global "Planner öffnen" / "Saisons verwalten" shortcuts. Contextual
 * actions on their own dedicated pages (e.g. /dashboard/seasons) must be
 * unaffected.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AdminPageActions from "@/components/admin/layout/AdminPageActions";

const mockUsePathname = vi.fn();
const mockUseSearchParams = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
}));

function setRoute(pathname: string, search = "") {
  mockUsePathname.mockReturnValue(pathname);
  mockUseSearchParams.mockReturnValue(new URLSearchParams(search));
}

describe("AdminPageActions", () => {
  it("renders nothing on the global dashboard (no Planner öffnen / Saisons verwalten)", () => {
    setRoute("/dashboard");
    const { container } = render(<AdminPageActions />);
    expect(screen.queryByText("Planner öffnen")).not.toBeInTheDocument();
    expect(screen.queryByText("Saisons verwalten")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("still renders contextual actions on the dedicated Saisons page", () => {
    setRoute("/dashboard/seasons");
    render(<AdminPageActions />);
    expect(screen.getByText("Neue Saison")).toBeInTheDocument();
  });

  it("still renders contextual actions on the dedicated Saisonplanner page", () => {
    setRoute("/dashboard/planner");
    render(<AdminPageActions />);
    expect(screen.getByText("Neuer Eintrag")).toBeInTheDocument();
  });
});
