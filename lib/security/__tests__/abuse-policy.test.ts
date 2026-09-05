import { describe, it, expect } from "vitest";
import {
  APP_RATE_LIMITS,
  WAF_AUTH_RATE_LIMITS,
  checkApplicationRateLimit,
  INVITATION_RESEND_COOLDOWN_MS,
} from "../abuse-policy";

describe("abuse-policy constants", () => {
  it("mirrors WAF forgot-password threshold in documentation contract", () => {
    expect(WAF_AUTH_RATE_LIMITS.forgotPassword.threshold).toBe(5);
    expect(WAF_AUTH_RATE_LIMITS.forgotPassword.windowSeconds).toBe(600);
  });

  it("keeps application forgot-password limit at 5 per 15 minutes", () => {
    expect(APP_RATE_LIMITS.forgotPassword.limit).toBe(5);
    expect(APP_RATE_LIMITS.forgotPassword.windowMs).toBe(15 * 60_000);
  });

  it("defines invitation resend cooldown at 60 seconds", () => {
    expect(INVITATION_RESEND_COOLDOWN_MS).toBe(60_000);
  });
});

describe("checkApplicationRateLimit", () => {
  it("allows requests within the configured window", () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    const result = checkApplicationRateLimit("login", key);
    expect(result).toEqual({ allowed: true });
  });

  it("blocks after exceeding the login limit", () => {
    const key = `burst-${Date.now()}-${Math.random()}`;
    const { limit } = APP_RATE_LIMITS.login;

    for (let i = 0; i < limit; i += 1) {
      const result = checkApplicationRateLimit("login", key);
      expect(result.allowed).toBe(true);
    }

    const blocked = checkApplicationRateLimit("login", key);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
    }
  });
});
