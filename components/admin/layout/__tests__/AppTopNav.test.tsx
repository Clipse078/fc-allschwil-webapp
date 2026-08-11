/**
 * @vitest-environment jsdom
 *
 * DASHBOARD-SHELL-UX-01 — top bar cleanup: the non-functional global search
 * control must no longer be exposed.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AppTopNav from "@/components/admin/layout/AppTopNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

describe("AppTopNav", () => {
  it("does not render a global search control", () => {
    render(<AppTopNav firstName="Michael" lastName="Duft" />);
    expect(screen.queryByLabelText("Suche")).not.toBeInTheDocument();
    expect(screen.queryByText("Suche…")).not.toBeInTheDocument();
    expect(screen.queryByText("⌘K")).not.toBeInTheDocument();
  });

  it("renders the German 'Start' breadcrumb for the dashboard", () => {
    render(<AppTopNav firstName="Michael" lastName="Duft" />);
    expect(screen.getByText("Start")).toBeInTheDocument();
  });
});
