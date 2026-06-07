/**
 * GET  /api/homepage-blocks  — list all homepage blocks (admin, all statuses).
 * POST /api/homepage-blocks  — create a new draft block.
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session — never from request body.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  listHomepageBlocksAdmin,
  createHomepageBlock,
  type BlockStatus,
  type BlockType,
} from "@/lib/homepage-blocks/admin-queries";

const VALID_STATUSES: BlockStatus[] = [
  "DRAFT",
  "IN_REVIEW",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
];

// ── GET /api/homepage-blocks ──────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawStatus = searchParams.get("status")?.toUpperCase();
  const status = VALID_STATUSES.includes(rawStatus as BlockStatus)
    ? (rawStatus as BlockStatus)
    : undefined;

  const blocks = await listHomepageBlocksAdmin({ tenantId, status });

  return NextResponse.json({ blocks });
}

// ── POST /api/homepage-blocks ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Titel ist erforderlich." }, { status: 400 });
  }

  const type: BlockType = "HERO";

  const rawData = (body.data ?? {}) as Record<string, unknown>;
  const data = {
    headline: typeof rawData.headline === "string" ? rawData.headline : "",
    subheadline: typeof rawData.subheadline === "string" ? rawData.subheadline : "",
    ctaLabel: typeof rawData.ctaLabel === "string" ? rawData.ctaLabel : "",
    ctaUrl: typeof rawData.ctaUrl === "string" ? rawData.ctaUrl : "",
  };

  const block = await createHomepageBlock({
    tenantId,
    type,
    title,
    data,
    heroMediaId: typeof body.heroMediaId === "string" ? body.heroMediaId : null,
    overlayColor: typeof body.overlayColor === "string" ? body.overlayColor || null : null,
    overlayOpacity:
      typeof body.overlayOpacity === "number"
        ? Math.min(100, Math.max(0, Math.round(body.overlayOpacity)))
        : null,
    gradientType: typeof body.gradientType === "string" ? body.gradientType || null : null,
    gradientFrom: typeof body.gradientFrom === "string" ? body.gradientFrom || null : null,
    gradientTo: typeof body.gradientTo === "string" ? body.gradientTo || null : null,
    textColor: typeof body.textColor === "string" ? body.textColor || null : null,
    scheduledAt: typeof body.scheduledAt === "string" ? new Date(body.scheduledAt) : null,
  });

  return NextResponse.json({ block }, { status: 201 });
}
