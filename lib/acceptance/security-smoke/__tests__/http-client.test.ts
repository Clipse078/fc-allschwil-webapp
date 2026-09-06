import { describe, expect, it, vi } from "vitest";
import { createCookieJar, createSmokeHttpClient } from "@/lib/acceptance/security-smoke/http-client";

describe("createCookieJar", () => {
  it("stores and serializes cookies from Set-Cookie headers", () => {
    const jar = createCookieJar();
    const headers = new Headers();
    headers.append("set-cookie", "authjs.session-token=abc123; Path=/; HttpOnly");
    jar.ingest(headers);
    expect(jar.headerValue()).toBe("authjs.session-token=abc123");
  });
});

describe("createSmokeHttpClient", () => {
  it("performs credentials login and session lookup with a cookie jar", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/auth/csrf")) {
        return new Response(JSON.stringify({ csrfToken: "csrf-token" }), {
          status: 200,
          headers: { "set-cookie": "authjs.csrf-token=csrf-cookie; Path=/" },
        });
      }
      if (url.endsWith("/api/auth/callback/credentials")) {
        expect(init?.method).toBe("POST");
        return new Response(JSON.stringify({ url: "/dashboard" }), {
          status: 200,
          headers: {
            "set-cookie":
              "authjs.session-token=session-token; Path=/; HttpOnly",
          },
        });
      }
      if (url.endsWith("/api/auth/session")) {
        return new Response(
          JSON.stringify({
            user: {
              email: "club-admin-alpha@acceptance.sportclubevo.com",
              activeTenantId: "sce-acceptance-tenant-alpha",
            },
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
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });
});
