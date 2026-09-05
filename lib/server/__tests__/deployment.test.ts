import { afterEach, describe, expect, it } from "vitest";
import { getDeploymentMetadata } from "../deployment";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("deployment metadata", () => {
  it("shows Acceptance and the exact Vercel commit SHA", () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "production",
      APP_ENV: "stage",
      VERCEL: "1",
      VERCEL_ENV: "preview",
      VERCEL_TARGET_ENV: "acceptance",
      VERCEL_GIT_COMMIT_SHA: "abc123acceptance",
    };

    expect(getDeploymentMetadata()).toMatchObject({
      environment: "ACCEPTANCE",
      vercelEnv: "preview",
      commitSha: "abc123acceptance",
    });
  });
});
