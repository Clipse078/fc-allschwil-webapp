import { NextResponse } from "next/server";
import {
  checkDatabaseHealth,
  evaluateRuntimeConfiguration,
} from "@/lib/server/runtime";
import { getDeploymentMetadata } from "@/lib/server/deployment";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const runtime = evaluateRuntimeConfiguration();
  const deployment = getDeploymentMetadata();

  const database = runtime.env.hasDatabaseUrl
    ? await checkDatabaseHealth()
    : {
        ok: false,
        message: "DATABASE_URL is not configured.",
      };

  const ok = runtime.ok && database.ok;
  const status = ok ? 200 : 503;

  return NextResponse.json(
    {
      ok,
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
      database,
      warnings: runtime.warnings,
      errors: runtime.errors,
      timestamp: new Date().toISOString(),
    },
    { status },
  );
}
