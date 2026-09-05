import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const scriptPath = resolve(root, "scripts/break-glass-superadmin-password.ts");
const source = readFileSync(scriptPath, "utf8");

describe("platform Superadmin break-glass tooling", () => {
  it("requires an operator-supplied target and explicit exceptional intent", () => {
    expect(source).toContain("TARGET_SUPERADMIN_EMAIL");
    expect(source).toContain(
      "BREAK_GLASS_CONFIRM=RESET_EXISTING_ACTIVE_PLATFORM_SUPERADMIN",
    );
    expect(source).toContain("assertOperationalMutationAllowed");
    expect(source).toContain("SCE_OPERATION_AUTHORIZATION");
  });

  it("contains no hardcoded privileged account email or credential", () => {
    expect(source).not.toMatch(/[A-Z0-9._%+-]+@fcallschwil\.ch/i);
    expect(source).not.toContain("password123");
    expect(source).not.toContain("$2a$");
    expect(source).not.toContain("$2b$");
  });

  it("never creates, activates, or promotes the target account", () => {
    expect(source).not.toContain("tx.user.create");
    expect(source).not.toContain("tx.user.upsert");
    expect(source).not.toContain("tx.userRole.create");
    expect(source).not.toMatch(/data:\s*\{[^}]*isActive:\s*true/);
  });

  it("revokes prior sessions and records an exceptional audit event", () => {
    expect(source).toContain("passwordChangedAt");
    expect(source).toContain("BREAK_GLASS_PASSWORD_RESET");
    expect(source).toContain("auditLog.create");
  });

  it("removes obsolete account-specific password mutation scripts", () => {
    expect(
      existsSync(resolve(root, "scripts/restore-admin-hash.ts")),
    ).toBe(false);
    expect(
      existsSync(resolve(root, "scripts/stage-auth-password-reset-approved.ts")),
    ).toBe(false);
  });

  it("does not print password, hash, token, email, or database URL values", () => {
    const consoleArguments = [...source.matchAll(/console\.(?:log|error)\(([\s\S]*?)\);/g)]
      .map((match) => match[1])
      .join("\n");
    expect(consoleArguments).not.toMatch(/\$\{(?:password|passwordHash|targetEmail|databaseUrl)\}/);
    expect(consoleArguments).not.toMatch(/console\.(?:log|error)\(\s*(?:password|passwordHash|targetEmail|databaseUrl)\b/);
  });
});
