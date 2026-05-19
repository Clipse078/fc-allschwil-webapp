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
  const isPreview = runtime.env.vercelEnv === "preview";

  const database = runtime.env.hasDatabaseUrl
    ? await checkDatabaseHealth()
    : {
        ok: false,
        message: "DATABASE_URL is not configured.",
      };

  const ok = runtime.ok && database.ok;
  const status = ok ? 200 : 503;
  const appStatus = ok ? "healthy" : "degraded";

  return NextResponse.json(
    {
      ok,
      app: {
        name: "sportclubevo-webapp",
        status: appStatus,
      },
      deployment,
      environment: {
        APP_ENV: runtime.env.appEnv,
        NODE_ENV: runtime.env.nodeEnv,
        VERCEL_ENV: runtime.env.vercelEnv,
        isLocalRuntime: runtime.env.isLocal,
        isStageRuntime: runtime.env.isStage,
        isProdRuntime: runtime.env.isProd,
      },
      checks: {
        databaseUrl: runtime.env.hasDatabaseUrl ? "present" : "missing",
        directUrl: runtime.env.hasDirectUrl ? "present" : "missing",
        authSecret: runtime.env.hasAuthSecret ? "present" : "missing",
        nextAuthSecret: runtime.env.hasNextAuthSecret ? "present" : "missing",
        authSecretEffective: runtime.env.hasAnyAuthSecret ? "present" : "missing",
        appBaseUrl: runtime.env.appBaseUrl ? "present" : "missing",
        nextAuthUrl: runtime.env.nextAuthUrl ? "present" : "missing",
      },
      canonical: {
        isPreview,
        warning: isPreview
          ? "Preview deployment detected. Use the STAGE production deployment as canonical truth."
          : null,
      },
      database,
      warnings: runtime.warnings,
      errors: runtime.errors,
      timestamp: new Date().toISOString(),
    },
    { status },
  );
}
