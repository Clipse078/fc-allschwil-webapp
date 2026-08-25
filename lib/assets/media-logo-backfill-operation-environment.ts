/**
 * lib/assets/media-logo-backfill-operation-environment.ts
 *
 * TEMPORARY MEDIA-LOGO-01G10 controlled preview environment helpers.
 * Remove after successful backfill verification before STAGE merge.
 *
 * Narrow exception: allows the MEDIA-LOGO operation on a controlled Vercel
 * Preview deployment without changing global APP_ENV semantics.
 */

import { getRuntimeEnvironment } from "@/lib/env";
import {
  normalizeDatabaseUrl,
  parseDatabaseTarget,
} from "@/lib/test/safe-test-database";

/** Exact Vercel feature branch allowed for controlled Preview access. */
export const MEDIA_LOGO_CONTROLLED_PREVIEW_BRANCH =
  "cursor/media-logo-01-provider-logo-normalization";

/** Known FC Allschwil STAGE Neon cluster host fragment (no credentials). */
const KNOWN_FCA_STAGE_NEON_HOST_FRAGMENT = "ep-wispy-hall-aso93dy6";

function readTrimmedEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
}

/**
 * True when the runtime DATABASE_URL matches the expected STAGE database target.
 * Never logs or returns credentials.
 */
export function isMediaLogoStageDatabaseTarget(databaseUrl?: string): boolean {
  const candidate = (databaseUrl ?? readTrimmedEnv("DATABASE_URL"))?.trim();
  if (!candidate) {
    return false;
  }

  const stageDbUrl = readTrimmedEnv("STAGE_DB_URL");
  if (stageDbUrl && normalizeDatabaseUrl(candidate) === normalizeDatabaseUrl(stageDbUrl)) {
    return true;
  }

  const stageDirectUrl = readTrimmedEnv("STAGE_DIRECT_URL");
  if (
    stageDirectUrl &&
    normalizeDatabaseUrl(candidate) === normalizeDatabaseUrl(stageDirectUrl)
  ) {
    return true;
  }

  try {
    const target = parseDatabaseTarget(candidate);
    return target.hostname.includes(KNOWN_FCA_STAGE_NEON_HOST_FRAGMENT);
  } catch {
    return false;
  }
}

/**
 * True only for the controlled MEDIA-LOGO Preview deployment:
 * Vercel runtime + preview + exact feature branch + STAGE database target.
 */
export function isMediaLogoControlledPreviewEnvironment(): boolean {
  const runtime = getRuntimeEnvironment();

  if (!runtime.isVercel || runtime.vercelEnv !== "preview") {
    return false;
  }

  if (readTrimmedEnv("VERCEL_GIT_COMMIT_REF") !== MEDIA_LOGO_CONTROLLED_PREVIEW_BRANCH) {
    return false;
  }

  return isMediaLogoStageDatabaseTarget();
}

/**
 * Auth/runtime gate for MEDIA-LOGO operation surfaces.
 * Normal STAGE path OR controlled Preview exception — fail closed otherwise.
 */
export function isMediaLogoBackfillAuthEnvironmentAllowed(): boolean {
  const runtime = getRuntimeEnvironment();

  if (runtime.appEnv === "stage") {
    return true;
  }

  return isMediaLogoControlledPreviewEnvironment();
}

/**
 * True when the runtime is connected to the STAGE database for MEDIA-LOGO purposes.
 * Includes the controlled Preview exception without broadening global isStage.
 */
export function isMediaLogoBackfillStageDatabase(): boolean {
  const runtime = getRuntimeEnvironment();

  if (runtime.isStage) {
    return true;
  }

  return isMediaLogoControlledPreviewEnvironment();
}
