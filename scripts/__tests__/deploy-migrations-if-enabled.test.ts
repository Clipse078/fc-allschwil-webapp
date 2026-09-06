import { describe, expect, it, vi } from "vitest";
import { ACCEPTANCE_DATABASE_NAME } from "@/lib/acceptance/bootstrap";
import {
  runDeployMigrationsIfEnabled,
  type DeployMigrationsDependencies,
} from "@/lib/server/deploy-migrations-if-enabled";

const ACCEPTANCE_HOST = "acceptance-db.example.com";
const ACCEPTANCE_DATABASE_URL = `postgresql://acceptance:secret@${ACCEPTANCE_HOST}:5432/${ACCEPTANCE_DATABASE_NAME}`;
const RESOLVED_PRISMA_CLI_PATH =
  "/workspace/node_modules/prisma/build/index.js";

function authorizedAcceptanceEnv(
  overrides: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    APP_ENV: "acceptance",
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_TARGET_ENV: "acceptance",
    APPLY_DATABASE_MIGRATIONS: "true",
    DATABASE_URL: ACCEPTANCE_DATABASE_URL,
    DIRECT_URL: ACCEPTANCE_DATABASE_URL,
    ACCEPTANCE_DATABASE_HOST: ACCEPTANCE_HOST,
    ACCEPTANCE_DIRECT_DATABASE_HOST: ACCEPTANCE_HOST,
    ...overrides,
  };
}

function createDependencies(
  env: NodeJS.ProcessEnv,
  overrides: Partial<DeployMigrationsDependencies> = {},
): DeployMigrationsDependencies {
  const exit = vi.fn((() => {
    throw new Error("process.exit called");
  }) as DeployMigrationsDependencies["exit"]);
  const spawnSync = vi.fn(() => ({
    status: 0,
    stdout: Buffer.from(""),
    stderr: Buffer.from(""),
    output: [null, Buffer.from(""), Buffer.from(""), null],
    pid: 1,
    signal: null,
    error: undefined,
  })) as DeployMigrationsDependencies["spawnSync"];

  return {
    spawnSync,
    exit,
    env,
    execPath: "/usr/bin/node",
    resolvePrismaCliPath: () => RESOLVED_PRISMA_CLI_PATH,
    ...overrides,
  };
}

describe("deploy-migrations-if-enabled", () => {
  it("exits 0 when APPLY_DATABASE_MIGRATIONS is not exactly true", () => {
    const deps = createDependencies({
      APPLY_DATABASE_MIGRATIONS: "TRUE",
    });

    expect(() => runDeployMigrationsIfEnabled(deps)).toThrow(
      "process.exit called",
    );
    expect(deps.exit).toHaveBeenCalledWith(0);
    expect(deps.spawnSync).not.toHaveBeenCalled();
  });

  it("throws when the Acceptance host/database allowlist fails", () => {
    const deps = createDependencies(
      authorizedAcceptanceEnv({
        ACCEPTANCE_DATABASE_HOST: "wrong-host.example.com",
        ACCEPTANCE_DIRECT_DATABASE_HOST: "wrong-host.example.com",
      }),
    );

    expect(() => runDeployMigrationsIfEnabled(deps)).toThrow(
      "Database identity is not an explicitly allowlisted remote sce_acceptance database.",
    );
    expect(deps.spawnSync).not.toHaveBeenCalled();
    expect(deps.exit).not.toHaveBeenCalled();
  });

  it("launches Prisma via process.execPath with migrate deploy arguments", () => {
    const resolvePrismaCliPath = vi.fn(() => RESOLVED_PRISMA_CLI_PATH);
    const deps = createDependencies(authorizedAcceptanceEnv(), {
      resolvePrismaCliPath,
    });

    expect(() => runDeployMigrationsIfEnabled(deps)).toThrow(
      "process.exit called",
    );
    expect(resolvePrismaCliPath).toHaveBeenCalledOnce();
    expect(deps.spawnSync).toHaveBeenCalledWith(
      "/usr/bin/node",
      [RESOLVED_PRISMA_CLI_PATH, "migrate", "deploy"],
      expect.objectContaining({ env: deps.env }),
    );
    expect(deps.spawnSync.mock.calls[0]?.[1]).toEqual([
      RESOLVED_PRISMA_CLI_PATH,
      "migrate",
      "deploy",
    ]);
  });

  it("throws when prisma cannot be spawned", () => {
    const spawnError = new Error("spawnSync node ENOENT");
    const deps = createDependencies(authorizedAcceptanceEnv(), {
      spawnSync: vi.fn(() => ({
        status: null,
        stdout: Buffer.from(""),
        stderr: Buffer.from(""),
        output: [null, Buffer.from(""), Buffer.from(""), null],
        pid: 0,
        signal: null,
        error: spawnError,
      })) as DeployMigrationsDependencies["spawnSync"],
    });

    expect(() => runDeployMigrationsIfEnabled(deps)).toThrow(spawnError);
    expect(deps.exit).not.toHaveBeenCalled();
  });

  it("exits with prisma's non-zero status", () => {
    const deps = createDependencies(authorizedAcceptanceEnv(), {
      spawnSync: vi.fn(() => ({
        status: 2,
        stdout: Buffer.from(""),
        stderr: Buffer.from(""),
        output: [null, Buffer.from(""), Buffer.from(""), null],
        pid: 1,
        signal: null,
        error: undefined,
      })) as DeployMigrationsDependencies["spawnSync"],
    });

    expect(() => runDeployMigrationsIfEnabled(deps)).toThrow(
      "process.exit called",
    );
    expect(deps.exit).toHaveBeenCalledWith(2);
  });

  it("exits 0 when prisma succeeds", () => {
    const deps = createDependencies(authorizedAcceptanceEnv());

    expect(() => runDeployMigrationsIfEnabled(deps)).toThrow(
      "process.exit called",
    );
    expect(deps.exit).toHaveBeenCalledWith(0);
  });

  it("does not rely on Windows .cmd shim semantics", () => {
    const spawnSync = vi.fn(() => ({
      status: 0,
      stdout: Buffer.from(""),
      stderr: Buffer.from(""),
      output: [null, Buffer.from(""), Buffer.from(""), null],
      pid: 1,
      signal: null,
      error: undefined,
    })) as DeployMigrationsDependencies["spawnSync"];
    const exit = vi.fn((() => {
      throw new Error("process.exit called");
    }) as DeployMigrationsDependencies["exit"]);
    const env = authorizedAcceptanceEnv();

    expect(() =>
      runDeployMigrationsIfEnabled({
        spawnSync,
        exit,
        env,
        execPath: "C:\\Program Files\\nodejs\\node.exe",
        resolvePrismaCliPath: () =>
          "C:\\workspace\\node_modules\\prisma\\build\\index.js",
      }),
    ).toThrow("process.exit called");

    expect(spawnSync).toHaveBeenCalledWith(
      "C:\\Program Files\\nodejs\\node.exe",
      [
        "C:\\workspace\\node_modules\\prisma\\build\\index.js",
        "migrate",
        "deploy",
      ],
      expect.objectContaining({ env }),
    );
    expect(spawnSync.mock.calls[0]?.[0]).not.toMatch(/\.cmd$/i);
    expect(spawnSync.mock.calls[0]?.[1]?.[0]).not.toMatch(/\.cmd$/i);
  });
});
