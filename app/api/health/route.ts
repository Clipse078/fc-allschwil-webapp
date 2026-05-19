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
      deployment: {
        environment: deployment.environment,
        vercelEnv: deployment.vercelEnv,
        isPreview: deployment.isPreview,
        branch: deployment.branch,
        commitSha: deployment.commitSha,
        deploymentId: deployment.deploymentId,
        deploymentUrl: deployment.deploymentUrl,
        buildTime: deployment.buildTime,
      },
      environment: {
        appEnv: runtime.env.appEnv,
        nodeEnv: runtime.env.nodeEnv,
        vercelEnv: runtime.env.vercelEnv,
        isLocal: runtime.env.isLocal,
        isStage: runtime.env.isStage,
        isProd: runtime.env.isProd,
        isPreviewDeployment: runtime.env.isPreviewDeployment,
      },
      checks: {
        hasDatabaseUrl: runtime.env.hasDatabaseUrl,
        hasDirectUrl: runtime.env.hasDirectUrl,
        /** AUTH_SECRET (Auth.js v5 preferred) present */
        hasAuthSecret: runtime.env.hasAuthSecret,
        /** AUTH_SECRET or NEXTAUTH_SECRET present */
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
