import { describe, expect, it, vi } from "vitest";
import { createCookieJar, createSmokeHttpClient } from "@/lib/acceptance/security-smoke/http-client";

function headersInclude(
  headers: HeadersInit | undefined,
  expected: Record<string, string>,
): void {
  const normalized = new Headers(headers);
  for (const [name, value] of Object.entries(expected)) {
    expect(normalized.get(name)).toBe(value);
  }
}

describe("createCookieJar", () => {
  it("stores and serializes cookies from Set-Cookie headers", () => {
    const jar = createCookieJar();
    const headers = new Headers();
    headers.append("set-cookie", "authjs.session-token=abc123; Path=/; HttpOnly");
    jar.ingest(headers);
    expect(jar.headerValue()).toBe("authjs.session-token=abc123");
    expect(jar.hasAuthSessionCookie()).toBe(true);
  });

  it("detects secure Auth.js session cookie names", () => {
    const jar = createCookieJar();
    const headers = new Headers();
    headers.append(
      "set-cookie",
      "__Secure-authjs.session-token.0=chunk; Path=/; HttpOnly; Secure",
    );
    jar.ingest(headers);
    expect(jar.hasAuthSessionCookie()).toBe(true);
  });
});

describe("createSmokeHttpClient", () => {
  it("performs credentials login and session lookup with a cookie jar", async () => {
    let loggedIn = false;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/auth/csrf")) {
        return new Response(JSON.stringify({ csrfToken: "csrf-token" }), {
          status: 200,
          headers: { "set-cookie": "__Host-authjs.csrf-token=csrf-cookie; Path=/" },
        });
      }
      if (url.endsWith("/api/auth/callback/credentials")) {
        expect(init?.method).toBe("POST");
        headersInclude(init?.headers, { "X-Auth-Return-Redirect": "1" });
        const body = String(init?.body ?? "");
        expect(body).toContain("callbackUrl=");
        expect(body).not.toContain("json=true");
        loggedIn = true;
        return new Response(
          JSON.stringify({ url: "https://acceptance.example.test/dashboard" }),
          {
            status: 200,
            headers: {
              "set-cookie":
                "__Secure-authjs.session-token=session-token; Path=/; HttpOnly; Secure",
            },
          },
        );
      }
      if (url.endsWith("/api/auth/session")) {
        return new Response(
          JSON.stringify({
            user: loggedIn
              ? {
                  email: "club-admin-alpha@acceptance.sportclubevo.com",
                  activeTenantId: "sce-acceptance-tenant-alpha",
                }
              : null,
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const client = createSmokeHttpClient(
      "https://acceptance.example.test",
      fetchImpl as typeof fetch,
    );
    await client.loginWithCredentials(
      "club-admin-alpha@acceptance.sportclubevo.com",
      "test-password",
    );
    const session = await client.getSession();
    expect(session?.user).toMatchObject({
      email: "club-admin-alpha@acceptance.sportclubevo.com",
      activeTenantId: "sce-acceptance-tenant-alpha",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it("reuses an existing authenticated session for the same email", async () => {
    let loggedIn = false;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/auth/csrf")) {
        return new Response(JSON.stringify({ csrfToken: "csrf-token" }), {
          status: 200,
          headers: { "set-cookie": "__Host-authjs.csrf-token=csrf-cookie; Path=/" },
        });
      }
      if (url.endsWith("/api/auth/callback/credentials")) {
        headersInclude(init?.headers, { "X-Auth-Return-Redirect": "1" });
        loggedIn = true;
        return new Response(
          JSON.stringify({ url: "https://acceptance.example.test/dashboard" }),
          {
            status: 200,
            headers: {
              "set-cookie":
                "__Secure-authjs.session-token=session-token; Path=/; HttpOnly; Secure",
            },
          },
        );
      }
      if (url.endsWith("/api/auth/session")) {
        return new Response(
          JSON.stringify({
            user: loggedIn
              ? { email: "club-admin-alpha@acceptance.sportclubevo.com" }
              : null,
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const client = createSmokeHttpClient(
      "https://acceptance.example.test",
      fetchImpl as typeof fetch,
    );
    await client.loginWithCredentials(
      "club-admin-alpha@acceptance.sportclubevo.com",
      "test-password",
    );
    await client.loginWithCredentials(
      "club-admin-alpha@acceptance.sportclubevo.com",
      "test-password",
    );
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it("surfaces invalid credentials from Auth.js redirect URLs", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/auth/csrf")) {
        return new Response(JSON.stringify({ csrfToken: "csrf-token" }), {
          status: 200,
          headers: { "set-cookie": "__Host-authjs.csrf-token=csrf-cookie; Path=/" },
        });
      }
      if (url.endsWith("/api/auth/callback/credentials")) {
        headersInclude(init?.headers, { "X-Auth-Return-Redirect": "1" });
        return new Response(
          JSON.stringify({
            url: "https://acceptance.example.test/login?error=CredentialsSignin&code=credentials",
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/api/auth/session")) {
        return new Response(JSON.stringify({}), { status: 200 });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const client = createSmokeHttpClient(
      "https://acceptance.example.test",
      fetchImpl as typeof fetch,
    );
    await expect(
      client.loginWithCredentials(
        "club-admin-alpha@acceptance.sportclubevo.com",
        "wrong-password",
      ),
    ).rejects.toThrow(/invalid email or password/i);
  });
});
