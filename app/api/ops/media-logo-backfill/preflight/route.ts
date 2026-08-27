/**
 * GET /api/ops/media-logo-backfill/preflight
 *
 * TEMPORARY MEDIA-LOGO-01G4 operational route.
 * Remove after successful backfill verification before STAGE merge.
 *
 * Phase A — read-only preflight. Recomputes plan, quality, fingerprint,
 * collisions, FC Allschwil protection, and Blob capability server-side.
 */

import { NextResponse } from "next/server";

import {
  requireMediaLogoBackfillApiAccess,
} from "@/lib/assets/media-logo-backfill-operation-auth";
import {
  runMediaLogoBackfillPreflight,
  sanitizeMediaLogoOperationPayload,
} from "@/lib/assets/media-logo-backfill-operation";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const access = await requireMediaLogoBackfillApiAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const preflight = await runMediaLogoBackfillPreflight(prisma);
    return NextResponse.json(sanitizeMediaLogoOperationPayload(preflight), { status: 200 });
  } catch (error) {
    console.error(
      "[ops/media-logo-backfill/preflight] Unexpected error:",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "Interner Serverfehler. Bitte erneut versuchen." },
      { status: 500 },
    );
  }
}
