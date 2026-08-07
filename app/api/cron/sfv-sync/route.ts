/**
 * GET /api/cron/sfv-sync
 *
 * SFV-MATCH-SYNC-HOTFIX-01 — Phase B: automatic SFV synchronization.
 *
 * Vercel Cron entry point. Triggers an automatic, tenant-scoped SFV schedule
 * sync for every tenant with an enabled TenantSfvConfig, reusing the exact
 * same canonical sync service used by the manual admin "Sync now" button
 * (syncSfvSchedule via runAutomaticSfvScheduleSync — no second sync
 * implementation).
 *
 * Scheduling (see vercel.json "crons"): every 15 minutes.
 *
 * Authorization:
 *   - Requires `Authorization: Bearer ${CRON_SECRET}`. Vercel automatically
 *     attaches this header to scheduled invocations of routes configured in
 *     vercel.json's "crons" array when the CRON_SECRET environment variable
 *     is set on the project.
 *   - If CRON_SECRET is not configured server-side, every request is
 *     rejected (fail closed) — this endpoint must never run unauthenticated.
 *   - This route is never linked from, or called by, any public page or
 *     client-side code. No browser ever polls SFV directly or indirectly
 *     through this route. Ordinary public page requests never trigger it.
 *
 * Security invariants:
 *   - SFV credentials remain server-side (read from process.env inside
 *     lib/integrations/sfv/client.ts only) — never accepted from, or
 *     returned to, the caller.
 *   - The response body is the sanitized SfvAutoSyncSummary — no
 *     credentials, tokens, or raw provider payloads.
 *   - Manual admin-triggered sync (POST /api/admin/integrations/sfv/schedule/sync)
 *     is entirely unaffected by this route and continues to work independently.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { runAutomaticSfvScheduleSync } from "@/lib/integrations/sfv/sync/auto-sync";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    // Fail closed: never allow an unauthenticated trigger of this endpoint.
    return false;
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runAutomaticSfvScheduleSync();
    return NextResponse.json({ summary }, { status: 200 });
  } catch (err) {
    // runAutomaticSfvScheduleSync isolates per-tenant failures internally and
    // should not throw. This is a defensive fallback for a genuinely
    // unexpected top-level error (e.g. the tenant listing query itself fails).
    console.error(
      "[cron/sfv-sync] Unexpected error:",
      err instanceof Error ? err.message : "unknown",
    );
    return NextResponse.json(
      { error: "Interner Serverfehler. Bitte erneut versuchen." },
      { status: 500 },
    );
  }
}
