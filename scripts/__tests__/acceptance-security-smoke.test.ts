import { describe, expect, it, vi } from "vitest";
import { ACCEPTANCE_FIXTURE } from "@/lib/acceptance/bootstrap";
import { ACCEPTANCE_SECURITY_SMOKE_CONFIRM } from "@/lib/acceptance/security-smoke/env";
import { runAcceptanceSecuritySmoke } from "@/lib/acceptance/security-smoke/runner";

vi.mock("@/lib/acceptance/security-smoke/runner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/acceptance/security-smoke/runner")>();
  return actual;
});

describe("acceptance-security-smoke script safeguards", () => {
  it("refuses to run without APP_ENV=acceptance", async () => {
    const { assertAcceptanceSecuritySmokeEnvironment } = await import(
      "@/lib/acceptance/security-smoke/env"
    );
    expect(() =>
      assertAcceptanceSecuritySmokeEnvironment({
        APP_ENV: "stage",
        ACCEPTANCE_BASE_URL: "https://acceptance.sportclubevo.com",
        ACCEPTANCE_SECURITY_SMOKE_CONFIRM,
        ...Object.fromEntries(
          Object.values(ACCEPTANCE_FIXTURE.users).map((user) => [
            user.passwordEnv,
            "test-password-12345",
          ]),
        ),
      }),
    ).toThrow(/APP_ENV must be set to acceptance/i);
  });

  it("can execute the runner with injected scenarios only", async () => {
    const summary = await runAcceptanceSecuritySmoke(
      {
        baseUrl: "https://acceptance.example.test",
        passwords: Object.fromEntries(
          Object.values(ACCEPTANCE_FIXTURE.users).map((user) => [
            user.passwordEnv,
            "test-password-12345",
          ]),
        ) as ReturnType<
          typeof import("@/lib/acceptance/bootstrap").readAcceptancePasswords
        >,
      },
      {
        scenarios: [
          {
            id: "noop",
            name: "No-op",
            category: "session-auth",
            async run() {
              return "ok";
            },
          },
        ],
        log: vi.fn(),
        error: vi.fn(),
      },
    );
    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(0);
  });
});
