import { describe, expect, it, vi } from "vitest";
import {
  ACCEPTANCE_CONFIRMATION,
  ACCEPTANCE_DATABASE_NAME,
  ACCEPTANCE_OPERATION_AUTHORIZATION,
} from "@/lib/acceptance/bootstrap";
import {
  ACCEPTANCE_POOLED_HOST_REQUIRED_MESSAGE,
  assertAcceptancePooledBootstrapHost,
  assertSafeAcceptanceBootstrapTarget,
  buildAcceptanceDatabaseUrlFromParts,
  formatSafeAcceptanceBootstrapIdentity,
  redactDatabaseSecrets,
  runBootstrapAcceptanceSafe,
  type BootstrapAcceptanceSafeDependencies,
} from "@/lib/acceptance/bootstrap-safe-runner";

const POOLED_HOST =
  "ep-icy-scene-b21dwo4d-pooler.c-6.eu-central-1.aws.neon.tech";
const DIRECT_HOST = "ep-icy-scene-b21dwo4d.c-6.eu-central-1.aws.neon.tech";
const ACCEPTANCE_USER = "acceptance_owner";
const ACCEPTANCE_PASSWORD = "p@ss:w/ord?special";
const ENCODED_PASSWORD = encodeURIComponent(ACCEPTANCE_PASSWORD);
const RESOLVED_TSX_CLI_PATH = "/workspace/node_modules/tsx/dist/cli.mjs";
const BOOTSTRAP_SCRIPT_PATH = "/workspace/scripts/bootstrap-acceptance.ts";

function pooledDatabaseUrl(
  host: string = POOLED_HOST,
  database: string = ACCEPTANCE_DATABASE_NAME,
  password: string = "secret",
): string {
  return `postgresql://${ACCEPTANCE_USER}:${password}@${host}:5432/${database}?sslmode=require`;
}

function validEnvironment(
  overrides: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    APP_ENV: "acceptance",
    VERCEL_TARGET_ENV: "acceptance",
    ACCEPTANCE_DATABASE_HOST: POOLED_HOST,
    ACCEPTANCE_BOOTSTRAP_CONFIRM: ACCEPTANCE_CONFIRMATION,
    SCE_OPERATION_AUTHORIZATION: ACCEPTANCE_OPERATION_AUTHORIZATION,
    ACCEPTANCE_DATABASE_USER: ACCEPTANCE_USER,
    ACCEPTANCE_DATABASE_PASSWORD: ACCEPTANCE_PASSWORD,
    ...overrides,
  };
}

function createDependencies(
  env: NodeJS.ProcessEnv,
  overrides: Partial<BootstrapAcceptanceSafeDependencies> = {},
): BootstrapAcceptanceSafeDependencies {
  const exit = vi.fn((() => {
    throw new Error("process.exit called");
  }) as BootstrapAcceptanceSafeDependencies["exit"]);
  const spawnSync = vi.fn(() => ({
    status: 0,
    stdout: Buffer.from(""),
    stderr: Buffer.from(""),
    output: [null, Buffer.from(""), Buffer.from(""), null],
    pid: 1,
    signal: null,
    error: undefined,
  })) as BootstrapAcceptanceSafeDependencies["spawnSync"];
  const log = vi.fn<(message: string) => void>();
  const error = vi.fn<(message: string) => void>();

  return {
    spawnSync,
    exit,
    env,
    execPath: "/usr/bin/node",
    resolveTsxCliPath: () => RESOLVED_TSX_CLI_PATH,
    resolveBootstrapScriptPath: () => BOOTSTRAP_SCRIPT_PATH,
    log,
    error,
    ...overrides,
  };
}

