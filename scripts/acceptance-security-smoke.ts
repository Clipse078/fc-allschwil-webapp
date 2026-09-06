import "dotenv/config";

import { assertAcceptanceSecuritySmokeEnvironment } from "@/lib/acceptance/security-smoke/env";
import { redactSmokeSecrets } from "@/lib/acceptance/security-smoke/redact";
import {
  printAcceptanceSecuritySmokeSummary,
  runAcceptanceSecuritySmoke,
} from "@/lib/acceptance/security-smoke/runner";

async function main(): Promise<void> {
  const config = assertAcceptanceSecuritySmokeEnvironment(process.env);
  const summary = await runAcceptanceSecuritySmoke(config, {
    log: (message) => console.log(redactSmokeSecrets(message)),
    error: (message) => console.error(redactSmokeSecrets(message)),
  });
  printAcceptanceSecuritySmokeSummary(summary);
  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    "[acceptance:security-smoke] FAILED:",
    redactSmokeSecrets(
      error instanceof Error ? error.message : "Unknown Acceptance security smoke error.",
    ),
  );
  process.exitCode = 1;
});
