/**
 * POST /api/targets/[id]/metrics/[metricId]/datapoints
 *
 * Record a new data point for a metric and denormalize currentValue.
 * Uses centralized requireTargetAccess() guard.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import { requireTargetAccess } from "@/lib/visibility/visibility-guards";
import { logAuditEvent } from "@/lib/audit/audit-log";

async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  return { ok: true as const, session };
}

type RouteContext = { params: Promise<{ id: string; metricId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const check = await requireSession();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { id, metricId } = await params;
  const actor = await getActorContext(check.session.user);

  // Target access guard — also confirms Target exists
  const guard = await requireTargetAccess({ actor, id, access: "write" });
  if (!guard.ok) return guard.response;

  const metric = await prisma.targetMetric.findUnique({
    where: { id: metricId },
    select: { id: true, targetId: true, type: true },
  });

  if (!metric || metric.targetId !== id) {
    return NextResponse.json({ error: "Metrik nicht gefunden." }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({}));

    const rawValue = body?.value;
    if (rawValue === undefined || rawValue === null || rawValue === "") {
      return NextResponse.json({ error: "Wert ist erforderlich." }, { status: 400 });
    }

    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      return NextResponse.json({ error: "Wert muss eine Zahl sein." }, { status: 400 });
    }

    const measuredAt = body?.measuredAt ? new Date(body.measuredAt) : new Date();

    const dataPoint = await prisma.targetDataPoint.create({
      data: {
        metricId,
        value,
        note: body?.note?.trim() || null,
        measuredAt,
      },
      select: { id: true, value: true, note: true, measuredAt: true },
    });

    await prisma.targetMetric.update({
      where: { id: metricId },
      data: { currentValue: value },
    });

    void logAuditEvent({
      actorUserId: actor.userId,
      module: "targets",
      entityId: id,
      action: "DATAPOINT_CREATE",
      metadata: { metricId, value, note: body?.note?.trim() || null, measuredAt: measuredAt.toISOString() },
    });

    return NextResponse.json({ dataPoint }, { status: 201 });
  } catch (error) {
    console.error("Create datapoint failed:", error);
    return NextResponse.json({ error: "Messwert konnte nicht gespeichert werden." }, { status: 500 });
  }
}
