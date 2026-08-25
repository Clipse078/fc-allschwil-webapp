/**
 * POST /api/ops/media-logo-backfill/execute
 *
 * TEMPORARY MEDIA-LOGO-01G4 operational route.
 * Remove after successful backfill verification before STAGE merge.
 *
 * Phase B — execute. Requires exact confirmation phrase and recomputes the
 * frozen contract immediately before any mutation. Never trusts browser counts
 * or fingerprint values.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  requireMediaLogoBackfillApiAccess,
} from "@/lib/assets/media-logo-backfill-operation-auth";
import {
  runMediaLogoBackfillExecute,
  sanitizeMediaLogoOperationPayload,
} from "@/lib/assets/media-logo-backfill-operation";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

type ExecuteRequestBody = {
  confirmationPhrase?: unknown;
  /** Ignored — contract is recomputed server-side. */
  expectedEligible?: unknown;
  expectedFingerprint?: unknown;
};

async function parseRequestBody(request: NextRequest): Promise<ExecuteRequestBody | null> {
  try {
    const json = await request.json();
    if (typeof json !== "object" || json === null || Array.isArray(json)) {
      return null;
    }
    return json as ExecuteRequestBody;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const access = await requireMediaLogoBackfillApiAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await parseRequestBody(request);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  try {
    const result = await runMediaLogoBackfillExecute({
      prisma,
      confirmationPhrase:
        typeof body.confirmationPhrase === "string" ? body.confirmationPhrase : null,
    });

    const status =
      result.status === "BLOCKED" && result.gateReason === "missing_or_invalid_confirmation"
        ? 400
        : result.status === "BLOCKED"
          ? 409
          : 200;

    return NextResponse.json(sanitizeMediaLogoOperationPayload(result), { status });
  } catch (error) {
    console.error(
      "[ops/media-logo-backfill/execute] Unexpected error:",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "Interner Serverfehler. Bitte erneut versuchen." },
      { status: 500 },
    );
  }
}
