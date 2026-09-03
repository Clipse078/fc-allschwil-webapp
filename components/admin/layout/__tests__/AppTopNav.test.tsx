/**
 * @vitest-environment jsdom
 *
 * DASHBOARD-SHELL-UX-01 — top bar cleanup: the non-functional global search
 * control must no longer be exposed.
 *
 * SCE-DESIGN-02 — account menu replaces direct avatar link to Mein Konto.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import AppTopNav from "@/components/admin/layout/AppTopNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/app/actions/auth-actions", () => ({
  signOutAction: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

describe("AppTopNav", () => {
  it("does not render a global search control", () => {
    render(
      <AppTopNav
        firstName="Michael"
        lastName="Duft"
        email="michael@fc-allschwil.ch"
      />,
    );
    expect(screen.queryByLabelText("Suche")).not.toBeInTheDocument();
    expect(screen.queryByText("Suche…")).not.toBeInTheDocument();
    expect(screen.queryByText("⌘K")).not.toBeInTheDocument();
  });

  it("does not render non-functional Bell / Help / Settings placeholder buttons", () => {
    render(
      <AppTopNav
        firstName="Michael"
        lastName="Duft"
        email="michael@fc-allschwil.ch"
      />,
    );
    expect(screen.queryByLabelText("Benachrichtigungen")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Hilfe")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Einstellungen")).not.toBeInTheDocument();
  });

  it("renders the account menu trigger with initials", () => {
    render(
      <AppTopNav
        firstName="Michael"
        lastName="Duft"
        email="michael@fc-allschwil.ch"
      />,
    );
    const trigger = screen.getByLabelText("Konto-Menü");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("MD");
  });

  it("opens account menu with Mein Konto link", async () => {
    const user = userEvent.setup();
    render(
      <AppTopNav
        firstName="Michael"
        lastName="Duft"
        email="michael@fc-allschwil.ch"
      />,
    );

    await user.click(screen.getByLabelText("Konto-Menü"));
    expect(screen.getByRole("link", { name: "Mein Konto" })).toHaveAttribute(
      "href",
      "/dashboard/account",
    );
  });

  it("renders the German 'Start' breadcrumb for the dashboard", () => {
    render(
      <AppTopNav
        firstName="Michael"
        lastName="Duft"
        email="michael@fc-allschwil.ch"
      />,
    );
    expect(screen.getByText("Start")).toBeInTheDocument();
  });
});
