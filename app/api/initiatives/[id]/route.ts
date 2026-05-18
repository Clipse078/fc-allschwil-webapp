import { NextRequest, NextResponse } from "next/server";
import { InitiativePriority, InitiativeStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";
import { getInitiativeById } from "@/lib/initiatives/queries";

type RouteParams = { params: Promise<{ id: string }> };

const VALID_STATUSES   = new Set<string>(Object.values(InitiativeStatus));
const VALID_PRIORITIES = new Set<string>(Object.values(InitiativePriority));

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const access = await requireApiAnyPermission(ROUTE_PERMISSION_SETS.INITIATIVES_READ);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const { id } = await params;
    const initiative = await getInitiativeById(id);
    if (!initiative) return NextResponse.json({ error: "Initiative nicht gefunden." }, { status: 404 });
    return NextResponse.json({ initiative });
  } catch (error) {
    console.error("GET /api/initiatives/[id] failed:", error);
    return NextResponse.json({ error: "Initiative konnte nicht geladen werden." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.INITIATIVES_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const { id } = await params;
    const existing = await prisma.initiative.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Initiative nicht gefunden." }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};

    if (body.title !== undefined) {
      const t = String(body.title).trim();
      if (!t) return NextResponse.json({ error: "Titel darf nicht leer sein." }, { status: 400 });
      data.title = t;
    }
    if (body.status !== undefined) {
      if (!VALID_STATUSES.has(body.status)) {
        return NextResponse.json({ error: `Ungültiger Status. Gültig: ${[...VALID_STATUSES].join(", ")}` }, { status: 400 });
      }
      data.status = body.status as InitiativeStatus;
    }
    if (body.priority !== undefined) {
      if (!VALID_PRIORITIES.has(body.priority)) {
        return NextResponse.json({ error: `Ungültige Priorität. Gültig: ${[...VALID_PRIORITIES].join(", ")}` }, { status: 400 });
      }
      data.priority = body.priority as InitiativePriority;
    }
    if (body.summary        !== undefined) data.summary        = body.summary        || null;
    if (body.description    !== undefined) data.description    = body.description    || null;
    if (body.orgUnitLabel   !== undefined) data.orgUnitLabel   = body.orgUnitLabel   || null;
    if (body.ownerName      !== undefined) data.ownerName      = body.ownerName      || null;
    if (body.dueDate        !== undefined) {
      const d = body.dueDate ? new Date(String(body.dueDate)) : null;
      data.dueDate = d && !isNaN(d.getTime()) ? d : null;
    }
    if (body.startsAt       !== undefined) {
      const d = body.startsAt ? new Date(String(body.startsAt)) : null;
      data.startsAt = d && !isNaN(d.getTime()) ? d : null;
    }
    if (body.completedAt    !== undefined) {
      const d = body.completedAt ? new Date(String(body.completedAt)) : null;
      data.completedAt = d && !isNaN(d.getTime()) ? d : null;
    }
    data.updatedByUserId = access.session?.user?.id ?? null;

    const initiative = await prisma.initiative.update({
      where: { id },
      data,
      select: { id: true, title: true, status: true, priority: true, dueDate: true, updatedAt: true },
    });

    return NextResponse.json({ initiative });
  } catch (error) {
    console.error("PATCH /api/initiatives/[id] failed:", error);
    return NextResponse.json({ error: "Initiative konnte nicht aktualisiert werden." }, { status: 500 });
  }
}
