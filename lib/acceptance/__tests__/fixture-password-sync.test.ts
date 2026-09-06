import { describe, expect, it, vi } from "vitest";
import {
  ACCEPTANCE_DATABASE_NAME,
  ACCEPTANCE_FIXTURE,
  type AcceptancePasswords,
} from "@/lib/acceptance/bootstrap";
import {
  ACCEPTANCE_FIXTURE_PASSWORD_SYNC_AUTHORIZATION,
  ACCEPTANCE_FIXTURE_PASSWORD_SYNC_CONFIRM,
  assertAcceptanceFixturePasswordDatabaseTarget,
  assertAcceptanceFixturePasswordSyncAuthorization,
  formatAcceptanceFixturePasswordSyncOutput,
  formatAcceptanceFixturePasswordVerifyOutput,
  syncAcceptanceFixturePasswordHashes,
  verifyAcceptanceFixturePasswordMatches,
} from "@/lib/acceptance/fixture-password-sync";
import { hashPassword } from "@/lib/auth/password";

const POOLED_HOST =
  "ep-icy-scene-b21dwo4d-pooler.c-6.eu-central-1.aws.neon.tech";
const DIRECT_HOST = "ep-icy-scene-b21dwo4d.c-6.eu-central-1.aws.neon.tech";
const ACCEPTANCE_USER = "acceptance_owner";

function pooledDatabaseUrl(
  host: string = POOLED_HOST,
  database: string = ACCEPTANCE_DATABASE_NAME,
): string {
  return `postgresql://${ACCEPTANCE_USER}:secret@${host}:5432/${database}?sslmode=require`;
}

function passwordsFromFixture(): AcceptancePasswords {
  return Object.fromEntries(
    Object.values(ACCEPTANCE_FIXTURE.users).map((user) => [
      user.passwordEnv,
      `test-${user.passwordEnv}-credential`,
    ]),
  ) as AcceptancePasswords;
}

function validEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    APP_ENV: "acceptance",
    ACCEPTANCE_DATABASE_HOST: POOLED_HOST,
    ACCEPTANCE_DATABASE_USER: ACCEPTANCE_USER,
    ACCEPTANCE_DATABASE_PASSWORD: "db-password-value",
    ACCEPTANCE_FIXTURE_PASSWORD_SYNC_CONFIRM: ACCEPTANCE_FIXTURE_PASSWORD_SYNC_CONFIRM,
    SCE_OPERATION_AUTHORIZATION: ACCEPTANCE_FIXTURE_PASSWORD_SYNC_AUTHORIZATION,
    ...passwordsFromFixture(),
    ...overrides,
  };
}

