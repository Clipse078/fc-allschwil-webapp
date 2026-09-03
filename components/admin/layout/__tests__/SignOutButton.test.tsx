/**
 * @vitest-environment jsdom
 *
 * SCE-AUTH-LOGOUT-03 — SignOutButton uses canonical logout path.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SignOutButton from "@/components/admin/layout/SignOutButton";

const { mockSignOutAction } = vi.hoisted(() => ({
  mockSignOutAction: vi.fn(),
}));

vi.mock("@/app/actions/auth-actions", () => ({
  signOutAction: mockSignOutAction,
}));

describe("SignOutButton", () => {
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

  it("exposes Abmelden and uses canonical logout path", async () => {
    const user = userEvent.setup();

    render(<SignOutButton />);

    await user.click(screen.getByRole("button", { name: "Abmelden" }));

    expect(mockSignOutAction).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith("/login");
  });
});
