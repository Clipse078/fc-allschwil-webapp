import { NextResponse } from "next/server";
import {
  checkDatabaseHealth,
  evaluateRuntimeConfiguration,
} from "@/lib/server/runtime";
import { getDeploymentMetadata } from "@/lib/server/deployment";

export const dynamic = "force-dynamic";

function toPresence(value: boolean): "present" | "missing" {
  return value ? "present" : "missing";
}

export async function GET(): Promise<NextResponse> {
  const deployment = getDeploymentMetadata();
  const rawHasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const rawHasAuthSecret = Boolean(process.env.AUTH_SECRET?.trim());
  const rawHasNextAuthSecret = Boolean(process.env.NEXTAUTH_SECRET?.trim());
  const rawHasAnyAuthSecret = rawHasAuthSecret || rawHasNextAuthSecret;
  const rawNextAuthUrl = process.env.NEXTAUTH_URL?.trim() || null;

  let appEnv = process.env.APP_ENV?.trim() || "unknown";
  let nodeEnv = process.env.NODE_ENV?.trim() || "missing";
  let vercelEnv = process.env.VERCEL_ENV?.trim() || null;
  let hasDatabaseUrl = rawHasDatabaseUrl;
  let hasAuthSecret = rawHasAuthSecret;
  let hasNextAuthSecret = rawHasNextAuthSecret;
  let hasAnyAuthSecret = rawHasAnyAuthSecret;
  let hasNextAuthUrl = Boolean(rawNextAuthUrl);
  let runtimeWarnings: string[] = [];
  let runtimeErrors: string[] = [];
  let runtimeOk = false;

  try {
    const runtime = evaluateRuntimeConfiguration();
    appEnv = runtime.env.appEnv;
    nodeEnv = runtime.env.nodeEnv;
    vercelEnv = runtime.env.vercelEnv;
    hasDatabaseUrl = runtime.env.hasDatabaseUrl;
    hasAuthSecret = runtime.env.hasAuthSecret;
    hasNextAuthSecret = runtime.env.hasNextAuthSecret;
    hasAnyAuthSecret = runtime.env.hasAnyAuthSecret;
    hasNextAuthUrl = Boolean(runtime.env.nextAuthUrl);
    runtimeWarnings = runtime.warnings;
    runtimeErrors = runtime.errors;
    runtimeOk = runtime.ok;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown runtime configuration error.";
    runtimeErrors = [
      "Runtime configuration evaluation failed.",
      message,
    ];
    runtimeWarnings = [
      "Falling back to raw process.env checks for health diagnostics.",
    ];
  }

  const isPreview = vercelEnv === "preview";
  const previewWarning =
    "Running on Vercel Preview deployment. Use sportclubevo-webapp-stage production deployment as canonical.";

  if (isPreview && !runtimeWarnings.includes(previewWarning)) {
    runtimeWarnings = [...runtimeWarnings, previewWarning];
  }

  const database = hasDatabaseUrl
    ? await checkDatabaseHealth()
    : {
        ok: false,
        message: "DATABASE_URL is not configured.",
      };

  const ok = runtimeOk && database.ok;
  const status = ok ? 200 : 503;

  return NextResponse.json(
    {
      ok,
      app: {
        status: ok ? "ok" : "degraded",
      },
      deployment,
      environment: {
        APP_ENV: appEnv,
        NODE_ENV: nodeEnv,
        VERCEL_ENV: vercelEnv,
      },
      checks: {
        DATABASE_URL: toPresence(hasDatabaseUrl),
        AUTH_SECRET: toPresence(hasAuthSecret),
        NEXTAUTH_SECRET: toPresence(hasNextAuthSecret),
        AUTH_SECRET_OR_NEXTAUTH_SECRET: toPresence(hasAnyAuthSecret),
        NEXTAUTH_URL: toPresence(hasNextAuthUrl),
      },
      database,
      warnings: runtimeWarnings,
      errors: runtimeErrors,
      runtime: {
        evaluated: runtimeErrors.length === 0,
      },
      timestamp: new Date().toISOString(),
    },
    { status },
  );
}
