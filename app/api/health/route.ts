import { NextResponse } from "next/server";
import {
  checkDatabaseHealth,
  evaluateRuntimeConfiguration,
} from "@/lib/server/runtime";
import { getDeploymentMetadata } from "@/lib/server/deployment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/health
 *
 * First-line debug endpoint. MUST be safe to call even when DATABASE_URL,
 * AUTH_SECRET/NEXTAUTH_SECRET, or NEXTAUTH_URL are missing. Never throws,
 * never exposes secret values.
 *
 * Canonical deployment is sportclubevo-webapp-stage (Production Branch =
 * STAGE). Preview deployments are disposable and may be missing env vars;
 * this endpoint flags that explicitly.
 */
export async function GET(): Promise<NextResponse> {
  const runtime = evaluateRuntimeConfiguration();
  const deployment = getDeploymentMetadata();

  const database = runtime.env.hasDatabaseUrl
    ? await checkDatabaseHealth()
    : {
        ok: false,
        message:
          "DATABASE_URL is not configured. " +
          "Enable it for Production, Preview, and Development in Vercel " +
          "(Project: sportclubevo-webapp-stage → Settings → Environment Variables).",
      };

  const ok = runtime.ok && database.ok;
  const status = ok ? 200 : 503;

  const previewWarning = deployment.isVercelPreview
    ? "This response was served by a Vercel Preview deployment. " +
      "Preview deployments are NOT operational truth and may be missing " +
      "DATABASE_URL or AUTH_SECRET. The canonical environment is " +
      "sportclubevo-webapp-stage (Production Branch = STAGE)."
    : null;

  return NextResponse.json(
    {
      ok,
      status: ok ? "healthy" : "degraded",
      app: {
        name: "sportclubevo-webapp",
        canonicalDeployment: "sportclubevo-webapp-stage",
        canonicalBranch: "STAGE",
      },
      environment: {
        APP_ENV: runtime.env.appEnv,
        NODE_ENV: runtime.env.nodeEnv,
        VERCEL_ENV: runtime.env.vercelEnv,
        isLocal: runtime.env.isLocal,
        isStage: runtime.env.isStage,
        isProd: runtime.env.isProd,
        isVercel: runtime.env.isVercel,
        isVercelPreview: runtime.env.isVercelPreview,
      },
      // Boolean presence checks only — values are never exposed.
      checks: {
        DATABASE_URL: runtime.env.hasDatabaseUrl,
        DIRECT_URL: runtime.env.hasDirectUrl,
        AUTH_SECRET: runtime.env.hasAuthSecret,
        NEXTAUTH_SECRET: runtime.env.hasNextAuthSecret,
        AUTH_OR_NEXTAUTH_SECRET: runtime.env.hasAuthOrNextAuthSecret,
        NEXTAUTH_URL: Boolean(runtime.env.nextAuthUrl),
        APP_BASE_URL: Boolean(runtime.env.appBaseUrl),
      },
      // Echo the URLs (they are not secret) so it is obvious if e.g.
      // NEXTAUTH_URL still points at localhost.
      urls: {
        appBaseUrl: runtime.env.appBaseUrl,
        nextAuthUrl: runtime.env.nextAuthUrl,
      },
      deployment: {
        environment: deployment.environment,
        vercelEnv: deployment.vercelEnv,
        isVercelPreview: deployment.isVercelPreview,
        branch: deployment.commitRef,
        commitSha: deployment.commitSha,
        commitShortSha: deployment.commitShortSha,
        commitMessage: deployment.commitMessage,
        deploymentId: deployment.deploymentId,
        vercelUrl: deployment.vercelUrl,
        region: deployment.region,
      },
      database,
      previewWarning,
      warnings: runtime.warnings,
      errors: runtime.errors,
      timestamp: new Date().toISOString(),
    },
    { status },
  );
}
