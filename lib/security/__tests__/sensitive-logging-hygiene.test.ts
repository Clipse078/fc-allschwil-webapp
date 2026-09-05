import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readRepositoryFile(relativePath: string): string {
  return readFileSync(new URL(`../../../${relativePath}`, import.meta.url), "utf8");
}

describe("sensitive logging hygiene", () => {
  it.each([
    "scripts/restore-admin-hash.ts",
    "scripts/stage-auth-diagnostic.ts",
  ])("does not print password-hash prefixes in %s", (path) => {
    const source = readRepositoryFile(path);

    expect(source).not.toMatch(/hash\s*prefix/i);
    expect(source).not.toMatch(/hash(?:\.|\s).*?(?:slice|substring)\s*\(/i);
  });
});
