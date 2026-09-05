import { describe, expect, it } from "vitest";
import { evaluateDemoSeedGuard } from "../seed-guard";

describe("evaluateDemoSeedGuard", () => {
  it("allows demo seed on local APP_ENV without explicit flag", () => {
    expect(evaluateDemoSeedGuard({ APP_ENV: "local" })).toEqual({ allowed: true });
    expect(evaluateDemoSeedGuard({})).toEqual({ allowed: true });
  });

  it("blocks demo seed on STAGE unless ALLOW_DEMO_SEED=true", () => {
    expect(evaluateDemoSeedGuard({ APP_ENV: "stage" })).toEqual({
      allowed: false,
      reason: expect.stringContaining("APP_ENV=stage"),
    });
    expect(
      evaluateDemoSeedGuard({ APP_ENV: "stage", ALLOW_DEMO_SEED: "true" }),
    ).toEqual({ allowed: true });
  });

  it("blocks demo seed on PROD unless ALLOW_DEMO_SEED=true", () => {
    expect(evaluateDemoSeedGuard({ APP_ENV: "prod" })).toEqual({
      allowed: false,
      reason: expect.stringContaining("APP_ENV=prod"),
    });
    expect(
      evaluateDemoSeedGuard({ APP_ENV: "prod", ALLOW_DEMO_SEED: "true" }),
    ).toEqual({ allowed: true });
  });

  it("does not treat NODE_ENV alone as authorization", () => {
    expect(
      evaluateDemoSeedGuard({ APP_ENV: "stage", NODE_ENV: "development" }),
    ).toEqual({
      allowed: false,
      reason: expect.stringContaining("APP_ENV=stage"),
    });
  });

  it("always blocks Preview even when seed flags are copied", () => {
    expect(
      evaluateDemoSeedGuard({
        NODE_ENV: "production",
        APP_ENV: "stage",
        VERCEL: "1",
        VERCEL_ENV: "preview",
        ALLOW_DEMO_SEED: "true",
      }),
    ).toEqual({
      allowed: false,
      reason: expect.stringContaining("environment=preview"),
    });
  });

  it("blocks malformed APP_ENV in a deployed runtime", () => {
    expect(
      evaluateDemoSeedGuard({
        NODE_ENV: "production",
        APP_ENV: "stgae",
        VERCEL: "1",
        VERCEL_ENV: "production",
        ALLOW_DEMO_SEED: "true",
      }).allowed,
    ).toBe(false);
  });
});
