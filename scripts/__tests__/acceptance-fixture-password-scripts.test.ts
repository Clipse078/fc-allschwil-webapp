import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("acceptance fixture password scripts", () => {
  it("keeps sync and verify scripts narrowly scoped to Acceptance fixture password hashes", () => {
    const syncSource = readFileSync(
      resolve(process.cwd(), "scripts/acceptance-sync-fixture-passwords.ts"),
      "utf8",
    );
    const verifySource = readFileSync(
      resolve(process.cwd(), "scripts/acceptance-verify-fixture-passwords.ts"),
      "utf8",
    );

    expect(syncSource).toContain("assertAcceptanceFixturePasswordSyncAuthorization");
    expect(syncSource).toContain("syncAcceptanceFixturePasswordHashes");
    expect(syncSource).not.toContain("bootstrapAcceptanceData");
    expect(syncSource).not.toContain("user.create");
    expect(syncSource).not.toMatch(/console\.log\([^)]*PASSWORD/i);

    expect(verifySource).toContain("assertAcceptanceFixturePasswordDatabaseTarget");
    expect(verifySource).toContain("verifyAcceptanceFixturePasswordMatches");
    expect(verifySource).not.toContain("UPDATE");
    expect(verifySource).not.toMatch(/console\.log\([^)]*PASSWORD/i);
  });
});
