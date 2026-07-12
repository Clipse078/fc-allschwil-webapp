/**
 * Tests for lib/integrations/sfv/config.ts
 *
 * Uses synthetic .invalid domain credentials — never touches live endpoints.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getSfvConfigStatus, getSfvConfig } from "../config";
import { SfvConfigurationError } from "../errors";

const VALID_ENV = {
  SFV_TOKEN_URL: "https://sfv.invalid/api/token",
  SFV_APPLICATION_KEY: "test-application-key",
  SFV_APPLICATION_PASS: "test-application-pass",
  SFV_CLUB_ID: "999999",
};

function setEnv(overrides: Partial<typeof VALID_ENV> = {}) {
  const merged = { ...VALID_ENV, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function clearSfvEnv() {
  delete process.env["SFV_TOKEN_URL"];
  delete process.env["SFV_APPLICATION_KEY"];
  delete process.env["SFV_APPLICATION_PASS"];
  delete process.env["SFV_CLUB_ID"];
}

beforeEach(() => {
  clearSfvEnv();
});

afterEach(() => {
  clearSfvEnv();
  vi.restoreAllMocks();
});

// ── getSfvConfigStatus ────────────────────────────────────────────────────────

describe("getSfvConfigStatus", () => {
  it("reports all missing when env vars are absent", () => {
    const status = getSfvConfigStatus();

    expect(status.hasTokenUrl).toBe(false);
    expect(status.hasApplicationKey).toBe(false);
    expect(status.hasApplicationPass).toBe(false);
    expect(status.hasClubId).toBe(false);
    expect(status.allPresent).toBe(false);
    expect(status.allValid).toBe(false);
  });

  it("reports all present and valid with correct env", () => {
    setEnv();

    const status = getSfvConfigStatus();

    expect(status.hasTokenUrl).toBe(true);
    expect(status.hasApplicationKey).toBe(true);
    expect(status.hasApplicationPass).toBe(true);
    expect(status.hasClubId).toBe(true);
    expect(status.tokenUrlUsesHttps).toBe(true);
    expect(status.clubIdFormatValid).toBe(true);
    expect(status.allPresent).toBe(true);
    expect(status.allValid).toBe(true);
  });

  it("reports missing SFV_TOKEN_URL", () => {
    setEnv();
    delete process.env["SFV_TOKEN_URL"];

    const status = getSfvConfigStatus();

    expect(status.hasTokenUrl).toBe(false);
    expect(status.allPresent).toBe(false);
    expect(status.allValid).toBe(false);
  });

  it("reports missing SFV_APPLICATION_KEY", () => {
    setEnv();
    delete process.env["SFV_APPLICATION_KEY"];

    const status = getSfvConfigStatus();

    expect(status.hasApplicationKey).toBe(false);
    expect(status.allPresent).toBe(false);
    expect(status.allValid).toBe(false);
  });

  it("reports missing SFV_APPLICATION_PASS", () => {
    setEnv();
    delete process.env["SFV_APPLICATION_PASS"];

    const status = getSfvConfigStatus();

    expect(status.hasApplicationPass).toBe(false);
    expect(status.allPresent).toBe(false);
    expect(status.allValid).toBe(false);
  });

  it("reports missing SFV_CLUB_ID", () => {
    setEnv();
    delete process.env["SFV_CLUB_ID"];

    const status = getSfvConfigStatus();

    expect(status.hasClubId).toBe(false);
    expect(status.allPresent).toBe(false);
    expect(status.allValid).toBe(false);
  });

  it("rejects non-HTTPS token URL", () => {
    setEnv({ SFV_TOKEN_URL: "http://sfv.invalid/api/token" });

    const status = getSfvConfigStatus();

    expect(status.hasTokenUrl).toBe(true);
    expect(status.tokenUrlUsesHttps).toBe(false);
    expect(status.allValid).toBe(false);
  });

  it("rejects unparseable token URL", () => {
    setEnv({ SFV_TOKEN_URL: "not-a-url" });

    const status = getSfvConfigStatus();

    expect(status.hasTokenUrl).toBe(true);
    expect(status.tokenUrlUsesHttps).toBe(false);
    expect(status.allValid).toBe(false);
  });

  it("rejects non-numeric club ID", () => {
    setEnv({ SFV_CLUB_ID: "FC-Allschwil" });

    const status = getSfvConfigStatus();

    expect(status.hasClubId).toBe(true);
    expect(status.clubIdFormatValid).toBe(false);
    expect(status.allValid).toBe(false);
  });

  it("rejects club ID that is too long (>10 digits)", () => {
    setEnv({ SFV_CLUB_ID: "12345678901" });

    const status = getSfvConfigStatus();

    expect(status.clubIdFormatValid).toBe(false);
  });

  it("accepts numeric club ID with 1 digit", () => {
    setEnv({ SFV_CLUB_ID: "1" });

    const status = getSfvConfigStatus();

    expect(status.clubIdFormatValid).toBe(true);
  });
});

// ── getSfvConfig ──────────────────────────────────────────────────────────────

describe("getSfvConfig", () => {
  it("throws CONFIGURATION_MISSING when SFV_TOKEN_URL is absent", () => {
    setEnv();
    delete process.env["SFV_TOKEN_URL"];

    expect(() => getSfvConfig()).toThrow(SfvConfigurationError);

    try {
      getSfvConfig();
    } catch (error) {
      if (error instanceof SfvConfigurationError) {
        expect(error.code).toBe("CONFIGURATION_MISSING");
        expect(error.message).toContain("SFV_TOKEN_URL");
      }
    }
  });

  it("throws CONFIGURATION_MISSING when SFV_APPLICATION_KEY is absent", () => {
    setEnv();
    delete process.env["SFV_APPLICATION_KEY"];

    try {
      getSfvConfig();
    } catch (error) {
      if (error instanceof SfvConfigurationError) {
        expect(error.code).toBe("CONFIGURATION_MISSING");
        expect(error.message).toContain("SFV_APPLICATION_KEY");
      }
    }
  });

  it("throws CONFIGURATION_MISSING when SFV_APPLICATION_PASS is absent", () => {
    setEnv();
    delete process.env["SFV_APPLICATION_PASS"];

    try {
      getSfvConfig();
    } catch (error) {
      if (error instanceof SfvConfigurationError) {
        expect(error.code).toBe("CONFIGURATION_MISSING");
        expect(error.message).toContain("SFV_APPLICATION_PASS");
      }
    }
  });

  it("throws CONFIGURATION_MISSING when SFV_CLUB_ID is absent", () => {
    setEnv();
    delete process.env["SFV_CLUB_ID"];

    try {
      getSfvConfig();
    } catch (error) {
      if (error instanceof SfvConfigurationError) {
        expect(error.code).toBe("CONFIGURATION_MISSING");
        expect(error.message).toContain("SFV_CLUB_ID");
      }
    }
  });

  it("throws CONFIGURATION_INVALID for non-HTTPS URL", () => {
    setEnv({ SFV_TOKEN_URL: "http://sfv.invalid/api/token" });

    try {
      getSfvConfig();
    } catch (error) {
      if (error instanceof SfvConfigurationError) {
        expect(error.code).toBe("CONFIGURATION_INVALID");
        expect(error.message).toContain("HTTPS");
      }
    }
  });

  it("throws CONFIGURATION_INVALID for non-numeric club ID", () => {
    setEnv({ SFV_CLUB_ID: "invalid-id" });

    try {
      getSfvConfig();
    } catch (error) {
      if (error instanceof SfvConfigurationError) {
        expect(error.code).toBe("CONFIGURATION_INVALID");
        expect(error.message).toContain("SFV_CLUB_ID");
      }
    }
  });

  it("returns config without exposing values in errors", () => {
    setEnv();

    const config = getSfvConfig();

    expect(config.tokenUrl).toBe("https://sfv.invalid/api/token");
    expect(config.applicationKey).toBe("test-application-key");
    expect(config.applicationPass).toBe("test-application-pass");
    expect(config.clubId).toBe("999999");
  });

  it("error messages do not contain actual credential values", () => {
    setEnv({ SFV_TOKEN_URL: "http://sfv.invalid/api/token" });

    try {
      getSfvConfig();
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).not.toContain("test-application-key");
        expect(error.message).not.toContain("test-application-pass");
        expect(error.message).not.toContain("999999");
      }
    }
  });
});

// ── No NEXT_PUBLIC_ leakage ───────────────────────────────────────────────────

describe("no NEXT_PUBLIC_ SFV variables", () => {
  it("does not read NEXT_PUBLIC_SFV_* variables", () => {
    process.env["NEXT_PUBLIC_SFV_TOKEN_URL"] = "https://sfv.invalid/api/token";
    process.env["NEXT_PUBLIC_SFV_APPLICATION_KEY"] = "test-key";
    process.env["NEXT_PUBLIC_SFV_APPLICATION_PASS"] = "test-pass";
    process.env["NEXT_PUBLIC_SFV_CLUB_ID"] = "999999";

    const status = getSfvConfigStatus();

    expect(status.hasTokenUrl).toBe(false);
    expect(status.hasApplicationKey).toBe(false);
    expect(status.hasApplicationPass).toBe(false);
    expect(status.hasClubId).toBe(false);

    delete process.env["NEXT_PUBLIC_SFV_TOKEN_URL"];
    delete process.env["NEXT_PUBLIC_SFV_APPLICATION_KEY"];
    delete process.env["NEXT_PUBLIC_SFV_APPLICATION_PASS"];
    delete process.env["NEXT_PUBLIC_SFV_CLUB_ID"];
  });
});
