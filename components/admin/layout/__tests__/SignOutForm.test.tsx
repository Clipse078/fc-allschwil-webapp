/**
 * @vitest-environment jsdom
 *
 * SCE-AUTH-LOGOUT-03 — shared logout control hard-navigates to /login.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SignOutForm from "@/components/admin/layout/SignOutForm";

const { mockSignOutAction } = vi.hoisted(() => ({
  mockSignOutAction: vi.fn(),
}));

vi.mock("@/app/actions/auth-actions", () => ({
  signOutAction: mockSignOutAction,
}));

describe("SignOutForm", () => {
  const assignSpy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOutAction.mockResolvedValue(undefined);
    assignSpy.mockReset();
    vi.stubGlobal("location", {
      ...window.location,
      assign: assignSpy,
    });
  });

  it("calls canonical signOutAction then hard-navigates to /login", async () => {
    const user = userEvent.setup();

    render(
      <SignOutForm>
        <button type="submit">Abmelden</button>
      </SignOutForm>,
    );

    await user.click(screen.getByRole("button", { name: "Abmelden" }));

    expect(mockSignOutAction).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith("/login");
  });
});
