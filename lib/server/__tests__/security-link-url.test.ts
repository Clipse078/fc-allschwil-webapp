import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildPasswordResetLink,
  resolveSecurityLinkBaseUrl,
  SecurityLinkConfigurationError,
} from "../security-link-url";

const DEPLOYED_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  APP_ENV: "stage",
  VERCEL: "1",
  VERCEL_ENV: "production",
};

function deployedEnv(overrides: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...DEPLOYED_ENV, ...overrides };
}

describe("resolveSecurityLinkBaseUrl", () => {
  it("accepts and normalizes a deployed HTTPS APP_BASE_URL", () => {
    const result = resolveSecurityLinkBaseUrl(
      deployedEnv({ APP_BASE_URL: "https://platform.example.test/" }),
    );

    expect(result.toString()).toBe("https://platform.example.test/");
  });

  it("prefers APP_BASE_URL over NEXTAUTH_URL", () => {
    const result = resolveSecurityLinkBaseUrl(
      deployedEnv({
        APP_BASE_URL: "https://app.example.test",
        NEXTAUTH_URL: "https://auth.example.test",
      }),
    );

    expect(result.origin).toBe("https://app.example.test");
  });

  it("falls back to NEXTAUTH_URL when APP_BASE_URL is absent", () => {
    const result = resolveSecurityLinkBaseUrl(
      deployedEnv({ NEXTAUTH_URL: "https://auth.example.test/" }),
    );

    expect(result.origin).toBe("https://auth.example.test");
  });

  it.each([
    ["malformed", "https://["],
    ["relative", "/relative"],
    ["deployed HTTP", "http://platform.example.test"],
    ["deployed localhost", "https://localhost:3000"],
    ["deployed IPv4 loopback", "https://127.0.0.42"],
    ["username", "https://user@platform.example.test"],
    ["password", "https://user:password@platform.example.test"],
    ["query", "https://platform.example.test?next=hostile"],
    ["fragment", "https://platform.example.test#fragment"],
    ["path prefix", "https://platform.example.test/prefix"],
  ])("rejects a %s base URL", (_classification, value) => {
    expect(() =>
      resolveSecurityLinkBaseUrl(deployedEnv({ APP_BASE_URL: value })),
    ).toThrow(SecurityLinkConfigurationError);
  });

  it("does not bypass an invalid APP_BASE_URL with NEXTAUTH_URL", () => {
    expect(() =>
      resolveSecurityLinkBaseUrl(
        deployedEnv({
          APP_BASE_URL: "https://platform.example.test/path",
          NEXTAUTH_URL: "https://auth.example.test",
        }),
      ),
    ).toThrow(SecurityLinkConfigurationError);
  });

  it.each([
    ["local", "development", "http://localhost:3000"],
    ["test", "test", "http://127.0.0.1:3000"],
  ])("allows an HTTP loopback URL for %s execution", (appEnv, nodeEnv, url) => {
    const result = resolveSecurityLinkBaseUrl({
      NODE_ENV: nodeEnv,
      APP_ENV: appEnv,
      APP_BASE_URL: url,
    });

    expect(result.origin).toBe(url);
  });

  it("rejects HTTP for a non-loopback host even during local execution", () => {
    expect(() =>
      resolveSecurityLinkBaseUrl({
        NODE_ENV: "development",
        APP_ENV: "local",
        APP_BASE_URL: "http://remote.example.test",
      }),
    ).toThrow(SecurityLinkConfigurationError);
  });

  it("never uses request-derived host metadata", () => {
    const result = resolveSecurityLinkBaseUrl(
      deployedEnv({
        APP_BASE_URL: "https://canonical.example.test",
        HOST: "hostile.example.test",
        HTTP_HOST: "hostile.example.test",
        X_FORWARDED_HOST: "hostile.example.test",
      }),
    );

    expect(result.origin).toBe("https://canonical.example.test");
  });
});

describe("buildPasswordResetLink", () => {
  it("uses the canonical route and encodes the token exactly once", () => {
    const rawToken = "a+b/c?d=e%f";
    const link = buildPasswordResetLink(
      rawToken,
      deployedEnv({ APP_BASE_URL: "https://platform.example.test" }),
    );
    const parsed = new URL(link);

    expect(parsed.origin).toBe("https://platform.example.test");
    expect(parsed.pathname).toBe("/reset-password");
    expect(parsed.searchParams.get("token")).toBe(rawToken);
    expect(link).toBe(
      "https://platform.example.test/reset-password?token=a%2Bb%2Fc%3Fd%3De%25f",
    );
  });
});
