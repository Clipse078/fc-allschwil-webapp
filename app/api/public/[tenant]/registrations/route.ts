/**
 * POST /api/public/[tenant]/registrations
 *
 * Public website registration intake endpoint.
 * Accepts form submissions from the FC Allschwil website and creates
 * Registration records in the existing WebApp Registration Inbox.
 *
 * ── Security ──────────────────────────────────────────────────────────────
 *   - No authentication required (public endpoint).
 *   - Honeypot field (_hp) silently discards bot submissions.
 *   - Idempotency key prevents double-submits.
 *   - Basic in-memory rate limiting per IP address.
 *   - Soft duplicate detection (marks, never blocks).
 *   - Tenant isolation: each record is scoped to the path-resolved tenant.
 *
 * ── Response ──────────────────────────────────────────────────────────────
 *   200 OK → { ok: true, registrationId, status: "NEW", message }
 *   400     → { ok: false, error }
 *   404     → { ok: false, error } (unknown tenant)
 *   422     → { ok: false, error, errors: [{field, message}] }
 *   429     → { ok: false, error } (rate limited)
 *   500     → { ok: false, error } (safe, no internals exposed)
 *
 * ── Existing workflow integration ─────────────────────────────────────────
 *   Created registrations enter status NEW and appear in the existing
 *   Registration Inbox at /tenant/{slug}/cockpit/registrations.
 *   The standard NEW → REVIEWING → ACCEPTED / REJECTED workflow applies.
 *   No separate inbox or workflow is created.
 */

import { type NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  resolveTenantFromParams,
  assertWebsiteEnabled,
} from "@/lib/website/response-helpers";
import {
  validatePublicPayload,
  createPublicRegistration,
} from "@/lib/registrations/public-submission";

type RouteParams = { params: Promise<{ tenant: string }> };

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter
// ---------------------------------------------------------------------------

const IP_RATE_MAP = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 5; // max 5 submissions per IP per minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = IP_RATE_MAP.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    IP_RATE_MAP.set(ip, { count: 1, windowStart: now });
    return true; // allowed
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false; // blocked
  }

  entry.count += 1;
  return true; // allowed
}

// ---------------------------------------------------------------------------
// Idempotency cache (in-memory, good enough for single-instance / Edge)
// ---------------------------------------------------------------------------

const IDEMPOTENCY_CACHE = new Map<string, string>(); // key → registrationId
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const IDEMPOTENCY_TS_MAP = new Map<string, number>(); // key → timestamp

function getIdempotencyResult(key: string): string | null {
  const ts = IDEMPOTENCY_TS_MAP.get(key);
  if (!ts) return null;
  if (Date.now() - ts > IDEMPOTENCY_TTL_MS) {
    IDEMPOTENCY_CACHE.delete(key);
    IDEMPOTENCY_TS_MAP.delete(key);
    return null;
  }
  return IDEMPOTENCY_CACHE.get(key) ?? null;
}

function setIdempotencyResult(key: string, registrationId: string): void {
  IDEMPOTENCY_CACHE.set(key, registrationId);
  IDEMPOTENCY_TS_MAP.set(key, Date.now());
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { tenant: tenantSlug } = await params;

    // ── 1. Resolve tenant ────────────────────────────────────────────────
    const tenant = await resolveTenantFromParams(tenantSlug);
    if (!tenant) {
      return NextResponse.json(
        { ok: false, error: "Tenant nicht gefunden." },
        { status: 404 },
      );
    }

    const guard = assertWebsiteEnabled(tenant);
    if (guard) return guard;

    // ── 2. Rate limiting ─────────────────────────────────────────────────
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.",
        },
        {
          status: 429,
          headers: { "Retry-After": "60" },
        },
      );
    }

    // ── 3. Parse body ────────────────────────────────────────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Ungültiges JSON-Format." },
        { status: 400 },
      );
    }

    // ── 4. Honeypot check ────────────────────────────────────────────────
    // If the honeypot field is non-empty, silently return success without
    // creating any record. Bots are not told they were caught.
    if (
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      typeof (body as Record<string, unknown>)._hp === "string" &&
      (body as Record<string, unknown>)._hp !== ""
    ) {
      return NextResponse.json({
        ok: true,
        registrationId: "honeypot",
        status: "NEW",
        message: "Vielen Dank. Deine Anmeldung wurde erfolgreich übermittelt.",
      });
    }

    // ── 5. Idempotency check ─────────────────────────────────────────────
    const rawBody = body as Record<string, unknown>;
    const idempotencyKey =
      typeof rawBody.idempotencyKey === "string" && rawBody.idempotencyKey.trim()
        ? `${tenant.id}:${rawBody.idempotencyKey.trim()}`
        : null;

    if (idempotencyKey) {
      const cached = getIdempotencyResult(idempotencyKey);
      if (cached) {
        return NextResponse.json({
          ok: true,
          registrationId: cached,
          status: "NEW",
          message: "Vielen Dank. Deine Anmeldung wurde erfolgreich übermittelt.",
        });
      }
    }

    // ── 6. Validate payload ──────────────────────────────────────────────
    const validation = validatePublicPayload(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          ok: false,
          error: "Validierungsfehler. Bitte prüfe deine Eingaben.",
          errors: validation.errors,
        },
        { status: 422 },
      );
    }

    // ── 7. Create registration ───────────────────────────────────────────
    const result = await createPublicRegistration(
      tenant.id,
      tenant.key,
      validation.data,
    );

    // Store idempotency result
    if (idempotencyKey) {
      setIdempotencyResult(idempotencyKey, result.registrationId);
    }

    // Revalidate the admin inbox so it shows the new submission immediately
    revalidatePath(`/tenant/${tenantSlug}/cockpit/registrations`);

    // ── 8. Return safe public response ───────────────────────────────────
    return NextResponse.json({
      ok: true,
      registrationId: result.registrationId,
      status: result.status,
      message: "Vielen Dank. Deine Anmeldung wurde erfolgreich übermittelt.",
    });
  } catch (error) {
    console.error("[public/[tenant]/registrations] POST failed:", error);

    // Never expose internal error details to the public
    return NextResponse.json(
      {
        ok: false,
        error:
          "Deine Anmeldung konnte leider nicht übermittelt werden. Bitte versuche es erneut oder kontaktiere uns direkt.",
      },
      { status: 500 },
    );
  }
}

// Explicitly opt out of caching for this POST-only route
export const dynamic = "force-dynamic";

// Allow CORS for public website usage
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
