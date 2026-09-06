import { describe, expect, it, vi } from "vitest";
import { ACCEPTANCE_FIXTURE } from "@/lib/acceptance/bootstrap";
import {
  createCookieJar,
  createSmokeHttpClient,
  createSmokeSessionCacheClient,
} from "@/lib/acceptance/security-smoke/http-client";

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

describe("createSmokeSessionCacheClient", () => {
  const alphaAdminEmail = ACCEPTANCE_FIXTURE.users.alphaAdmin.email;
  const betaAdminEmail = ACCEPTANCE_FIXTURE.users.betaAdmin.email;
  const alphaMemberEmail = ACCEPTANCE_FIXTURE.users.alphaMember.email;
  const baseUrl = "https://acceptance.example.test";

  function createAuthFetchImpl(sessions: Record<string, Record<string, unknown>>) {
    const loggedInEmails = new Set<string>();

    return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const cookieHeader = new Headers(init?.headers).get("cookie") ?? "";

      if (url.endsWith("/api/auth/csrf")) {
        return new Response(JSON.stringify({ csrfToken: "csrf-token" }), {
          status: 200,
          headers: { "set-cookie": "__Host-authjs.csrf-token=csrf-cookie; Path=/" },
        });
      }

      if (url.endsWith("/api/auth/callback/credentials")) {
        const body = String(init?.body ?? "");
        const params = new URLSearchParams(body);
        const email = params.get("email");
        if (!email) {
          throw new Error("Missing email in credentials callback.");
        }
        loggedInEmails.add(email.trim().toLowerCase());
        return new Response(JSON.stringify({ url: `${baseUrl}/dashboard` }), {
          status: 200,
          headers: {
            "set-cookie": `__Secure-authjs.session-token=${email}; Path=/; HttpOnly; Secure`,
          },
        });
      }

      if (url.endsWith("/api/auth/session")) {
        for (const [email, user] of Object.entries(sessions)) {
          const token = `__Secure-authjs.session-token=${email}`;
          if (cookieHeader.includes(token)) {
            return new Response(JSON.stringify({ user }), { status: 200 });
          }
        }
        return new Response(JSON.stringify({}), { status: 200 });
      }

      if (url.endsWith("/api/org-units")) {
        if (cookieHeader.includes("__Secure-authjs.session-token=")) {
          return new Response(JSON.stringify({ orgUnits: [] }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });
  }

  function countCredentialLogins(fetchImpl: ReturnType<typeof vi.fn>): number {
    return fetchImpl.mock.calls.filter(([input]) =>
      String(input).endsWith("/api/auth/callback/credentials"),
    ).length;
  }

  it("authenticates the same fixture identity only once across repeated scenarios", async () => {
    const fetchImpl = createAuthFetchImpl({
      [alphaAdminEmail]: { email: alphaAdminEmail },
    });
    const client = createSmokeSessionCacheClient(baseUrl, fetchImpl as typeof fetch);

    await client.loginWithCredentials(alphaAdminEmail, "password");
    await client.loginWithCredentials(alphaAdminEmail, "password");
    await client.loginWithCredentials(alphaAdminEmail, "password");

    expect(countCredentialLogins(fetchImpl)).toBe(1);
  });

  it("authenticates Alpha and Beta once each when switching Alpha → Beta → Alpha", async () => {
    const fetchImpl = createAuthFetchImpl({
      [alphaAdminEmail]: { email: alphaAdminEmail },
      [betaAdminEmail]: { email: betaAdminEmail },
    });
    const client = createSmokeSessionCacheClient(baseUrl, fetchImpl as typeof fetch);

    await client.loginWithCredentials(alphaAdminEmail, "password");
    await client.loginWithCredentials(betaAdminEmail, "password");
    await client.loginWithCredentials(alphaAdminEmail, "password");

    expect(countCredentialLogins(fetchImpl)).toBe(2);
  });

  it("keeps member and admin sessions isolated in separate cookie jars", async () => {
    const fetchImpl = createAuthFetchImpl({
      [alphaAdminEmail]: { email: alphaAdminEmail, role: "admin" },
      [alphaMemberEmail]: { email: alphaMemberEmail, role: "member" },
    });
    const client = createSmokeSessionCacheClient(baseUrl, fetchImpl as typeof fetch);

    await client.loginWithCredentials(alphaAdminEmail, "password");
    const adminSession = await client.getSession();
    await client.loginWithCredentials(alphaMemberEmail, "password");
    const memberSession = await client.getSession();

    expect(adminSession?.user).toMatchObject({ email: alphaAdminEmail, role: "admin" });
    expect(memberSession?.user).toMatchObject({ email: alphaMemberEmail, role: "member" });
    expect(countCredentialLogins(fetchImpl)).toBe(2);
  });

  it("uses an anonymous session after clearCookies without reusing authenticated cookies", async () => {
    const fetchImpl = createAuthFetchImpl({
      [alphaAdminEmail]: { email: alphaAdminEmail },
    });
    const client = createSmokeSessionCacheClient(baseUrl, fetchImpl as typeof fetch);

    await client.loginWithCredentials(alphaAdminEmail, "password");
    client.clearCookies();
    const response = await client.get("/api/org-units");

    expect(response.status).toBe(401);
    expect(countCredentialLogins(fetchImpl)).toBe(1);
  });

  it("does not leak anonymous clearCookies into cached authenticated identities", async () => {
    const fetchImpl = createAuthFetchImpl({
      [alphaAdminEmail]: { email: alphaAdminEmail },
      [betaAdminEmail]: { email: betaAdminEmail },
    });
    const client = createSmokeSessionCacheClient(baseUrl, fetchImpl as typeof fetch);

    await client.loginWithCredentials(alphaAdminEmail, "password");
    await client.loginWithCredentials(betaAdminEmail, "password");
    client.clearCookies();
    await client.loginWithCredentials(alphaAdminEmail, "password");
    const session = await client.getSession();

    expect(session?.user).toMatchObject({ email: alphaAdminEmail });
    expect(countCredentialLogins(fetchImpl)).toBe(2);
  });
});
