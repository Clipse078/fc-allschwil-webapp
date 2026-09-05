import { describe, expect, it } from "vitest";
import {
  classifyDatabaseTarget,
  evaluateOperationalMutationGuard,
} from "../operational-database-guard";

const LOCAL_DATABASE_URL = "postgresql://user:password@127.0.0.1:5432/sce_test";
const REMOTE_DATABASE_URL =
  "postgresql://user:password@remote-database.example:5432/sce";

describe("operational database mutation guard", () => {
  it("classifies only loopback PostgreSQL targets as local", () => {
    expect(classifyDatabaseTarget(LOCAL_DATABASE_URL)).toBe("local");
    expect(classifyDatabaseTarget(REMOTE_DATABASE_URL)).toBe("remote");
    expect(classifyDatabaseTarget(undefined)).toBe("unknown");
    expect(classifyDatabaseTarget("not-a-url")).toBe("unknown");
  });

  it("denies mutation by default", () => {
    const result = evaluateOperationalMutationGuard(
      {
        operationId: "permissions-sync",
        databaseUrl: LOCAL_DATABASE_URL,
        explicitIntent: false,
      },
      { NODE_ENV: "development", APP_ENV: "local" },
    );

    expect(result.allowed).toBe(false);
  });

  it("allows an explicit local operation against a local database", () => {
    const result = evaluateOperationalMutationGuard(
      {
        operationId: "permissions-sync",
        databaseUrl: LOCAL_DATABASE_URL,
        explicitIntent: true,
      },
      { NODE_ENV: "development", APP_ENV: "local" },
    );

    expect(result).toMatchObject({
      allowed: true,
      environment: "local",
      databaseTarget: "local",
    });
  });

  it("denies an ambient remote database URL without operation authorization", () => {
    const result = evaluateOperationalMutationGuard(
      {
        operationId: "permissions-sync",
        databaseUrl: REMOTE_DATABASE_URL,
        explicitIntent: true,
        allowedRemoteEnvironments: ["stage"],
      },
      {
        NODE_ENV: "production",
        APP_ENV: "stage",
        VERCEL: "1",
        VERCEL_ENV: "production",
        DATABASE_URL: REMOTE_DATABASE_URL,
      },
    );

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain("permissions-sync:stage");
    }
  });

  it("allows a designed STAGE operation only with matching authorization", () => {
    const result = evaluateOperationalMutationGuard(
      {
        operationId: "permissions-sync",
        databaseUrl: REMOTE_DATABASE_URL,
        explicitIntent: true,
        allowedRemoteEnvironments: ["stage"],
      },
      {
        NODE_ENV: "production",
        APP_ENV: "stage",
        VERCEL: "1",
        VERCEL_ENV: "production",
        SCE_OPERATION_AUTHORIZATION: "permissions-sync:stage",
      },
    );

    expect(result.allowed).toBe(true);
  });

  it("always denies Preview even when copied flags and authorization are present", () => {
    const result = evaluateOperationalMutationGuard(
      {
        operationId: "permissions-sync",
        databaseUrl: REMOTE_DATABASE_URL,
        explicitIntent: true,
        allowedRemoteEnvironments: ["stage"],
        operationSpecificAuthorization: true,
      },
      {
        NODE_ENV: "production",
        APP_ENV: "stage",
        VERCEL: "1",
        VERCEL_ENV: "preview",
        SCE_OPERATION_AUTHORIZATION: "permissions-sync:stage",
      },
    );

    expect(result).toMatchObject({
      allowed: false,
      environment: "preview",
      databaseTarget: "remote",
    });
  });

  it("requires independent approval for production mutation", () => {
    const baseEnv = {
      NODE_ENV: "production",
      APP_ENV: "prod",
      VERCEL: "1",
      VERCEL_ENV: "production",
      SCE_OPERATION_AUTHORIZATION: "recovery:prod",
    };
    const input = {
      operationId: "recovery",
      databaseUrl: REMOTE_DATABASE_URL,
      explicitIntent: true,
      allowedRemoteEnvironments: ["prod"] as const,
    };

    expect(evaluateOperationalMutationGuard(input, baseEnv).allowed).toBe(false);
    expect(
      evaluateOperationalMutationGuard(input, {
        ...baseEnv,
        SCE_PRODUCTION_MUTATION_APPROVAL: "recovery:prod",
      }).allowed,
    ).toBe(true);
  });
});
