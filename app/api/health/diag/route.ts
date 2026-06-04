/**
 * Temporary diagnostic endpoint — always returns 200 with the same payload
 * as /api/health so the JSON body is readable from tooling that discards
 * non-200 responses.
 *
 * TODO: remove once the STAGE login issue is resolved.
 */
import { NextResponse } from "next/server";
import {
  checkDatabaseHealth,
  evaluateRuntimeConfiguration,
} from "@/lib/server/runtime";
import { getDeploymentMetadata } from "@/lib/server/deployment";

export const dynamic = "force-dynamic";

function getDatabaseHost(): string {
  try {
    const raw = process.env.DATABASE_URL;
    if (!raw) return "not-set";
    const url = new URL(raw);
    return url.hostname;
  } catch {
    return "unparseable";
  }
}

export async function GET(): Promise<NextResponse> {
  const runtime = evaluateRuntimeConfiguration();
  const deployment = getDeploymentMetadata();

  const database = runtime.env.hasDatabaseUrl
    ? await checkDatabaseHealth()
    : { ok: false, message: "DATABASE_URL is not configured." };

  const healthOk = runtime.ok && database.ok;

  return NextResponse.json({
    healthOk,
    deployment,
    environment: {
      appEnv: runtime.env.appEnv,
      nodeEnv: runtime.env.nodeEnv,
      vercelEnv: runtime.env.vercelEnv,
      isLocal: runtime.env.isLocal,
      isStage: runtime.env.isStage,
      isProd: runtime.env.isProd,
    },
    checks: {
      hasDatabaseUrl: runtime.env.hasDatabaseUrl,
      hasDirectUrl: runtime.env.hasDirectUrl,
      hasNextAuthSecret: runtime.env.hasNextAuthSecret,
      hasAppBaseUrl: Boolean(runtime.env.appBaseUrl),
      hasNextAuthUrl: Boolean(runtime.env.nextAuthUrl),
    },
    databaseHost: getDatabaseHost(),
    database,
    warnings: runtime.warnings,
    errors: runtime.errors,
    timestamp: new Date().toISOString(),
  });
}