describe("acceptance fixture password sync", () => {
  it("accepts a valid Acceptance pooled database target", () => {
    const target = assertAcceptanceFixturePasswordDatabaseTarget(
      validEnvironment({
        DATABASE_URL: pooledDatabaseUrl(),
      }),
    );

    expect(target).toEqual({
      databaseUrl: pooledDatabaseUrl(),
      host: POOLED_HOST,
      database: ACCEPTANCE_DATABASE_NAME,
    });
  });

  it("rejects non-Acceptance APP_ENV", () => {
    expect(() =>
      assertAcceptanceFixturePasswordDatabaseTarget(
        validEnvironment({ APP_ENV: "stage" }),
      ),
    ).toThrow(/APP_ENV/);
  });

  it("rejects /neondb", () => {
    expect(() =>
      assertAcceptanceFixturePasswordDatabaseTarget(
        validEnvironment({
          DATABASE_URL: pooledDatabaseUrl(POOLED_HOST, "neondb"),
        }),
      ),
    ).toThrow(/sce_acceptance/);
  });

  it("rejects the direct Neon host", () => {
    expect(() =>
      assertAcceptanceFixturePasswordDatabaseTarget(
        validEnvironment({
          DATABASE_URL: pooledDatabaseUrl(DIRECT_HOST),
        }),
      ),
    ).toThrow(/allowlisted remote sce_acceptance/);
  });

  it("rejects STAGE and PROD URL matches", () => {
    const acceptanceUrl = pooledDatabaseUrl();
    expect(() =>
      assertAcceptanceFixturePasswordDatabaseTarget(
        validEnvironment({
          DATABASE_URL: acceptanceUrl,
          STAGE_DB_URL: acceptanceUrl,
        }),
      ),
    ).toThrow(/protected STAGE_DB_URL/);
  });

  it("requires explicit sync confirmation and authorization", () => {
    expect(() =>
      assertAcceptanceFixturePasswordSyncAuthorization(
        validEnvironment({
          ACCEPTANCE_FIXTURE_PASSWORD_SYNC_CONFIRM: "WRONG",
        }),
      ),
    ).toThrow(/confirmation/);

    expect(() =>
      assertAcceptanceFixturePasswordSyncAuthorization(
        validEnvironment({
          SCE_OPERATION_AUTHORIZATION: "wrong",
        }),
      ),
    ).toThrow(/authorization/);
  });

  it("updates only passwordHash for the five canonical fixture users", async () => {
    const passwords = passwordsFromFixture();
    const updates: Array<{ id: string; passwordHash: string }> = [];
    const users = new Map(
      Object.entries(ACCEPTANCE_FIXTURE.users).map(([key, fixture]) => [
        fixture.email,
        { id: fixture.id, email: fixture.email, key },
      ]),
    );

    const tx = {
      user: {
        findUnique: vi.fn(async ({ where }: { where: { email: string } }) => {
          const user = users.get(where.email);
          return user ? { id: user.id } : null;
        }),
        update: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: { passwordHash: string };
          }) => {
            updates.push({ id: where.id, passwordHash: data.passwordHash });
            return { id: where.id };
          },
        ),
      },
    };

    const hasher = vi.fn(async (password: string) => `hash:${password}`);
    const updated = await syncAcceptanceFixturePasswordHashes(
      tx as never,
      passwords,
      hasher,
    );

    expect(updated).toBe(5);
    expect(tx.user.update).toHaveBeenCalledTimes(5);
    expect(updates).toHaveLength(5);
    for (const fixture of Object.values(ACCEPTANCE_FIXTURE.users)) {
      expect(updates.some((entry) => entry.id === fixture.id)).toBe(true);
      expect(hasher).toHaveBeenCalledWith(passwords[fixture.passwordEnv]);
    }
  });

  it("refuses to update when a canonical fixture user is missing", async () => {
    const tx = {
      user: {
        findUnique: vi.fn(async () => null),
        update: vi.fn(),
      },
    };

    await expect(
      syncAcceptanceFixturePasswordHashes(
        tx as never,
        passwordsFromFixture(),
        async (password) => `hash:${password}`,
      ),
    ).rejects.toThrow(/missing/);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("formats safe sync output without secrets", () => {
    const lines = formatAcceptanceFixturePasswordSyncOutput(5);
    expect(lines).toEqual([
      "ACCEPTANCE DB SAFETY: PASS",
      "SUPERADMIN PASSWORD SYNC: PASS",
      "ALPHA ADMIN PASSWORD SYNC: PASS",
      "ALPHA MEMBER PASSWORD SYNC: PASS",
      "BETA ADMIN PASSWORD SYNC: PASS",
      "BETA MEMBER PASSWORD SYNC: PASS",
      "TOTAL FIXTURE PASSWORDS UPDATED: 5",
    ]);
    expect(lines.join("\n")).not.toContain("hash:");
    expect(lines.join("\n")).not.toContain("password");
  });

  it("verifies fixture passwords with verifyPassword semantics", async () => {
    const passwords = passwordsFromFixture();
    const stored = new Map<string, string>();
    for (const fixture of Object.values(ACCEPTANCE_FIXTURE.users)) {
      stored.set(fixture.email, await hashPassword(passwords[fixture.passwordEnv]));
    }

    const results = await verifyAcceptanceFixturePasswordMatches(
      async (email) => stored.get(email) ?? null,
      passwords,
    );

    expect(formatAcceptanceFixturePasswordVerifyOutput(results)).toEqual([
      "SUPERADMIN MATCH: YES",
      "ALPHA ADMIN MATCH: YES",
      "ALPHA MEMBER MATCH: YES",
      "BETA ADMIN MATCH: YES",
      "BETA MEMBER MATCH: YES",
    ]);
  });
});
