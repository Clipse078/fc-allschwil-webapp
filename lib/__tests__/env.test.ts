import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPublicEnvironmentLabel,
  getRuntimeEnvironment,
} from "../env";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runtime environment classification", () => {
  it("keeps local developer ergonomics when APP_ENV is missing", () => {
    const runtime = getRuntimeEnvironment({ NODE_ENV: "development" });

    expect(runtime.appEnv).toBe("local");
    expect(runtime.isLocal).toBe(true);
    expect(runtime.isDeployed).toBe(false);
  });

  it("classifies Vercel Preview as Preview, never local or STAGE", () => {
    const runtime = getRuntimeEnvironment({
      NODE_ENV: "production",
      APP_ENV: "stage",
      VERCEL: "1",
      VERCEL_ENV: "preview",
    });

    expect(runtime.appEnv).toBe("preview");
    expect(runtime.isPreview).toBe(true);
    expect(runtime.isLocal).toBe(false);
    expect(runtime.isStage).toBe(false);
  });

  it("classifies the named Vercel target as Acceptance even when VERCEL_ENV is Preview", () => {
    const runtime = getRuntimeEnvironment({
      NODE_ENV: "production",
      APP_ENV: "stage",
      VERCEL: "1",
      VERCEL_ENV: "preview",
      VERCEL_TARGET_ENV: "acceptance",
    });

    expect(runtime.appEnv).toBe("acceptance");
    expect(runtime.isAcceptance).toBe(true);
    expect(runtime.isPreview).toBe(false);
    expect(runtime.isStage).toBe(false);
    expect(runtime.isProd).toBe(false);
    expect(runtime.isDeployed).toBe(true);
    expect(getPublicEnvironmentLabel(runtime.appEnv)).toBe("ACCEPTANCE");
  });

  it("keeps ordinary Preview classified as Preview without the Acceptance target", () => {
    const runtime = getRuntimeEnvironment({
      NODE_ENV: "production",
      APP_ENV: "prod",
      APP_BASE_URL: "https://acceptance.sportclubevo.com",
      VERCEL: "1",
      VERCEL_ENV: "preview",
    });

    expect(runtime.appEnv).toBe("preview");
    expect(runtime.isPreview).toBe(true);
    expect(runtime.isAcceptance).toBe(false);
    expect(runtime.isProd).toBe(false);
  });

  it("fails closed when APP_ENV is missing in a deployed runtime", () => {
    const runtime = getRuntimeEnvironment({
      NODE_ENV: "production",
      VERCEL: "1",
      VERCEL_ENV: "production",
    });

    expect(runtime.appEnv).toBe("unknown");
    expect(runtime.isUnknown).toBe(true);
    expect(runtime.isLocal).toBe(false);
  });

  it("fails closed when APP_ENV is malformed in a deployed runtime", () => {
    const runtime = getRuntimeEnvironment({
      NODE_ENV: "production",
      APP_ENV: "stgae",
      VERCEL: "1",
      VERCEL_ENV: "production",
    });

    expect(runtime.appEnv).toBe("unknown");
    expect(runtime.isUnknown).toBe(true);
    expect(runtime.isLocal).toBe(false);
  });

  it("accepts explicit STAGE only on a Vercel production deployment", () => {
    const runtime = getRuntimeEnvironment({
      NODE_ENV: "production",
      APP_ENV: "stage",
      VERCEL: "1",
      VERCEL_ENV: "production",
    });

    expect(runtime.appEnv).toBe("stage");
    expect(runtime.isStage).toBe(true);
  });

  it("preserves explicit PROD classification on Vercel production", () => {
    const runtime = getRuntimeEnvironment({
      NODE_ENV: "production",
      APP_ENV: "prod",
      VERCEL: "1",
      VERCEL_ENV: "production",
    });

    expect(runtime.appEnv).toBe("prod");
    expect(runtime.isProd).toBe(true);
    expect(runtime.isAcceptance).toBe(false);
  });

  it("does not turn deployed APP_ENV=local into local privileges", () => {
    const runtime = getRuntimeEnvironment({
      NODE_ENV: "production",
      APP_ENV: "local",
      VERCEL: "1",
      VERCEL_ENV: "production",
    });

    expect(runtime.appEnv).toBe("unknown");
    expect(runtime.isLocal).toBe(false);
  });

  it("logs malformed URL configuration without exposing its raw value", () => {
    const rawValue = "credential[";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const runtime = getRuntimeEnvironment({
      NODE_ENV: "production",
      APP_ENV: "stage",
      VERCEL: "1",
      VERCEL_ENV: "production",
      APP_BASE_URL: rawValue,
    });

    expect(runtime.appBaseUrl).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      "[env] Invalid APP_BASE_URL configuration",
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain(rawValue);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("credential");
  });
});
