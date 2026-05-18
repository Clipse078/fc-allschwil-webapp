import { NextRequest, NextResponse } from "next/server";
import { TargetMetricType, TargetDirection } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type RouteParams = { params: Promise<{ id: string }> };

const VALID_METRIC_TYPES = new Set<string>(Object.values(TargetMetricType));
const VALID_DIRECTIONS   = new Set<string>(Object.values(TargetDirection));

function trim(v?: unknown): string | null { const s = String(v ?? "").trim(); return s || null; }

export async function POST(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.TARGETS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const { id } = await params;
    const target = await prisma.target.findUnique({ where: { id }, select: { id: true } });
    if (!target) return NextResponse.json({ error: "Ziel nicht gefunden." }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const label = trim(body.label);
    if (!label) return NextResponse.json({ error: "Bezeichnung ist erforderlich." }, { status: 400 });

    if (!body.metricType || !VALID_METRIC_TYPES.has(body.metricType)) {
      return NextResponse.json({ error: "Ungültiger Messtyp." }, { status: 400 });
    }

    const direction = VALID_DIRECTIONS.has(body.direction)
      ? (body.direction as TargetDirection)
      : TargetDirection.INCREASE;

    const targetValueRaw = body.targetValue !== undefined && body.targetValue !== null
      ? parseFloat(String(body.targetValue))
      : null;
    const targetValue = targetValueRaw !== null && !isNaN(targetValueRaw) ? targetValueRaw : null;

    const sortOrder = await prisma.targetMetric.count({ where: { targetId: id } });

    const metric = await prisma.targetMetric.create({
      data: {
        targetId: id,
        sortOrder,
        label,
        metricType: body.metricType as TargetMetricType,
        direction,
        targetValue,
        unit: trim(body.unit),
        notes: trim(body.notes),
      },
      select: { id: true, label: true, metricType: true, direction: true, targetValue: true, unit: true },
    });

    return NextResponse.json({ metric }, { status: 201 });
  } catch (error) {
    console.error("POST /api/targets/[id]/metrics failed:", error);
    return NextResponse.json({ error: "Kennzahl konnte nicht erstellt werden." }, { status: 500 });
  }
}
