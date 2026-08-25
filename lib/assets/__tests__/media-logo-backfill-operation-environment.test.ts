/**
 * MEDIA-LOGO-01G10 — controlled preview environment resolution tests.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  isMediaLogoBackfillAuthEnvironmentAllowed,
  isMediaLogoBackfillStageDatabase,
  isMediaLogoControlledPreviewEnvironment,
  isMediaLogoStageDatabaseTarget,
  MEDIA_LOGO_CONTROLLED_PREVIEW_BRANCH,
} from "../media-logo-backfill-operation-environment";
import { getRuntimeEnvironment } from "@/lib/env";

const ORIGINAL_ENV = { ...process.env };

const STAGE_DATABASE_URL =
  "postgresql://neondb_owner:secret@ep-wispy-hall-aso93dy6-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require";
const PROD_DATABASE_URL = "postgresql://neondb_owner:secret@ep-prod-host.example.com/neondb";

function enableNormalStageRuntime() {
  process.env.APP_ENV = "stage";
  process.env.VERCEL = "1";
  process.env.VERCEL_ENV = "preview";
  process.env.DATABASE_URL = STAGE_DATABASE_URL;
}

function enableControlledPreviewRuntime(overrides: Record<string, string | undefined> = {}) {
  process.env.APP_ENV = "prod";
  process.env.VERCEL = "1";
  process.env.VERCEL_ENV = "preview";
  process.env.VERCEL_GIT_COMMIT_REF = MEDIA_LOGO_CONTROLLED_PREVIEW_BRANCH;
  process.env.DATABASE_URL = STAGE_DATABASE_URL;
  process.env.STAGE_DB_URL = STAGE_DATABASE_URL;

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.NODE_ENV = "test";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("isMediaLogoStageDatabaseTarget", () => {
  it("matches STAGE_DB_URL without exposing credentials", () => {
    process.env.STAGE_DB_URL = STAGE_DATABASE_URL;

    expect(isMediaLogoStageDatabaseTarget(STAGE_DATABASE_URL)).toBe(true);
    expect(isMediaLogoStageDatabaseTarget(PROD_DATABASE_URL)).toBe(false);
  });

  it("matches known FC Allschwil STAGE Neon host fragment", () => {
    expect(isMediaLogoStageDatabaseTarget(STAGE_DATABASE_URL)).toBe(true);
    expect(isMediaLogoStageDatabaseTarget(PROD_DATABASE_URL)).toBe(false);
  });
});

describe("isMediaLogoBackfillAuthEnvironmentAllowed", () => {
  it("1. allows APP_ENV=stage on Vercel through the normal STAGE path", () => {
    enableNormalStageRuntime();

    expect(isMediaLogoBackfillAuthEnvironmentAllowed()).toBe(true);
    expect(getRuntimeEnvironment().isStage).toBe(true);
  });

  it("2. allows controlled Preview with PROD APP_ENV, exact branch, and STAGE database", () => {
    enableControlledPreviewRuntime();

    expect(isMediaLogoBackfillAuthEnvironmentAllowed()).toBe(true);
    expect(getRuntimeEnvironment().appEnv).toBe("prod");
    expect(getRuntimeEnvironment().isStage).toBe(false);
  });

  it("3. denies controlled Preview on the wrong branch", () => {
    enableControlledPreviewRuntime({
      VERCEL_GIT_COMMIT_REF: "cursor/some-other-branch",
    });

    expect(isMediaLogoBackfillAuthEnvironmentAllowed()).toBe(false);
  });

  it("4. denies controlled Preview when branch metadata is missing", () => {
    enableControlledPreviewRuntime({ VERCEL_GIT_COMMIT_REF: undefined });

    expect(isMediaLogoBackfillAuthEnvironmentAllowed()).toBe(false);
  });

  it("5. denies controlled Preview with a non-STAGE database target", () => {
    enableControlledPreviewRuntime({ DATABASE_URL: PROD_DATABASE_URL });

    expect(isMediaLogoBackfillAuthEnvironmentAllowed()).toBe(false);
  });

  it("6. denies when VERCEL_ENV is production even with the controlled branch", () => {
    enableControlledPreviewRuntime({ VERCEL_ENV: "production" });

    expect(isMediaLogoBackfillAuthEnvironmentAllowed()).toBe(false);
  });

  it("7. denies local/non-Vercel runtimes", () => {
    enableControlledPreviewRuntime({ VERCEL: undefined });

    expect(isMediaLogoBackfillAuthEnvironmentAllowed()).toBe(false);
  });

  it("8. denies production application environment without controlled Preview conditions", () => {
    process.env.APP_ENV = "prod";
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_GIT_COMMIT_REF = "main";
    process.env.DATABASE_URL = STAGE_DATABASE_URL;

    expect(isMediaLogoBackfillAuthEnvironmentAllowed()).toBe(false);
  });
});

describe("isMediaLogoControlledPreviewEnvironment", () => {
  it("requires all controlled Preview conditions together", () => {
    enableControlledPreviewRuntime();

    expect(isMediaLogoControlledPreviewEnvironment()).toBe(true);
    expect(isMediaLogoBackfillStageDatabase()).toBe(true);
  });
});

describe("general isStage semantics remain unchanged", () => {
  it("14. does not broaden global isStage for controlled Preview", () => {
    enableControlledPreviewRuntime();

    const runtime = getRuntimeEnvironment();

    expect(runtime.isStage).toBe(false);
    expect(runtime.appEnv).toBe("prod");
    expect(isMediaLogoBackfillAuthEnvironmentAllowed()).toBe(true);
  });
});

describe("Club Directory stage guard remains unchanged", () => {
  it("14. still requires global isStage for Club Directory operational routes", () => {
    enableControlledPreviewRuntime();

    const runtime = getRuntimeEnvironment();

    expect(runtime.isStage).toBe(false);
    expect(isMediaLogoBackfillAuthEnvironmentAllowed()).toBe(true);
  });
});
