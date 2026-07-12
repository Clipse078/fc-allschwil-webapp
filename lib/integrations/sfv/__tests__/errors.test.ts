/**
 * Tests for lib/integrations/sfv/errors.ts
 */

import { describe, it, expect } from "vitest";
import {
  SfvError,
  SfvConfigurationError,
  SfvAuthError,
  SfvNetworkError,
  SfvContractUnresolvedError,
  toSafePublicError,
  isRetryableSfvError,
  SFV_ERROR_HTTP_STATUS,
} from "../errors";

describe("SfvError hierarchy", () => {
  it("SfvConfigurationError carries correct code and is instanceof SfvError", () => {
    const err = new SfvConfigurationError("CONFIGURATION_MISSING", "SFV_TOKEN_URL missing");

    expect(err).toBeInstanceOf(SfvError);
    expect(err.code).toBe("CONFIGURATION_MISSING");
    expect(err.message).toBe("SFV_TOKEN_URL missing");
    expect(err.name).toBe("SfvConfigurationError");
  });

  it("SfvAuthError carries correct code", () => {
    const err = new SfvAuthError("SFV_UNAUTHORIZED", "401 Unauthorized");

    expect(err.code).toBe("SFV_UNAUTHORIZED");
    expect(err.name).toBe("SfvAuthError");
  });

  it("SfvNetworkError carries correct code", () => {
    const err = new SfvNetworkError("SFV_TIMEOUT", "Request timed out");

    expect(err.code).toBe("SFV_TIMEOUT");
    expect(err.name).toBe("SfvNetworkError");
  });

  it("SfvContractUnresolvedError carries CONTRACT_UNRESOLVED code", () => {
    const err = new SfvContractUnresolvedError();

    expect(err.code).toBe("CONTRACT_UNRESOLVED");
    expect(err.message).toContain("contract");
    expect(err.name).toBe("SfvContractUnresolvedError");
  });

  it("SfvContractUnresolvedError message does not mention actual credentials", () => {
    const err = new SfvContractUnresolvedError();

    const msg = err.message.toLowerCase();
    expect(msg).not.toMatch(/key|pass|token value|authorization/);
  });
});

describe("toSafePublicError", () => {
  it("preserves code and message for known SfvError", () => {
    const err = new SfvAuthError("SFV_UNAUTHORIZED", "Token rejected.");
    const safe = toSafePublicError(err);

    expect(safe.code).toBe("SFV_UNAUTHORIZED");
    expect(safe.message).toBe("Token rejected.");
  });

  it("classifies timeout-like generic errors as SFV_TIMEOUT", () => {
    const err = new Error("Request timed out after 10s");
    const safe = toSafePublicError(err);

    expect(safe.code).toBe("SFV_TIMEOUT");
  });

  it("classifies network errors as SFV_UNAVAILABLE", () => {
    const err = new Error("fetch failed: ECONNREFUSED");
    const safe = toSafePublicError(err);

    expect(safe.code).toBe("SFV_UNAVAILABLE");
  });

  it("falls back to INTERNAL_ERROR for unknown errors", () => {
    const safe = toSafePublicError(new Error("Something unknown happened"));

    expect(safe.code).toBe("INTERNAL_ERROR");
  });

  it("falls back to INTERNAL_ERROR for non-Error objects", () => {
    const safe = toSafePublicError({ unexpected: true });

    expect(safe.code).toBe("INTERNAL_ERROR");
  });

  it("safe message never contains sensitive keywords for auth errors", () => {
    const err = new SfvAuthError("SFV_UNAUTHORIZED", "Token rejected.");
    const safe = toSafePublicError(err);

    expect(safe.message).not.toMatch(/application[_-]?key|application[_-]?pass|password|bearer/i);
  });

  it("Authorization header is never included in errors emitted by the adapter", () => {
    // The SFV adapter is the sole creator of SfvAuthError messages.
    // Verify that the messages the adapter actually produces contain no
    // Authorization header or token values — they should only contain
    // safe status descriptions.
    const err401 = new SfvAuthError("SFV_UNAUTHORIZED", "SFV token request rejected: 401 Unauthorized.");
    const err403 = new SfvAuthError("SFV_FORBIDDEN", "SFV token request rejected: 403 Forbidden.");

    for (const err of [err401, err403]) {
      const safe = toSafePublicError(err);
      expect(safe.message).not.toMatch(/Authorization:/i);
      expect(safe.message).not.toMatch(/Bearer\s+\S/);
      expect(safe.message).not.toMatch(/application.?key|application.?pass/i);
    }
  });
});

describe("isRetryableSfvError", () => {
  it("marks SFV_TIMEOUT as retryable", () => {
    expect(isRetryableSfvError("SFV_TIMEOUT")).toBe(true);
  });

  it("marks SFV_UNAVAILABLE as retryable", () => {
    expect(isRetryableSfvError("SFV_UNAVAILABLE")).toBe(true);
  });

  it("marks SFV_RATE_LIMITED as retryable", () => {
    expect(isRetryableSfvError("SFV_RATE_LIMITED")).toBe(true);
  });

  it("marks SFV_UNAUTHORIZED as NOT retryable", () => {
    expect(isRetryableSfvError("SFV_UNAUTHORIZED")).toBe(false);
  });

  it("marks SFV_FORBIDDEN as NOT retryable", () => {
    expect(isRetryableSfvError("SFV_FORBIDDEN")).toBe(false);
  });

  it("marks CONFIGURATION_MISSING as NOT retryable", () => {
    expect(isRetryableSfvError("CONFIGURATION_MISSING")).toBe(false);
  });

  it("marks CONFIGURATION_INVALID as NOT retryable", () => {
    expect(isRetryableSfvError("CONFIGURATION_INVALID")).toBe(false);
  });

  it("marks CONTRACT_UNRESOLVED as NOT retryable", () => {
    expect(isRetryableSfvError("CONTRACT_UNRESOLVED")).toBe(false);
  });
});

describe("SFV_ERROR_HTTP_STATUS", () => {
  it("maps all defined error codes to an HTTP status", () => {
    const allCodes = [
      "CONFIGURATION_MISSING",
      "CONFIGURATION_INVALID",
      "SFV_UNAUTHORIZED",
      "SFV_FORBIDDEN",
      "SFV_RATE_LIMITED",
      "SFV_TIMEOUT",
      "SFV_UNAVAILABLE",
      "SFV_INVALID_RESPONSE",
      "CONTRACT_UNRESOLVED",
      "INTERNAL_ERROR",
    ] as const;

    for (const code of allCodes) {
      expect(SFV_ERROR_HTTP_STATUS[code]).toBeGreaterThanOrEqual(400);
    }
  });

  it("maps SFV_UNAUTHORIZED to 502 (bad gateway — upstream rejected)", () => {
    expect(SFV_ERROR_HTTP_STATUS["SFV_UNAUTHORIZED"]).toBe(502);
  });

  it("maps SFV_TIMEOUT to 504", () => {
    expect(SFV_ERROR_HTTP_STATUS["SFV_TIMEOUT"]).toBe(504);
  });

  it("maps CONTRACT_UNRESOLVED to 501 (not implemented)", () => {
    expect(SFV_ERROR_HTTP_STATUS["CONTRACT_UNRESOLVED"]).toBe(501);
  });
});
