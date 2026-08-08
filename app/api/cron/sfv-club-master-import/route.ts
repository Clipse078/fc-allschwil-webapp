/**
 * GET /api/cron/sfv-club-master-import
 *
 * CLUB-DIRECTORY-05-C1 — automatic SFV club master import.
 *
 * Vercel Cron entry point. Triggers an automatic, tenant-scoped SFV club
 * master import for every tenant with an enabled TenantSfvConfig, reusing
 * the exact same canonical import service previously exposed by the manual
 * admin "SFV-Vereinsverzeichnis synchronisieren" button
 * (runSfvClubMasterImport via runAutomaticSfvClubMasterImport — no second
 * import implementation).
 *
 * Product decision: tenant admins must never trigger this manually — see
 * CLUB-DIRECTORY-05-C1. This cron route is now the only way the import
 * runs. It intentionally runs on its own once-daily schedule, entirely
 * independent of the SFV match/schedule sync cron
 * (app/api/cron/sfv-sync/route.ts) — never coupled to, or invoked from,
 * that route or its orchestrator.
 *
 * Scheduling (see vercel.json "crons"): once daily, Hobby-plan compatible
 * (Vercel Hobby only permits daily-or-coarser cron). Scheduled a few hours
 * after the match/schedule sync cron purely to spread provider load —
 * the two crons do not depend on each other and either may run, succeed,
 * or fail independently of the other.
 *
 * Authorization:
 *   - Requires `Authorization: Bearer ${CRON_SECRET}` — identical pattern
 *     to app/api/cron/sfv-sync/route.ts. Vercel automatically attaches this
 *     header to scheduled invocations of routes configured in vercel.json's
 *     "crons" array when the CRON_SECRET environment variable is set on the
 *     project.
 *   - If CRON_SECRET is not configured server-side, every request is
 *     rejected (fail closed) — this endpoint must never run unauthenticated.
 *   - This route is never linked from, or called by, any public page or
 *     client-side code, and is not reachable from the admin UI.
 *
 * Security invariants:
 *   - SFV credentials remain server-side — never accepted from, or
 *     returned to, the caller.
 *   - The response body is the sanitized SfvAutoClubMasterImportSummary —
 *     no credentials, tokens, or raw provider payloads.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { runAutomaticSfvClubMasterImport } from "@/lib/integrations/sfv/sync/auto-club-master-import";

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
    const summary = await runAutomaticSfvClubMasterImport();
    return NextResponse.json({ summary }, { status: 200 });
  } catch (err) {
    // runAutomaticSfvClubMasterImport isolates per-tenant failures internally
    // and should not throw. This is a defensive fallback for a genuinely
    // unexpected top-level error (e.g. the tenant listing query itself fails).
    console.error(
      "[cron/sfv-club-master-import] Unexpected error:",
      err instanceof Error ? err.message : "unknown",
    );
    return NextResponse.json(
      { error: "Interner Serverfehler. Bitte erneut versuchen." },
      { status: 500 },
    );
  }
}
