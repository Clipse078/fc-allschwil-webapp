import { describe, expect, it } from "vitest";
import { getRuntimeEnvironment } from "../env";

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
});