describe("bootstrap-acceptance safe runner", () => {
  it("accepts a correct Acceptance pooled DATABASE_URL", () => {
    const result = assertSafeAcceptanceBootstrapTarget(
      validEnvironment({
        DATABASE_URL: pooledDatabaseUrl(),
      }),
    );

    expect(result.identity).toEqual({
      environment: "acceptance",
      host: POOLED_HOST,
      database: ACCEPTANCE_DATABASE_NAME,
      user: ACCEPTANCE_USER,
    });
  });

  it("rejects /neondb", () => {
    expect(() =>
      assertSafeAcceptanceBootstrapTarget(
        validEnvironment({
          DATABASE_URL: pooledDatabaseUrl(POOLED_HOST, "neondb"),
        }),
      ),
    ).toThrow(/sce_acceptance/);
  });

  it("rejects the direct host for pooled bootstrap", () => {
    expect(() =>
      assertSafeAcceptanceBootstrapTarget(
        validEnvironment({
          DATABASE_URL: pooledDatabaseUrl(DIRECT_HOST),
        }),
      ),
    ).toThrow(ACCEPTANCE_POOLED_HOST_REQUIRED_MESSAGE);
    expect(() => assertAcceptancePooledBootstrapHost(DIRECT_HOST)).toThrow(
      ACCEPTANCE_POOLED_HOST_REQUIRED_MESSAGE,
    );
  });

  it("rejects the wrong database name", () => {
    expect(() =>
      assertSafeAcceptanceBootstrapTarget(
        validEnvironment({
          DATABASE_URL: pooledDatabaseUrl(POOLED_HOST, "sce_stage"),
        }),
      ),
    ).toThrow(/sce_acceptance/);
  });

  it("rejects localhost", () => {
    expect(() =>
      assertSafeAcceptanceBootstrapTarget(
        validEnvironment({
          DATABASE_URL: pooledDatabaseUrl("localhost"),
          ACCEPTANCE_DATABASE_HOST: "localhost",
        }),
      ),
    ).toThrow(/localhost/);
  });

  it("rejects STAGE and PROD URL matches", () => {
    const stageUrl = pooledDatabaseUrl(POOLED_HOST);
    expect(() =>
      assertSafeAcceptanceBootstrapTarget(
        validEnvironment({
          DATABASE_URL: stageUrl,
          STAGE_DB_URL: stageUrl,
        }),
      ),
    ).toThrow(/protected STAGE_DB_URL/);

    expect(() =>
      assertSafeAcceptanceBootstrapTarget(
        validEnvironment({
          DATABASE_URL: stageUrl,
          PROD_DB_URL: stageUrl,
        }),
      ),
    ).toThrow(/protected PROD_DB_URL/);
  });

  it("never includes the password in validation errors", () => {
    const secret = "ultra-secret-password-value";
    let thrown: Error | undefined;
    try {
      assertSafeAcceptanceBootstrapTarget(
        validEnvironment({
          DATABASE_URL: pooledDatabaseUrl(POOLED_HOST, ACCEPTANCE_DATABASE_NAME, secret),
          ACCEPTANCE_DATABASE_HOST: "wrong-host.example.com",
        }),
      );
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown).toBeDefined();
    expect(thrown?.message).not.toContain(secret);
    expect(redactDatabaseSecrets(thrown?.message ?? "")).not.toContain(secret);
  });

  it("URL-encodes credentials with special characters when building the URL", () => {
    const built = buildAcceptanceDatabaseUrlFromParts(validEnvironment());
    expect(built).toContain(`:${ENCODED_PASSWORD}@`);
    expect(built).not.toContain(ACCEPTANCE_PASSWORD);
    expect(built).toContain(`/${ACCEPTANCE_DATABASE_NAME}?sslmode=require`);
  });

  it("fails before any database connection when the password is missing", () => {
    expect(() =>
      buildAcceptanceDatabaseUrlFromParts(
        validEnvironment({
          ACCEPTANCE_DATABASE_PASSWORD: undefined,
          DATABASE_URL: undefined,
        }),
      ),
    ).toThrow(/ACCEPTANCE_DATABASE_PASSWORD is required/);

    const deps = createDependencies(
      validEnvironment({
        ACCEPTANCE_DATABASE_PASSWORD: undefined,
        DATABASE_URL: undefined,
      }),
    );

    expect(() => runBootstrapAcceptanceSafe(deps)).toThrow("process.exit called");
    expect(deps.spawnSync).not.toHaveBeenCalled();
    expect((deps.error as ReturnType<typeof vi.fn>).mock.calls.join(" ")).not.toContain(
      ACCEPTANCE_PASSWORD,
    );
  });

  it("does not start the bootstrap child process on validation failure", () => {
    const deps = createDependencies(
      validEnvironment({
        DATABASE_URL: pooledDatabaseUrl(DIRECT_HOST),
      }),
    );

    expect(() => runBootstrapAcceptanceSafe(deps)).toThrow("process.exit called");
    expect(deps.spawnSync).not.toHaveBeenCalled();
    expect(deps.exit).toHaveBeenCalledWith(1);
  });

  it("invokes the canonical Acceptance bootstrap command for a valid target", () => {
    const deps = createDependencies(
      validEnvironment({
        DATABASE_URL: pooledDatabaseUrl(),
      }),
    );

    expect(() => runBootstrapAcceptanceSafe(deps)).toThrow("process.exit called");
    expect(deps.spawnSync).toHaveBeenCalledWith(
      "/usr/bin/node",
      [RESOLVED_TSX_CLI_PATH, BOOTSTRAP_SCRIPT_PATH],
      expect.objectContaining({
        env: expect.objectContaining({
          DATABASE_URL: pooledDatabaseUrl(),
          ACCEPTANCE_DATABASE_HOST: POOLED_HOST,
        }),
      }),
    );
    const loggedLines = (deps.log as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => String(call[0]),
    );
    expect(loggedLines).toEqual(
      expect.arrayContaining(
        formatSafeAcceptanceBootstrapIdentity({
          environment: "acceptance",
          host: POOLED_HOST,
          database: ACCEPTANCE_DATABASE_NAME,
          user: ACCEPTANCE_USER,
        }).map((line) => `[bootstrap-acceptance:safe] ${line}`),
      ),
    );
    expect(deps.log).toHaveBeenCalledWith(
      "[bootstrap-acceptance:safe] Validation passed; invoking canonical Acceptance bootstrap.",
    );
    expect(deps.exit).toHaveBeenCalledWith(0);
  });

  it("builds DATABASE_URL from protected parts when DATABASE_URL is not provided", () => {
    const deps = createDependencies(validEnvironment({ DATABASE_URL: undefined }));

    expect(() => runBootstrapAcceptanceSafe(deps)).toThrow("process.exit called");
    expect(deps.spawnSync).toHaveBeenCalledWith(
      "/usr/bin/node",
      [RESOLVED_TSX_CLI_PATH, BOOTSTRAP_SCRIPT_PATH],
      expect.objectContaining({
        env: expect.objectContaining({
          DATABASE_URL: buildAcceptanceDatabaseUrlFromParts(validEnvironment()),
        }),
      }),
    );
  });
});
