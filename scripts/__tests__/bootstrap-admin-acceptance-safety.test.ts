import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("bootstrap admin Acceptance safety", () => {
  it("uses the canonical runtime and treats Acceptance as password-protected", () => {
    const source = readFileSync(
      resolve(process.cwd(), "prisma/bootstrap-admin.ts"),
      "utf8",
    );

    expect(source).toContain("getRuntimeEnvironment");
    expect(source).toContain("runtime.isAcceptance");
    expect(source).toContain(
      'allowedRemoteEnvironments: ["stage", "prod"]',
    );
  });
});
