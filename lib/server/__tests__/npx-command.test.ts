import { describe, expect, it } from "vitest";
import { resolveNpxCommand } from "@/lib/server/npx-command";

describe("resolveNpxCommand", () => {
  it("uses npx.cmd on Windows", () => {
    expect(resolveNpxCommand("win32")).toBe("npx.cmd");
  });

  it("uses npx on non-Windows platforms", () => {
    expect(resolveNpxCommand("linux")).toBe("npx");
    expect(resolveNpxCommand("darwin")).toBe("npx");
    expect(resolveNpxCommand("freebsd")).toBe("npx");
  });
});
