import { afterEach, describe, expect, it } from "vitest";

import {
  UnsafeTestDatabaseError,
  applyConfiguredTestDatabaseUrlToProcessEnv,
  assertSafeTestDatabase,
  canRunDbMutatingIntegrationTests,
  isKnownSharedOrRuntimeDatabase,
  maskDatabaseUrl,
} from "../safe-test-database";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("safe-test-database guard", () => {
  it("1. rejects missing TEST_DATABASE_URL", () => {
    delete process.env.TEST_DATABASE_URL;
    expect(() => assertSafeTestDatabase()).toThrow(UnsafeTestDatabaseError);
    expect(() => assertSafeTestDatabase()).toThrow(
      /explicit local TEST_DATABASE_URL required/,
    );
    expect(canRunDbMutatingIntegrationTests()).toBe(false);
  });

  it("2. rejects TEST_DATABASE_URL equal to STAGE_DB_URL", () => {
    process.env.STAGE_DB_URL =
      "postgresql://neondb_owner:secret@ep-wispy-hall-aso93dy6-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require";
    process.env.TEST_DATABASE_URL = process.env.STAGE_DB_URL;

    expect(() => assertSafeTestDatabase()).toThrow(UnsafeTestDatabaseError);
    expect(() => assertSafeTestDatabase()).toThrow(/shared STAGE target/);
  });

  it("3. rejects known FC Allschwil STAGE Neon host/database", () => {
    process.env.TEST_DATABASE_URL =
      "postgresql://neondb_owner:secret@ep-wispy-hall-aso93dy6-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require";

    const verdict = isKnownSharedOrRuntimeDatabase(process.env.TEST_DATABASE_URL);
    expect(verdict.unsafe).toBe(true);
    if (verdict.unsafe) {
      expect(verdict.reason).toMatch(/FC Allschwil STAGE Neon|STAGE_DB_URL|Neon cloud/);
    }
    expect(() => assertSafeTestDatabase()).toThrow(UnsafeTestDatabaseError);
  });

  it("4. rejects production/runtime database targets", () => {
    process.env.TEST_DATABASE_URL =
      "postgresql://app:secret@prod-db.example.com:5432/fc_allschwil_prod";

    expect(isKnownSharedOrRuntimeDatabase(process.env.TEST_DATABASE_URL)).toEqual({
      unsafe: true,
      reason: "appears to be a production database target",
    });
    expect(() => assertSafeTestDatabase()).toThrow(UnsafeTestDatabaseError);
  });

  it("5. accepts an explicitly isolated local test database fixture", () => {
    process.env.TEST_DATABASE_URL =
      "postgresql://postgres:postgres@127.0.0.1:5432/season_integration_test";

    expect(assertSafeTestDatabase()).toBe(process.env.TEST_DATABASE_URL);
    expect(canRunDbMutatingIntegrationTests()).toBe(true);
  });

  it("6. never exposes credentials in error messages", () => {
    const secret = "super-secret-password-12345";
    process.env.STAGE_DB_URL = `postgresql://neondb_owner:${secret}@ep-wispy-hall-aso93dy6-pooler.c-4.eu-central-1.aws.neon.tech/neondb`;
    process.env.TEST_DATABASE_URL = process.env.STAGE_DB_URL;

    let message = "";
    try {
      assertSafeTestDatabase();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).not.toContain(secret);
    expect(message).toContain(":***@");
    expect(maskDatabaseUrl(process.env.TEST_DATABASE_URL)).not.toContain(secret);
    expect(maskDatabaseUrl(process.env.TEST_DATABASE_URL)).toContain(":***@");
  });

  it("rejects remote STAGE-looking targets even when localhost is absent from hostname", () => {
    process.env.TEST_DATABASE_URL =
      "postgresql://postgres:postgres@my-stage-db.example.com:5432/stage";

    expect(() => assertSafeTestDatabase()).toThrow(UnsafeTestDatabaseError);
  });

  it("does not treat NODE_ENV=test alone as sufficient", () => {
    process.env.NODE_ENV = "test";
    delete process.env.TEST_DATABASE_URL;

    expect(canRunDbMutatingIntegrationTests()).toBe(false);
  });

  it("rejects ambient DATABASE_URL without explicit TEST_DATABASE_URL", () => {
    process.env.DATABASE_URL =
      "postgresql://stage:secret@stage-db.example.com:5432/application";
    delete process.env.TEST_DATABASE_URL;

    expect(() => assertSafeTestDatabase()).toThrow(
      /explicit local TEST_DATABASE_URL required/,
    );
    expect(() => applyConfiguredTestDatabaseUrlToProcessEnv()).not.toThrow();
    expect(process.env.DATABASE_URL).toContain("stage-db.example.com");
  });

  it.each([
    [
      "arbitrary remote PostgreSQL",
      "postgresql://app:secret@db.example.com:5432/application_test",
    ],
    [
      "Neon",
      "postgresql://app:secret@ep-example.eu-central-1.aws.neon.tech/db",
    ],
    [
      "Vercel Preview runtime",
      "postgresql://app:secret@preview-db.vercel.example:5432/app",
    ],
    [
      "STAGE URL shape",
      "postgresql://app:secret@postgres.stage.internal:5432/app",
    ],
    [
      "production marker",
      "postgresql://app:secret@postgres.internal:5432/app_production",
    ],
  ])("rejects %s targets", (_label, url) => {
    process.env.TEST_DATABASE_URL = url;
    expect(() => assertSafeTestDatabase()).toThrow(UnsafeTestDatabaseError);
  });

  it.each(["not-a-url", "://missing-protocol", "postgresql://"])(
    "rejects malformed URL %s",
    (url) => {
      process.env.TEST_DATABASE_URL = url;
      expect(() => assertSafeTestDatabase()).toThrow(/malformed/);
    },
  );

  it("rejects non-PostgreSQL local targets", () => {
    process.env.TEST_DATABASE_URL = "mysql://root:secret@localhost/test";
    expect(() => assertSafeTestDatabase()).toThrow(/must use PostgreSQL/);
  });

  it.each([
    "postgresql://postgres:postgres@localhost:5432/application_test",
    "postgresql://postgres:postgres@127.0.0.1:5432/application_test",
    "postgresql://postgres:postgres@[::1]:5432/application_test",
  ])("accepts explicit local PostgreSQL target %s", (url) => {
    process.env.TEST_DATABASE_URL = url;
    expect(assertSafeTestDatabase()).toBe(url);
  });
});
