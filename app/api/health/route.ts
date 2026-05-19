import { NextResponse } from "next/server";
import {
  checkDatabaseHealth,
  evaluateRuntimeConfiguration,
} from "@/lib/server/runtime";
import { getDeploymentMetadata } from "@/lib/server/deployment";

export const dynamic = "force-dynamic";

function getPresenceLabel(isPresent: boolean): "present" | "missing" {
  return isPresent ? "present" : "missing";
}

export async function GET(): Promise<NextResponse> {
  const runtime = evaluateRuntimeConfiguration();
  const deployment = getDeploymentMetadata();

  const database = runtime.env.hasDatabaseUrl
    ? await checkDatabaseHealth()
    : {
        ok: false,
        message:
          "DATABASE_URL is not configured. Health can still render, but database-backed operations will fail until the variable is set.",
      };

  const ok = runtime.ok && database.ok;
  const status = ok ? 200 : 503;
  const appStatus = ok ? "healthy" : "degraded";
  const databaseStatus = database.ok ? "healthy" : "unavailable";

  return NextResponse.json(
    {
      ok,
      status: appStatus,
      app: {
        status: appStatus,
        name: "SportClubEvo WebApp",
      },
      deployment,
      environment: {
        appEnv: runtime.env.appEnv,
        rawAppEnv: runtime.env.rawAppEnv,
        nodeEnv: runtime.env.nodeEnv,
        vercelEnv: runtime.env.vercelEnv,
        isLocal: runtime.env.isLocal,
        isStage: runtime.env.isStage,
        isProd: runtime.env.isProd,
        isPreview: deployment.isPreview,
      },
      checks: {
        databaseUrl: getPresenceLabel(runtime.env.hasDatabaseUrl),
        directUrl: getPresenceLabel(runtime.env.hasDirectUrl),
        authSecret: getPresenceLabel(runtime.env.hasAuthSecret),
        nextAuthSecret: getPresenceLabel(runtime.env.hasNextAuthSecret),
        authSecretEffective: getPresenceLabel(runtime.env.hasAnyAuthSecret),
        appBaseUrl: getPresenceLabel(Boolean(runtime.env.appBaseUrl)),
        nextAuthUrl: getPresenceLabel(Boolean(runtime.env.nextAuthUrl)),
      },
      database: {
        ...database,
        status: databaseStatus,
        configured: getPresenceLabel(runtime.env.hasDatabaseUrl),
      },
      warnings: runtime.warnings,
      errors: runtime.errors,
      timestamp: new Date().toISOString(),
    },
    { status },
  );
}
