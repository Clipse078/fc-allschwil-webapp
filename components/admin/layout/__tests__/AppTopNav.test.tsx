/**
 * @vitest-environment jsdom
 *
 * DASHBOARD-SHELL-UX-01 — top bar cleanup: the non-functional global search
 * control must no longer be exposed.
 *
 * DASHBOARD-SHELL-UX-01-V — the Bell / Help / Settings icon buttons were
 * disabled, non-functional placeholders (no onClick/href) and have been
 * removed. Only functional shell controls (page actions, user identity)
 * remain in the top bar.
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

  it("does not render non-functional Bell / Help / Settings placeholder buttons", () => {
    render(<AppTopNav firstName="Michael" lastName="Duft" />);
    expect(screen.queryByLabelText("Benachrichtigungen")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Hilfe")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Einstellungen")).not.toBeInTheDocument();
  });

  it("still renders the functional user identity control", () => {
    render(<AppTopNav firstName="Michael" lastName="Duft" />);
    expect(screen.getByLabelText("Benutzerprofil")).toBeInTheDocument();
    expect(screen.getByLabelText("Benutzerprofil")).toHaveTextContent("MD");
  });

  it("renders the German 'Start' breadcrumb for the dashboard", () => {
    render(<AppTopNav firstName="Michael" lastName="Duft" />);
    expect(screen.getByText("Start")).toBeInTheDocument();
  });
});
