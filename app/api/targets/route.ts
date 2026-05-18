import { NextRequest, NextResponse } from "next/server";
import { TargetStatus, TargetPeriodType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";
import { listTargets } from "@/lib/targets/queries";
import { ACTIVE_TENANT_SLUG } from "@/lib/platform/constants";

const VALID_STATUSES  = new Set<string>(Object.values(TargetStatus));
const VALID_PERIODS   = new Set<string>(Object.values(TargetPeriodType));

function parseStatus(v?: string | null):  TargetStatus    | undefined { return v && VALID_STATUSES.has(v)  ? (v as TargetStatus)    : undefined; }
function parsePeriod(v?: string | null):  TargetPeriodType | undefined { return v && VALID_PERIODS.has(v)   ? (v as TargetPeriodType) : undefined; }
function parseDate(v?: string | null):    Date | null { const d = v ? new Date(String(v)) : null; return d && !isNaN(d.getTime()) ? d : null; }
function trim(v?: unknown): string | null { const s = String(v ?? "").trim(); return s || null; }

export async function GET(request: NextRequest) {
  const access = await requireApiAnyPermission(ROUTE_PERMISSION_SETS.TARGETS_READ);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const { searchParams } = new URL(request.url);
    const targets = await listTargets({
      status:         searchParams.get("status")         ?? undefined,
      moduleKey:      searchParams.get("moduleKey")      ?? undefined,
      targetCategory: searchParams.get("targetCategory") ?? undefined,
      seasonId:       searchParams.get("seasonId")       ?? undefined,
      teamId:         searchParams.get("teamId")         ?? undefined,
      orgUnitLabel:   searchParams.get("orgUnitLabel")   ?? undefined,
    });
    return NextResponse.json({ targets });
  } catch (error) {
    console.error("GET /api/targets failed:", error);
    return NextResponse.json({ error: "Ziele konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.TARGETS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = await request.json().catch(() => ({}));
    const title = trim(body.title);
    if (!title) return NextResponse.json({ error: "Titel ist erforderlich." }, { status: 400 });

    const target = await prisma.target.create({
      data: {
        tenantSlug:              ACTIVE_TENANT_SLUG, // TODO(multi-tenancy)
        title,
        description:             trim(body.description),
        status:                  parseStatus(body.status)   ?? TargetStatus.DRAFT,
        periodType:              parsePeriod(body.periodType) ?? undefined,
        startsAt:                parseDate(body.startsAt),
        endsAt:                  parseDate(body.endsAt),
        orgUnitLabel:            trim(body.orgUnitLabel),
        moduleKey:               trim(body.moduleKey),
        targetCategory:          trim(body.targetCategory),
        sportCategory:           trim(body.sportCategory),
        ageGroupHint:            trim(body.ageGroupHint),
        createdByUserId:         access.session?.user?.id ?? null,
      },
      select: { id: true, title: true, status: true, createdAt: true },
    });

    return NextResponse.json({ target }, { status: 201 });
  } catch (error) {
    console.error("POST /api/targets failed:", error);
    return NextResponse.json({ error: "Ziel konnte nicht erstellt werden." }, { status: 500 });
  }
}
