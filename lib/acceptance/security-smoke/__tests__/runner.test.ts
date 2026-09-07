import { describe, expect, it, vi } from "vitest";
import { ACCEPTANCE_FIXTURE } from "@/lib/acceptance/bootstrap";
import { initializeSmokeFixtureClients } from "@/lib/acceptance/security-smoke/http-client";
import { runAcceptanceSecuritySmoke } from "@/lib/acceptance/security-smoke/runner";
import { ACCEPTANCE_SECURITY_SMOKE_SCENARIOS } from "@/lib/acceptance/security-smoke/scenarios";
import type {
  AcceptanceSecuritySmokeConfig,
  SmokeFixtureClients,
  SmokeHttpClient,
  SmokeHttpResponse,
  SmokeScenario,
} from "@/lib/acceptance/security-smoke/types";

function response(status: number, body: unknown): SmokeHttpResponse {
  const bodyText = JSON.stringify(body);
  return {
    status,
    headers: new Headers(),
    bodyText,
    json: () => body,
  };
}

function passwordsFromFixture(): AcceptanceSecuritySmokeConfig["passwords"] {
  return Object.fromEntries(
    Object.values(ACCEPTANCE_FIXTURE.users).map((user) => [
      user.passwordEnv,
      `test-${user.passwordEnv}`,
    ]),
  ) as AcceptanceSecuritySmokeConfig["passwords"];
}

function createMockClients(handlers: {
  routes: Record<string, (method: "GET" | "POST") => SmokeHttpResponse>;
  sessions: Partial<
    Record<
      keyof Omit<SmokeFixtureClients, "anonymous">,
      Record<string, unknown>
    >
  >;
}): SmokeFixtureClients {
  function createClient(
    sessionUser: Record<string, unknown> | null,
  ): SmokeHttpClient {
    return {
      clearCookies() {},
      async loginWithCredentials() {
        throw new Error("Scenario must not call loginWithCredentials.");
      },
      async getSession() {
        return sessionUser ? { user: sessionUser } : null;
      },
      async get(path) {
        const handler = handlers.routes[`GET ${path}`];
        if (!handler) {
          throw new Error(`Unexpected GET ${path}`);
        }
        return handler("GET");
      },
      async post(path, body) {
        const handler = handlers.routes[`POST ${path}`];
        if (!handler) {
          throw new Error(`Unexpected POST ${path}`);
        }
        void body;
        return handler("POST");
      },
    };
  }

  return {
    anonymous: createClient(null),
    superadmin: createClient(handlers.sessions.superadmin ?? null),
    alphaAdmin: createClient(handlers.sessions.alphaAdmin ?? null),
    alphaMember: createClient(handlers.sessions.alphaMember ?? null),
    betaAdmin: createClient(handlers.sessions.betaAdmin ?? null),
    betaMember: createClient(handlers.sessions.betaMember ?? null),
  };
}

