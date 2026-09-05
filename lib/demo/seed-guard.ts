/**
 * lib/demo/seed-guard.ts
 *
 * Guards demo/sample seed scripts from running against persistent STAGE or
 * production databases without explicit operator opt-in.
 *
 * Mirrors the ALLOW_PASSWORD_CHANGE pattern used by prisma/bootstrap-admin.ts.
 */

import { getRuntimeEnvironment } from "@/lib/env";

export type DemoSeedGuardResult =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Returns whether a demo seed script may run in the current environment.
 *
 * Local APP_ENV on a non-deployed machine: allowed (developer workstations).
 * STAGE / PROD: blocked unless ALLOW_DEMO_SEED=true is set explicitly.
 * Preview and unknown deployed environments: always blocked.
 */
export function evaluateDemoSeedGuard(env: NodeJS.ProcessEnv = process.env): DemoSeedGuardResult {
  const runtime = getRuntimeEnvironment({
    ...env,
    NODE_ENV: env.NODE_ENV ?? "development",
  });

  if ((runtime.isLocal || runtime.isTest) && !runtime.isDeployed) {
    return { allowed: true };
  }

  if (runtime.isPreview || runtime.isUnknown) {
    return {
      allowed: false,
      reason:
        `Demo seed is blocked for environment=${runtime.appEnv}. ` +
        "Preview and unclassified deployed runtimes never permit seeding.",
    };
  }

  if (env.ALLOW_DEMO_SEED === "true") {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason:
      `Demo seed is blocked for APP_ENV=${runtime.appEnv}. ` +
      "Persistent environments must not silently repopulate demo teams, registrations, or events. " +
      "To run intentionally, set ALLOW_DEMO_SEED=true.",
  };
}

/**
 * Exits the process when demo seed is not permitted. No-op when allowed.
 */
export function assertDemoSeedAllowed(env: NodeJS.ProcessEnv = process.env): void {
  const result = evaluateDemoSeedGuard(env);
  if (!result.allowed) {
    console.error(`[seed-demo] BLOCKED: ${result.reason}`);
    process.exit(1);
  }
}
