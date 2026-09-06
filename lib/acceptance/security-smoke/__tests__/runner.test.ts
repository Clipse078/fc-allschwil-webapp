import { describe, expect, it, vi } from "vitest";
import { ACCEPTANCE_FIXTURE } from "@/lib/acceptance/bootstrap";
import { runAcceptanceSecuritySmoke } from "@/lib/acceptance/security-smoke/runner";
import type {
  AcceptanceSecuritySmokeConfig,
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

function createMockClient(handlers: {
  login?: (email: string) => void;
  routes: Record<string, (method: "GET" | "POST") => SmokeHttpResponse>;
  sessionByEmail?: Record<string, Record<string, unknown>>;
}): SmokeHttpClient {
  let currentEmail: string | null = null;

  return {
    clearCookies() {
      currentEmail = null;
    },
    async loginWithCredentials(email: string) {
      handlers.login?.(email);
      currentEmail = email;
    },
    async getSession() {
      if (!currentEmail) return null;
      const user = handlers.sessionByEmail?.[currentEmail];
      return user ? { user } : null;
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

function passwordsFromFixture(): AcceptanceSecuritySmokeConfig["passwords"] {
  return Object.fromEntries(
    Object.values(ACCEPTANCE_FIXTURE.users).map((user) => [
      user.passwordEnv,
      `test-${user.passwordEnv}`,
    ]),
  ) as AcceptanceSecuritySmokeConfig["passwords"];
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
        log: (message) => logs.push(message),
        error: (message) => logs.push(message),
      },
    );

    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.results[1]?.detail).not.toContain("secret-token");
    expect(logs.join("\n")).not.toContain("secret-token");
  });

  it("executes representative tenant and role isolation checks via the mock client", async () => {
    const alphaAdminEmail = ACCEPTANCE_FIXTURE.users.alphaAdmin.email;
    const betaSlug = ACCEPTANCE_FIXTURE.tenants.beta.key;
    const client = createMockClient({
      sessionByEmail: {
        [alphaAdminEmail]: {
          email: alphaAdminEmail,
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
        async run({ client: smokeClient }) {
          await smokeClient.loginWithCredentials(alphaAdminEmail, "ignored");
          const orgUnits = await smokeClient.get("/api/org-units");
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
        async run({ client: smokeClient }) {
          await smokeClient.loginWithCredentials(alphaAdminEmail, "ignored");
          const denied = await smokeClient.get(
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
        createClient: () => client,
        log: vi.fn(),
        error: vi.fn(),
      },
    );

    expect(summary.failed).toBe(0);
    expect(summary.passed).toBe(2);
  });
});
