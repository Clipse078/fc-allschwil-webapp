import { describe, it, expect } from "vitest";
import {
  createRateLimitResponse,
  GENERIC_RATE_LIMIT_MESSAGE,
  retryAfterSecondsFromMs,
} from "../rate-limit-response";

describe("createRateLimitResponse", () => {
  it("returns 429 with Retry-After header", async () => {
    const response = createRateLimitResponse(45_000);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("45");
    const body = await response.json();
    expect(body).toEqual({ error: GENERIC_RATE_LIMIT_MESSAGE });
  });

  it("never exposes internal identifiers in the default body", async () => {
    const response = createRateLimitResponse(1_000);
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/userId|tenantId|email|ip|rule/i);
  });

  it("supports custom non-enumerating body shapes", async () => {
    const response = createRateLimitResponse(2_000, {
      ok: false,
      error: "Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.",
    });
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(response.headers.get("Retry-After")).toBe("2");
  });

  it("rounds sub-second retry windows up to at least 1 second", () => {
    expect(retryAfterSecondsFromMs(250)).toBe(1);
    expect(retryAfterSecondsFromMs(1000)).toBe(1);
    expect(retryAfterSecondsFromMs(1001)).toBe(2);
  });
});
