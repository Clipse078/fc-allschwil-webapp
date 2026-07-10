/**
 * lib/integrations/sfv/errors.ts
 *
 * Sanitized SFV error model.
 *
 * All errors are classified into semantic codes. No error may expose:
 *   - credentials (application key or password)
 *   - access tokens
 *   - Authorization header values
 *   - raw upstream response bodies
 *   - any other sensitive material
 *
 * Use `toSafePublicError()` to produce a sanitized representation safe
 * to return from API routes.
 */

export type SfvErrorCode =
  | "CONFIGURATION_MISSING"
  | "CONFIGURATION_INVALID"
  | "SFV_UNAUTHORIZED"
  | "SFV_FORBIDDEN"
  | "SFV_RATE_LIMITED"
  | "SFV_TIMEOUT"
  | "SFV_UNAVAILABLE"
  | "SFV_INVALID_RESPONSE"
  | "CONTRACT_UNRESOLVED"
  | "INTERNAL_ERROR";

/**
 * Maps a semantic error code to an appropriate HTTP status for API responses.
 */
export const SFV_ERROR_HTTP_STATUS: Record<SfvErrorCode, number> = {
  CONFIGURATION_MISSING: 503,
  CONFIGURATION_INVALID: 503,
  SFV_UNAUTHORIZED: 502,
  SFV_FORBIDDEN: 502,
  SFV_RATE_LIMITED: 503,
  SFV_TIMEOUT: 504,
  SFV_UNAVAILABLE: 503,
  SFV_INVALID_RESPONSE: 502,
  CONTRACT_UNRESOLVED: 501,
  INTERNAL_ERROR: 500,
};

/**
 * Base class for all SFV integration errors.
 * The `message` field is safe for logging (never contains secrets).
 * The `code` field classifies the failure semantically.
 */
export class SfvError extends Error {
  public readonly code: SfvErrorCode;

  constructor(code: SfvErrorCode, message: string) {
    super(message);
    this.name = "SfvError";
    this.code = code;
  }
}

export class SfvConfigurationError extends SfvError {
  constructor(
    code: Extract<SfvErrorCode, "CONFIGURATION_MISSING" | "CONFIGURATION_INVALID">,
    message: string,
  ) {
    super(code, message);
    this.name = "SfvConfigurationError";
  }
}

export class SfvAuthError extends SfvError {
  constructor(
    code: Extract<SfvErrorCode, "SFV_UNAUTHORIZED" | "SFV_FORBIDDEN">,
    message: string,
  ) {
    super(code, message);
    this.name = "SfvAuthError";
  }
}

export class SfvNetworkError extends SfvError {
  constructor(
    code: Extract<
      SfvErrorCode,
      "SFV_TIMEOUT" | "SFV_UNAVAILABLE" | "SFV_RATE_LIMITED" | "SFV_INVALID_RESPONSE"
    >,
    message: string,
  ) {
    super(code, message);
    this.name = "SfvNetworkError";
  }
}

/**
 * CONTRACT_UNRESOLVED — thrown when the authentication request contract has not
 * yet been confirmed from official SFV documentation. This error is intentional:
 * it surfaces the unresolved boundary rather than silently failing or guessing.
 *
 * To resolve: obtain the official SFV API authentication documentation, confirm
 * the exact HTTP method, Content-Type, and request field names for the token
 * endpoint, then replace the placeholder in `client.ts` with the real implementation.
 */
export class SfvContractUnresolvedError extends SfvError {
  constructor() {
    super(
      "CONTRACT_UNRESOLVED",
      "The SFV token request contract has not been confirmed. " +
        "Obtain the official SFV API documentation and implement the token request body " +
        "in lib/integrations/sfv/client.ts before connecting to the live endpoint.",
    );
    this.name = "SfvContractUnresolvedError";
  }
}

/**
 * Converts any error to a safe public representation.
 * Strips all sensitive data. Returns only code and a sanitized message.
 */
export function toSafePublicError(error: unknown): {
  code: SfvErrorCode;
  message: string;
} {
  if (error instanceof SfvError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    const lowerMsg = error.message.toLowerCase();

    if (lowerMsg.includes("timeout") || lowerMsg.includes("timed out")) {
      return {
        code: "SFV_TIMEOUT",
        message: "Request to SFV timed out.",
      };
    }

    if (
      lowerMsg.includes("fetch failed") ||
      lowerMsg.includes("econnrefused") ||
      lowerMsg.includes("network") ||
      lowerMsg.includes("enotfound")
    ) {
      return {
        code: "SFV_UNAVAILABLE",
        message: "SFV endpoint is not reachable.",
      };
    }
  }

  return {
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred in the SFV integration.",
  };
}

/**
 * Returns true if the error code represents a transient failure that may safely
 * be retried. Authentication failures and configuration errors must NOT be retried.
 */
export function isRetryableSfvError(code: SfvErrorCode): boolean {
  return (
    code === "SFV_TIMEOUT" || code === "SFV_UNAVAILABLE" || code === "SFV_RATE_LIMITED"
  );
}