describe("runAcceptanceSecuritySmoke", () => {
  it("reports PASS and FAIL per scenario without leaking secrets", async () => {
    const scenarios: SmokeScenario[] = [
      {
        id: "passing-scenario",
        name: "Passing scenario",
        category: "session-auth",
        async run() {
          return "ok";
        },
      },
      {
        id: "failing-scenario",
        name: "Failing scenario",
        category: "tenant-isolation",
        async run() {
          throw new Error("password=secret-token csrfToken=abc");
        },
      },
    ];

    const logs: string[] = [];
    const summary = await runAcceptanceSecuritySmoke(
      {
        baseUrl: "https://acceptance.example.test",
        passwords: passwordsFromFixture(),
      },
      {
        scenarios,
        initializeClients: async () =>
          createMockClients({ routes: {}, sessions: {} }),
        log: (message) => logs.push(message),
        error: (message) => logs.push(message),
      },
    );

    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.results[1]?.detail).not.toContain("secret-token");
    expect(logs.join("\n")).not.toContain("secret-token");
  });

  it("executes representative tenant and role isolation checks via fixture clients", async () => {
    const betaSlug = ACCEPTANCE_FIXTURE.tenants.beta.key;
    const clients = createMockClients({
      sessions: {
        alphaAdmin: {
          email: ACCEPTANCE_FIXTURE.users.alphaAdmin.email,
          activeTenantId: ACCEPTANCE_FIXTURE.tenants.alpha.id,
        },
      },
      routes: {
        "GET /api/org-units": () =>
          response(200, {
            orgUnits: [{ id: "sce-acceptance-org-alpha-club" }],
          }),
        [`GET /api/tenants/${betaSlug}/registrations`]: () => response(404, {}),
        "GET /api/admin/users": () => response(200, { users: [] }),
      },
    });

    const scenarios: SmokeScenario[] = [
      {
        id: "alpha-admin-accesses-alpha-org-units",
        name: "Alpha admin org units",
        category: "tenant-isolation",
        async run({ clients: fixtureClients }) {
          const orgUnits = await fixtureClients.alphaAdmin.get("/api/org-units");
          if (orgUnits.status !== 200) {
            throw new Error(`Expected 200, received ${orgUnits.status}`);
          }
          return "Alpha org units accessible";
        },
      },
      {
        id: "alpha-admin-cannot-access-beta-slug-registrations",
        name: "Alpha admin beta slug denied",
        category: "tenant-isolation",
        async run({ clients: fixtureClients }) {
          const denied = await fixtureClients.alphaAdmin.get(
            `/api/tenants/${betaSlug}/registrations`,
          );
          if (denied.status !== 404) {
            throw new Error(`Expected 404, received ${denied.status}`);
          }
          return "Denied";
        },
      },
    ];

    const summary = await runAcceptanceSecuritySmoke(
      {
        baseUrl: "https://acceptance.example.test",
        passwords: passwordsFromFixture(),
      },
      {
        scenarios,
        initializeClients: async () => clients,
        log: vi.fn(),
        error: vi.fn(),
      },
    );

    expect(summary.failed).toBe(0);
    expect(summary.passed).toBe(2);
  });

  it("authenticates exactly five fixture identities for the full 25-scenario run", async () => {
    const baseUrl = "https://acceptance.example.test";
    const credentialLogins: string[] = [];
    const postInitLoginCalls: string[] = [];

    const {
      superadmin: superadminEmail,
      alphaAdmin: alphaAdminEmail,
      alphaMember: alphaMemberEmail,
      betaAdmin: betaAdminEmail,
      betaMember: betaMemberEmail,
    } = ACCEPTANCE_FIXTURE.users;

    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const cookieHeader = new Headers(init?.headers).get("cookie") ?? "";

      if (url.endsWith("/api/auth/csrf")) {
        return new Response(JSON.stringify({ csrfToken: "csrf-token" }), {
          status: 200,
          headers: { "set-cookie": "__Host-authjs.csrf-token=csrf-cookie; Path=/" },
        });
      }

      if (url.endsWith("/api/auth/callback/credentials")) {
        const params = new URLSearchParams(String(init?.body ?? ""));
        const email = params.get("email");
        if (email) credentialLogins.push(email.trim().toLowerCase());
        return new Response(JSON.stringify({ url: `${baseUrl}/dashboard` }), {
          status: 200,
          headers: {
            "set-cookie": `__Secure-authjs.session-token=${email}; Path=/; HttpOnly; Secure`,
          },
        });
      }

      if (url.endsWith("/api/auth/session")) {
        for (const [email, activeTenantId] of [
          [superadminEmail.email, ACCEPTANCE_FIXTURE.tenants.alpha.id],
          [alphaAdminEmail.email, ACCEPTANCE_FIXTURE.tenants.alpha.id],
          [alphaMemberEmail.email, ACCEPTANCE_FIXTURE.tenants.alpha.id],
          [betaAdminEmail.email, ACCEPTANCE_FIXTURE.tenants.beta.id],
          [betaMemberEmail.email, ACCEPTANCE_FIXTURE.tenants.beta.id],
        ] as const) {
          if (cookieHeader.includes(`__Secure-authjs.session-token=${email}`)) {
            return new Response(
              JSON.stringify({ user: { email, activeTenantId } }),
              { status: 200 },
            );
          }
        }
        return new Response(JSON.stringify({}), { status: 200 });
      }

      if (url.endsWith("/api/org-units")) {
        if (init?.method === "POST") {
          return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
        }
        if (!cookieHeader.includes("__Secure-authjs.session-token=")) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }
        const orgUnits = cookieHeader.includes(betaAdminEmail.email)
          ? [{ id: "sce-acceptance-org-beta-club" }]
          : [{ id: "sce-acceptance-org-alpha-club" }];
        return new Response(JSON.stringify({ orgUnits }), { status: 200 });
      }

      if (url.includes("/registrations")) {
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
      }

      if (url.includes("/api/people/")) {
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
      }

      if (url.endsWith("/api/admin/users")) {
        if (!cookieHeader.includes("__Secure-authjs.session-token=")) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }
        if (
          cookieHeader.includes(alphaMemberEmail.email) ||
          cookieHeader.includes(betaMemberEmail.email)
        ) {
          return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
        }
        return new Response(JSON.stringify({ users: [] }), { status: 200 });
      }

      if (url.endsWith("/api/tenants")) {
        return new Response(
          JSON.stringify({
            tenants: [
              { key: ACCEPTANCE_FIXTURE.tenants.alpha.key },
              { key: ACCEPTANCE_FIXTURE.tenants.beta.key },
            ],
          }),
          { status: 200 },
        );
      }

      return new Response(JSON.stringify({}), { status: 200 });
    });

    const clients = await initializeSmokeFixtureClients(
      { baseUrl, passwords: passwordsFromFixture() },
      fetchImpl as typeof fetch,
    );

    for (const client of Object.values(clients)) {
      const originalLogin = client.loginWithCredentials.bind(client);
      client.loginWithCredentials = async (email, password) => {
        postInitLoginCalls.push(email);
        return originalLogin(email, password);
      };
    }

    const summary = await runAcceptanceSecuritySmoke(
      { baseUrl, passwords: passwordsFromFixture() },
      {
        scenarios: ACCEPTANCE_SECURITY_SMOKE_SCENARIOS,
        initializeClients: async () => clients,
        log: vi.fn(),
        error: vi.fn(),
      },
    );

    expect(ACCEPTANCE_SECURITY_SMOKE_SCENARIOS).toHaveLength(25);
    expect(summary.failed).toBe(0);
    expect(credentialLogins).toEqual([
      superadminEmail.email,
      alphaAdminEmail.email,
      alphaMemberEmail.email,
      betaAdminEmail.email,
      betaMemberEmail.email,
    ]);
    expect(credentialLogins.filter((email) => email === betaAdminEmail.email)).toHaveLength(1);
    expect(credentialLogins.filter((email) => email === alphaAdminEmail.email)).toHaveLength(1);
    expect(postInitLoginCalls).toEqual([]);
  });
});
