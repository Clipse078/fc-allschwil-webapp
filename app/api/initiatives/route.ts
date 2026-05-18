import { NextRequest, NextResponse } from "next/server";
import { InitiativePriority, InitiativeStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";
import { listInitiatives } from "@/lib/initiatives/queries";
import { ACTIVE_TENANT_SLUG } from "@/lib/platform/constants";

const VALID_STATUSES   = new Set<string>(Object.values(InitiativeStatus));
const VALID_PRIORITIES = new Set<string>(Object.values(InitiativePriority));

function parseStatus(v?: string | null):   InitiativeStatus   | undefined {
  return v && VALID_STATUSES.has(v)   ? (v as InitiativeStatus)   : undefined;
}
function parsePriority(v?: string | null): InitiativePriority | undefined {
  return v && VALID_PRIORITIES.has(v) ? (v as InitiativePriority) : undefined;
}

export async function GET(request: NextRequest) {
  const access = await requireApiAnyPermission(ROUTE_PERMISSION_SETS.INITIATIVES_READ);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const { searchParams } = new URL(request.url);
    const initiatives = await listInitiatives({
      status:       searchParams.get("status")       ?? undefined,
      priority:     searchParams.get("priority")     ?? undefined,
      seasonId:     searchParams.get("seasonId")     ?? undefined,
      teamId:       searchParams.get("teamId")       ?? undefined,
      orgUnitLabel: searchParams.get("orgUnitLabel") ?? undefined,
    });
    return NextResponse.json({ initiatives });
  } catch (error) {
    console.error("GET /api/initiatives failed:", error);
    return NextResponse.json({ error: "Initiativen konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.INITIATIVES_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = await request.json().catch(() => ({}));

    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "Titel ist erforderlich." }, { status: 400 });

    const status   = parseStatus(body.status)     ?? InitiativeStatus.DRAFT;
    const priority = parsePriority(body.priority) ?? InitiativePriority.MEDIUM;

    const dueDateRaw = body.dueDate ? new Date(String(body.dueDate)) : null;
    const startsAtRaw = body.startsAt ? new Date(String(body.startsAt)) : null;

    const initiative = await prisma.initiative.create({
      data: {
        tenantSlug:    ACTIVE_TENANT_SLUG, // TODO(multi-tenancy): replace with session tenant
        title,
        summary:        body.summary        ? String(body.summary).trim()        || null : null,
        description:    body.description    ? String(body.description).trim()    || null : null,
        status,
        priority,
        orgUnitLabel:   body.orgUnitLabel   ? String(body.orgUnitLabel).trim()   || null : null,
        ownerName:      body.ownerName      ? String(body.ownerName).trim()      || null : null,
        dueDate:        dueDateRaw && !isNaN(dueDateRaw.getTime()) ? dueDateRaw : null,
        startsAt:       startsAtRaw && !isNaN(startsAtRaw.getTime()) ? startsAtRaw : null,
        seasonId:       body.seasonId       ? String(body.seasonId)      : null,
        teamId:         body.teamId         ? String(body.teamId)        : null,
        createdByUserId: access.session?.user?.id ?? null,
      },
      select: { id: true, title: true, status: true, priority: true, dueDate: true, createdAt: true },
    });

    return NextResponse.json({ initiative }, { status: 201 });
  } catch (error) {
    console.error("POST /api/initiatives failed:", error);
    return NextResponse.json({ error: "Initiative konnte nicht erstellt werden." }, { status: 500 });
  }
}
