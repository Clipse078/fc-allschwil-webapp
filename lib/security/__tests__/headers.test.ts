import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  buildSecurityHeaderRules,
  CSP_REPORT_ENDPOINT,
  isDeployedHttpsEnvironment,
} from "@/lib/security/headers";
import { nextConfig } from "@/next.config";

function globalHeaders(environment: {
  NODE_ENV?: string;
  APP_ENV?: string;
  VERCEL?: string;
}) {
  const globalRule = buildSecurityHeaderRules(environment)[0];
  return new Map(
    globalRule?.headers.map(({ key, value }) => [key, value]) ?? [],
  );
}

describe("browser security headers", () => {
  it("applies the production policy on deployed HTTPS environments", () => {
    const headers = globalHeaders({
      NODE_ENV: "production",
      APP_ENV: "stage",
      VERCEL: "1",
    });

    expect(headers.get("Strict-Transport-Security")).toBe(
      "max-age=31536000",
    );
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("Cross-Origin-Opener-Policy")).toBe(
      "same-origin-allow-popups",
    );
    expect(headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
    expect(headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(headers.has("Content-Security-Policy")).toBe(false);

    const csp = headers.get("Content-Security-Policy-Report-Only");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("frame-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).toContain(`report-uri ${CSP_REPORT_ENDPOINT}`);
  });

  it("does not include dangerous broad production script allowances", () => {
    const csp = buildContentSecurityPolicy({
      NODE_ENV: "production",
      VERCEL: "1",
    });
    const scriptDirective = csp
      .split("; ")
      .find((directive) => directive.startsWith("script-src "));

    expect(csp).not.toContain("*");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(scriptDirective).toBe("script-src 'self' 'unsafe-inline'");
    expect(scriptDirective).not.toContain("data:");
    expect(scriptDirective).not.toContain("http:");
    expect(csp).toContain("script-src-attr 'none'");
  });

  it("allows only evidenced external image classes", () => {
    const csp = buildContentSecurityPolicy({
      NODE_ENV: "production",
      APP_ENV: "prod",
    });

    expect(csp).toContain("img-src 'self' data: blob: https:");
    expect(csp).not.toContain("img-src 'self' data: blob: https: http:");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toContain("connect-src 'self' https:");
  });

  it("keeps local development usable without transport pinning", () => {
    const headers = globalHeaders({
      NODE_ENV: "development",
      APP_ENV: "local",
    });
    const csp = headers.get("Content-Security-Policy-Report-Only");

    expect(headers.has("Strict-Transport-Security")).toBe(false);
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("img-src 'self' data: blob: https: http:");
    expect(csp).toContain("connect-src 'self' ws: wss:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("does not emit HSTS for a local production build", () => {
    const environment = {
      NODE_ENV: "production",
      APP_ENV: "local",
    };

    expect(isDeployedHttpsEnvironment(environment)).toBe(false);
    expect(globalHeaders(environment).has("Strict-Transport-Security")).toBe(
      false,
    );
    expect(buildContentSecurityPolicy(environment)).not.toContain(
      "upgrade-insecure-requests",
    );
  });

  it("keeps cross-origin public API consumers compatible", () => {
    const rules = buildSecurityHeaderRules({
      NODE_ENV: "production",
      APP_ENV: "prod",
    });
    const publicApiRule = rules.find(
      ({ source }) => source === "/api/public/:path*",
    );

    expect(publicApiRule?.headers).toEqual([
      {
        key: "Cross-Origin-Resource-Policy",
        value: "cross-origin",
      },
    ]);
  });

  it("keeps the complete restrictive global control set", () => {
    const headers = globalHeaders({
      NODE_ENV: "production",
      APP_ENV: "prod",
    });

    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headers.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), browsing-topics=()",
    );
    expect(headers.get("Cross-Origin-Opener-Policy")).toBe(
      "same-origin-allow-popups",
    );
    expect(headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
    expect(headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
  });

  it("keeps the Next.js powered-by header disabled", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("is host-agnostic for every tenant", () => {
    const serializedRules = JSON.stringify(
      buildSecurityHeaderRules({
        NODE_ENV: "production",
        APP_ENV: "prod",
      }),
    ).toLowerCase();

    expect(serializedRules).not.toContain("fcallschwil");
    expect(serializedRules).not.toContain("sportclubevo.com");
    expect(serializedRules).not.toContain('"type":"host"');
  });
});
