import { describe, it, expect, vi } from "vitest";
import { runLoginTimingMitigation } from "../login-timing";
import { verifyPassword } from "../password";

vi.mock("../password", () => ({
  verifyPassword: vi.fn().mockResolvedValue(false),
}));

describe("runLoginTimingMitigation", () => {
  it("runs bcrypt verification without logging the password", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await runLoginTimingMitigation("secret-test-password");

    expect(verifyPassword).toHaveBeenCalledWith(
      "secret-test-password",
      expect.stringMatching(/^\$2a\$12\$/),
    );
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
