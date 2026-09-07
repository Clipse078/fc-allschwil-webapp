import { initializeSmokeFixtureClients } from "@/lib/acceptance/security-smoke/http-client";
import { redactSmokeSecrets } from "@/lib/acceptance/security-smoke/redact";
import {
  ACCEPTANCE_SECURITY_SMOKE_SCENARIOS,
  SUPER_ADMIN_PLATFORM_NOTES,
} from "@/lib/acceptance/security-smoke/scenarios";
import type {
  AcceptanceSecuritySmokeConfig,
  SmokeFixtureClients,
  SmokeRunSummary,
  SmokeScenario,
  SmokeScenarioResult,
} from "@/lib/acceptance/security-smoke/types";

type FetchLike = typeof fetch;

export type AcceptanceSecuritySmokeRunnerDependencies = {
  fetchImpl?: FetchLike;
  scenarios?: SmokeScenario[];
  initializeClients?: (
    config: AcceptanceSecuritySmokeConfig,
  ) => Promise<SmokeFixtureClients>;
  log: (message: string) => void;
  error: (message: string) => void;
};

function formatScenarioLine(result: SmokeScenarioResult): string {
  const status = result.passed ? "PASS" : "FAIL";
  return `[${status}] ${result.id} — ${result.detail}`;
}

export async function runAcceptanceSecuritySmoke(
  config: AcceptanceSecuritySmokeConfig,
  deps: AcceptanceSecuritySmokeRunnerDependencies,
): Promise<SmokeRunSummary> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const clients =
    (await deps.initializeClients?.(config)) ??
    (await initializeSmokeFixtureClients(config, fetchImpl));
  const scenarios = deps.scenarios ?? ACCEPTANCE_SECURITY_SMOKE_SCENARIOS;
  const results: SmokeScenarioResult[] = [];

  deps.log(`Acceptance security smoke starting against ${config.baseUrl}`);

  for (const scenario of scenarios) {
    try {
      const detail = await scenario.run({ clients, config });
      const result: SmokeScenarioResult = {
        id: scenario.id,
        name: scenario.name,
        category: scenario.category,
        passed: true,
        detail,
      };
      results.push(result);
      deps.log(formatScenarioLine(result));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown scenario failure.";
      const result: SmokeScenarioResult = {
        id: scenario.id,
        name: scenario.name,
        category: scenario.category,
        passed: false,
        detail: redactSmokeSecrets(message),
      };
      results.push(result);
      deps.error(formatScenarioLine(result));
    }
  }

  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;

  deps.log("");
  deps.log(`Summary: ${passed} passed, ${failed} failed, ${results.length} total`);
  deps.log("");
  deps.log("Super Admin platform authorization notes:");
  for (const note of SUPER_ADMIN_PLATFORM_NOTES) {
    deps.log(`- ${note}`);
  }

  return {
    baseUrl: config.baseUrl,
    passed,
    failed,
    total: results.length,
    results,
    platformNotes: [...SUPER_ADMIN_PLATFORM_NOTES],
  };
}

export function printAcceptanceSecuritySmokeSummary(
  summary: SmokeRunSummary,
  log: (message: string) => void = console.log,
): void {
  log("");
  log("Acceptance security smoke results");
  log(`baseUrl: ${summary.baseUrl}`);
  for (const result of summary.results) {
    log(formatScenarioLine(result));
  }
  log("");
  log(`Summary: ${summary.passed} passed, ${summary.failed} failed, ${summary.total} total`);
}
