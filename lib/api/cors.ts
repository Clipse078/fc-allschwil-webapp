/**
 * lib/api/cors.ts
 *
 * CORS helpers for public API routes consumed by the FC Allschwil website.
 *
 * Allowed origins cover STAGE and PROD website deployments.
 * Requests from localhost (dev) and the webapp itself are also allowed.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** All origins authorised to call the public API. */
const ALLOWED_ORIGINS = new Set([
  "https://www.fcallschwil.ch",
  "https://stage.fcallschwil.ch",
  "https://fcallschwil.ch",
  // Local dev convenience
  "http://localhost:3000",
  "http://localhost:3001",
]);

/**
 * Returns the CORS header value for a given request origin.
 * Returns "*" only for fully public endpoints (no credentials).
 */
function resolveOrigin(request: NextRequest): string {
  const origin = request.headers.get("origin") ?? "";
  return ALLOWED_ORIGINS.has(origin) ? origin : "";
}

/**
 * Adds CORS response headers to an existing NextResponse.
 * Use for GET responses on public API routes.
 */
export function addCorsHeaders(
  response: NextResponse,
  request: NextRequest,
): NextResponse {
  const origin = resolveOrigin(request);
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  }
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Tenant-Slug",
  );
  return response;
}

/**
 * Handles an OPTIONS preflight request for public API routes.
 * Place before the main GET handler in routes that accept cross-origin calls.
 */
export function handleCorsPreflightPublic(request: NextRequest): NextResponse | null {
  if (request.method !== "OPTIONS") return null;
  const origin = resolveOrigin(request);
  const res = new NextResponse(null, { status: 204 });
  if (origin) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Vary", "Origin");
  }
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, X-Tenant-Slug");
  res.headers.set("Access-Control-Max-Age", "86400");
  return res;
}
