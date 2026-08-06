/**
 * GET /api/publishing/overview
 *
 * Returns a unified publishing cockpit payload:
 *   - Status counts for news and pages (separately and combined)
 *   - Paginated, filterable list of publishable items (news + pages merged)
 *   - Workflow context (approvedDataOnly, permission flags)
 *
 * Query params:
 *   type   ALL | news | page        (default: ALL)
 *   status ALL | DRAFT | IN_REVIEW | SCHEDULED | PUBLISHED | ARCHIVED  (default: ALL)
 *   limit  1–200                    (default: 50)
 *   offset ≥0                       (default: 0)
 *
 * Permission: NEWS_MANAGE OR WEBSITE_MANAGE (at least one required).
 * Tenant isolation: tenantId from session — never from request params.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantContextFromSession } from "@/lib/tenants/context";
import { getPublishingOverview } from "@/lib/publishing/publishing-queries";
import type { FilterContentType, FilterStatus } from "@/lib/publishing/types";

const VALID_TYPES: FilterContentType[] = ["ALL", "news", "page"];
const VALID_STATUSES: FilterStatus[] = [
  "ALL",
  "DRAFT",
  "IN_REVIEW",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
];

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canManageNews = hasPermission(session, PERMISSIONS.NEWS_MANAGE);
  const canManagePages = hasPermission(session, PERMISSIONS.WEBSITE_MANAGE);

  if (!canManageNews && !canManagePages) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const rawType = (searchParams.get("type") ?? "ALL").toUpperCase();
  const typeFilter: FilterContentType = VALID_TYPES.includes(rawType as FilterContentType)
    ? (rawType as FilterContentType)
    : "ALL";

  const rawStatus = (searchParams.get("status") ?? "ALL").toUpperCase();
  const statusFilter: FilterStatus = VALID_STATUSES.includes(rawStatus as FilterStatus)
    ? (rawStatus as FilterStatus)
    : "ALL";

  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "50"), 1), 200);
  const offset = Math.max(Number(searchParams.get("offset") ?? "0"), 0);

  // Resolve tenant for approvedDataOnly flag
  const tenantCtx = await getTenantContextFromSession(tenantId);

  const overview = await getPublishingOverview({
    tenantId,
    typeFilter,
    statusFilter,
    canManageNews,
    canManagePages,
    limit,
    offset,
  });

  return NextResponse.json({
    ...overview,
    context: {
      approvedDataOnly: tenantCtx?.approvedDataOnly ?? false,
      canManageNews,
      canManagePages,
    },
  });
}
