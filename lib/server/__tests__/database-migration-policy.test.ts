import { describe, expect, it } from "vitest";
import { shouldApplyDatabaseMigrations } from "../database-migration-policy";

describe("database migration deployment policy", () => {
  it("does not implicitly enable migrations for Acceptance with a database URL", () => {
    expect(
      shouldApplyDatabaseMigrations({
        NODE_ENV: "production",
        VERCEL: "1",
        VERCEL_ENV: "preview",
        VERCEL_TARGET_ENV: "acceptance",
        DATABASE_URL: "postgresql://acceptance.invalid/database",
      }),
    ).toBe(false);
  });

  it("requires APPLY_DATABASE_MIGRATIONS to be exactly true", () => {
    expect(
      shouldApplyDatabaseMigrations({
        NODE_ENV: "test",
        APPLY_DATABASE_MIGRATIONS: "true",
      }),
    ).toBe(true);
    expect(
      shouldApplyDatabaseMigrations({
        NODE_ENV: "test",
        APPLY_DATABASE_MIGRATIONS: "TRUE",
      }),
    ).toBe(false);
    expect(
      shouldApplyDatabaseMigrations({
        NODE_ENV: "test",
        APPLY_DATABASE_MIGRATIONS: " true ",
      }),
    ).toBe(false);
  });
});
