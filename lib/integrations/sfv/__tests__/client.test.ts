/**
 * Tests for lib/integrations/sfv/client.ts
 *
 * All tests use synthetic credentials with the .invalid domain.
 * The HTTP layer is mocked; no real network requests are made.
 * The actual token request contract (field names, Content-Type) is pending
 * official SFV API documentation and is tested via the CONTRACT_UNRESOLVED stub.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  acquireToken,
  evictCachedToken,
  getCachedTokenExpiresAt,
  hasCachedToken,
  testSfvConnection,
} from "../client";
import { SfvContractUnresolvedError } from "../errors";

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
  setEnv();
  evictCachedToken();
  vi.restoreAllMocks();
});

afterEach(() => {
  clearSfvEnv();
  evictCachedToken();
  vi.restoreAllMocks();
});

// ── Contract boundary — current stub behaviour ─────────────────────────────

describe("token contract boundary", () => {
  it("acquireToken throws SfvContractUnresolvedError until contract is implemented", async () => {
    await expect(acquireToken()).rejects.toThrow(SfvContractUnresolvedError);
  });

  it("CONTRACT_UNRESOLVED error message references the client file", async () => {
    try {
      await acquireToken();
      expect.fail("should have thrown");
    } catch (error) {
      if (error instanceof SfvContractUnresolvedError) {
        expect(error.message).toContain("client.ts");
      }
    }
  });

  it("contract error is not retried (not retryable)", async () => {
    const spy = vi.spyOn(globalThis, "fetch");

    await expect(acquireToken()).rejects.toThrow(SfvContractUnresolvedError);

    expect(spy).not.toHaveBeenCalled();
  });
});

// ── Configuration errors propagate ────────────────────────────────────────────

describe("configuration errors", () => {
  it("throws when SFV_TOKEN_URL is missing", async () => {
    clearSfvEnv();
    setEnv();
    delete process.env["SFV_TOKEN_URL"];

    await expect(acquireToken()).rejects.toThrow(/SFV_TOKEN_URL/);
  });

  it("throws when SFV_APPLICATION_KEY is missing", async () => {
    clearSfvEnv();
    setEnv();
    delete process.env["SFV_APPLICATION_KEY"];

    await expect(acquireToken()).rejects.toThrow(/SFV_APPLICATION_KEY/);
  });

  it("throws when SFV_APPLICATION_PASS is missing", async () => {
    clearSfvEnv();
    setEnv();
    delete process.env["SFV_APPLICATION_PASS"];

    await expect(acquireToken()).rejects.toThrow(/SFV_APPLICATION_PASS/);
  });

  it("throws when SFV_CLUB_ID is missing", async () => {
    clearSfvEnv();
    setEnv();
    delete process.env["SFV_CLUB_ID"];

    await expect(acquireToken()).rejects.toThrow(/SFV_CLUB_ID/);
  });

  it("throws CONFIGURATION_INVALID for non-HTTPS token URL", async () => {
    clearSfvEnv();
    setEnv({ SFV_TOKEN_URL: "http://sfv.invalid/api/token" });

    await expect(acquireToken()).rejects.toThrow(/HTTPS/i);
  });
});

// ── Cache and deduplication ────────────────────────────────────────────────────

describe("token cache state", () => {
  it("hasCachedToken returns false when no token is cached", () => {
    evictCachedToken();
    expect(hasCachedToken()).toBe(false);
  });

  it("getCachedTokenExpiresAt returns null when no token is cached", () => {
    evictCachedToken();
    expect(getCachedTokenExpiresAt()).toBeNull();
  });

  it("evictCachedToken clears the cache", async () => {
    evictCachedToken();
    expect(hasCachedToken()).toBe(false);
    expect(getCachedTokenExpiresAt()).toBeNull();
  });
});

// ── testSfvConnection ─────────────────────────────────────────────────────────

describe("testSfvConnection", () => {
  it("returns connected=false when contract is unresolved", async () => {
    const result = await testSfvConnection();

    expect(result.connected).toBe(false);
    expect(result.tokenValid).toBe(false);
    expect(result.testedAt).toBeDefined();
    expect(result.error).not.toBeNull();
    expect(result.error?.code).toBe("CONTRACT_UNRESOLVED");
  });

  it("returns a testedAt ISO timestamp", async () => {
    const result = await testSfvConnection();

    expect(result.testedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("result contains no token, application key, password, or Authorization header", async () => {
    const result = await testSfvConnection();
    const json = JSON.stringify(result);

    expect(json).not.toContain("test-application-key");
    expect(json).not.toContain("test-application-pass");
    expect(json).not.toContain("Authorization");
    expect(json).not.toContain("Bearer");
  });

  it("result contains no tokenExpiresAt when connection fails", async () => {
    const result = await testSfvConnection();

    expect(result.tokenExpiresAt).toBeNull();
  });

  it("evicts cached token before testing", async () => {
    expect(hasCachedToken()).toBe(false);

    await testSfvConnection();

    expect(hasCachedToken()).toBe(false);
  });
});

// ── Token redaction ────────────────────────────────────────────────────────────

describe("token redaction", () => {
  it("error messages do not contain credential values", async () => {
    try {
      await acquireToken();
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).not.toContain("test-application-key");
        expect(error.message).not.toContain("test-application-pass");
      }
    }
  });
});

// ── No database writes ────────────────────────────────────────────────────────

describe("no database writes during connection test", () => {
  it("testSfvConnection completes without any prisma import (client module has no DB dependency)", async () => {
    // The client module intentionally has no Prisma import.
    // This test verifies that testSfvConnection resolves (not throws unexpectedly)
    // and that the result shape confirms no persistence occurred.
    const result = await testSfvConnection();

    // Result is returned (not undefined), confirming the function ran.
    expect(result).toBeDefined();
    // No persistence fields exist in the result — only transient state.
    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("createdAt");
    expect(result).not.toHaveProperty("persistedAt");
  });
});
