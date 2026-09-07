import { describe, expect, it } from "vitest";
import {
  ACCEPTANCE_SECURITY_SMOKE_CONFIRM,
  assertAcceptanceSecuritySmokeEnvironment,
  resolveAcceptanceBaseUrl,
} from "@/lib/acceptance/security-smoke/env";
import { ACCEPTANCE_FIXTURE } from "@/lib/acceptance/bootstrap";

function validPasswordEnv(): NodeJS.ProcessEnv {
  const passwords = Object.fromEntries(
    Object.values(ACCEPTANCE_FIXTURE.users).map((user) => [
      user.passwordEnv,
      `test-${user.passwordEnv}-credential`,
    ]),
  );
  return {
    APP_ENV: "acceptance",
    ACCEPTANCE_BASE_URL: "https://acceptance.sportclubevo.com",
    ACCEPTANCE_SECURITY_SMOKE_CONFIRM,
    ...passwords,
  };
}

describe("resolveAcceptanceBaseUrl", () => {
  it("accepts the canonical Acceptance host", () => {
    expect(
      resolveAcceptanceBaseUrl({
        ACCEPTANCE_BASE_URL: "https://acceptance.sportclubevo.com",
      }),
    ).toBe("https://acceptance.sportclubevo.com");
  });

  it("rejects STAGE hosts", () => {
    expect(() =>
      resolveAcceptanceBaseUrl({
        ACCEPTANCE_BASE_URL: "https://stage-webapp.fcallschwil.ch",
      }),
    ).toThrow(/blocked non-Acceptance host/i);
  });

  it("rejects production hosts", () => {
    expect(() =>
      resolveAcceptanceBaseUrl({
        ACCEPTANCE_BASE_URL: "https://fcallschwil.sportclubevo.com",
      }),
    ).toThrow(/blocked non-Acceptance host/i);
  });
});

describe("assertAcceptanceSecuritySmokeEnvironment", () => {
  it("requires APP_ENV=acceptance and explicit confirmation", () => {
    expect(() =>
      assertAcceptanceSecuritySmokeEnvironment({
        ...validPasswordEnv(),
        APP_ENV: "stage",
      }),
    ).toThrow(/APP_ENV must be set to acceptance/i);

    expect(() =>
      assertAcceptanceSecuritySmokeEnvironment({
        ...validPasswordEnv(),
        ACCEPTANCE_SECURITY_SMOKE_CONFIRM: "NOPE",
      }),
    ).toThrow(/ACCEPTANCE_SECURITY_SMOKE_CONFIRM/i);
  });

  it("returns config when the environment is valid", () => {
    const config = assertAcceptanceSecuritySmokeEnvironment(validPasswordEnv());
    expect(config.baseUrl).toBe("https://acceptance.sportclubevo.com");
    expect(config.passwords.ACCEPTANCE_ALPHA_ADMIN_PASSWORD).toContain(
      "ACCEPTANCE_ALPHA_ADMIN_PASSWORD",
    );
  });
});
