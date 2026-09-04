/**
 * @vitest-environment jsdom
 *
 * SCE-DESIGN-02 — account identity moved from sidebar footer to header menu.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AccountMenu from "@/components/admin/layout/AccountMenu";

vi.mock("@/app/actions/auth-actions", () => ({
  signOutAction: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

describe("AccountMenu", () => {
  const assignSpy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    assignSpy.mockReset();
    vi.stubGlobal("location", {
      ...window.location,
      assign: assignSpy,
    });
  });

  it("opens a dropdown with name, email, account link and logout", async () => {
    const user = userEvent.setup();

    render(
      <AccountMenu
        firstName="Michael"
        lastName="Duijster"
        email="it@fcallschwil.ch"
        imageUrl={null}
      />,
    );

    await user.click(screen.getByLabelText("Konto-Menü"));

    expect(screen.getByText("Michael Duijster")).toBeInTheDocument();
    expect(screen.getByText("it@fcallschwil.ch")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mein Konto" })).toHaveAttribute(
      "href",
      "/dashboard/account",
    );
    expect(screen.getByRole("button", { name: "Abmelden" })).toBeInTheDocument();
  });

  it("uses canonical logout path and hard-navigates to /login", async () => {
    const user = userEvent.setup();
    const { signOutAction } = await import("@/app/actions/auth-actions");

    render(
      <AccountMenu
        firstName="Michael"
        lastName="Duijster"
        email="it@fcallschwil.ch"
        imageUrl={null}
      />,
    );

    await user.click(screen.getByLabelText("Konto-Menü"));
    await user.click(screen.getByRole("button", { name: "Abmelden" }));

    expect(signOutAction).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith("/login");
  });
});
