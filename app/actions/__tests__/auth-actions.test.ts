/**
 * SCE-AUTH-LOGOUT-03 — canonical server logout invalidates JWT via Auth.js.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSignOut } = vi.hoisted(() => ({
  mockSignOut: vi.fn(),
}));

vi.mock("@/auth", () => ({
  signOut: mockSignOut,
}));

describe("signOutAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue(undefined);
  });

  it("invalidates the session via Auth.js without server redirect", async () => {
    const { signOutAction } = await import("../auth-actions");

    await signOutAction();

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledWith({
      redirect: false,
      redirectTo: "/login",
    });
  });
});
