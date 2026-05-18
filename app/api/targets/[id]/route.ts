import { NextRequest, NextResponse } from "next/server";
import { TargetStatus, TargetPeriodType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";
import { getTargetById } from "@/lib/targets/queries";

type RouteParams = { params: Promise<{ id: string }> };

const VALID_STATUSES = new Set<string>(Object.values(TargetStatus));
const VALID_PERIODS  = new Set<string>(Object.values(TargetPeriodType));

function parseDate(v?: unknown): Date | null { const d = v ? new Date(String(v)) : null; return d && !isNaN(d.getTime()) ? d : null; }
function trim(v?: unknown): string | null { const s = String(v ?? "").trim(); return s || null; }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const access = await requireApiAnyPermission(ROUTE_PERMISSION_SETS.TARGETS_READ);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const { id } = await params;
    const target = await getTargetById(id);
    if (!target) return NextResponse.json({ error: "Ziel nicht gefunden." }, { status: 404 });
    return NextResponse.json({ target });
  } catch (error) {
    console.error("GET /api/targets/[id] failed:", error);
    return NextResponse.json({ error: "Ziel konnte nicht geladen werden." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.TARGETS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const { id } = await params;
    const existing = await prisma.target.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Ziel nicht gefunden." }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};

    if (body.title !== undefined) { const t = trim(body.title); if (!t) return NextResponse.json({ error: "Titel darf nicht leer sein." }, { status: 400 }); data.title = t; }
    if (body.status !== undefined) { if (!VALID_STATUSES.has(body.status)) return NextResponse.json({ error: "Ungültiger Status." }, { status: 400 }); data.status = body.status as TargetStatus; }
    if (body.periodType !== undefined) { data.periodType = VALID_PERIODS.has(body.periodType) ? (body.periodType as TargetPeriodType) : null; }
    if (body.description    !== undefined) data.description    = trim(body.description);
    if (body.orgUnitLabel   !== undefined) data.orgUnitLabel   = trim(body.orgUnitLabel);
    if (body.moduleKey      !== undefined) data.moduleKey      = trim(body.moduleKey);
    if (body.targetCategory !== undefined) data.targetCategory = trim(body.targetCategory);
    if (body.sportCategory  !== undefined) data.sportCategory  = trim(body.sportCategory);
    if (body.ageGroupHint   !== undefined) data.ageGroupHint   = trim(body.ageGroupHint);
    if (body.startsAt       !== undefined) data.startsAt       = parseDate(body.startsAt);
    if (body.endsAt         !== undefined) data.endsAt         = parseDate(body.endsAt);
    data.updatedByUserId = access.session?.user?.id ?? null;

    const target = await prisma.target.update({ where: { id }, data, select: { id: true, title: true, status: true, updatedAt: true } });
    return NextResponse.json({ target });
  } catch (error) {
    console.error("PATCH /api/targets/[id] failed:", error);
    return NextResponse.json({ error: "Ziel konnte nicht aktualisiert werden." }, { status: 500 });
  }
}
