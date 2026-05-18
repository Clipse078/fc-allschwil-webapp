import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import {
  TargetCategory,
  TargetStatus,
  TargetPeriod,
  TargetMetricType,
  TargetDirection,
  VisibilityScope,
} from "@prisma/client";
import { buildActorContext } from "@/lib/visibility/actor-context";
import { getTargets } from "@/lib/targets/queries";

async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  return { ok: true as const, session };
}

export async function GET() {
  const check = await requireSession();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const actor = buildActorContext(check.session.user);
  const targets = await getTargets(actor);
  return NextResponse.json({ targets });
}

export async function POST(request: NextRequest) {
  const check = await requireSession();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  try {
    const body = await request.json().catch(() => ({}));

    const title = (body?.title ?? "").trim();
    if (!title) {
      return NextResponse.json({ error: "Titel ist erforderlich." }, { status: 400 });
    }

    const validCategories = Object.values(TargetCategory);
    const category: TargetCategory = validCategories.includes(body?.category)
      ? (body.category as TargetCategory)
      : TargetCategory.SPORTLICHE_ENTWICKLUNG;

    const validStatuses = Object.values(TargetStatus);
    const status: TargetStatus = validStatuses.includes(body?.status)
      ? (body.status as TargetStatus)
      : TargetStatus.ACTIVE;

    const validPeriods = Object.values(TargetPeriod);
    const period: TargetPeriod = validPeriods.includes(body?.period)
      ? (body.period as TargetPeriod)
      : TargetPeriod.SEASON;

    const validScopes = Object.values(VisibilityScope);
    const visibilityScope: VisibilityScope = validScopes.includes(body?.visibilityScope as VisibilityScope)
      ? (body.visibilityScope as VisibilityScope)
      : VisibilityScope.ORGANISATION;

    const validMetricTypes = Object.values(TargetMetricType);
    const validDirections = Object.values(TargetDirection);

    const rawMetrics: Array<{
      label: string;
      type: string;
      direction: string;
      targetValue: number;
      currentValue?: number;
      unit?: string;
      notes?: string;
      sortOrder?: number;
    }> = Array.isArray(body?.metrics) ? body.metrics : [];

    const created = await prisma.target.create({
      data: {
        title,
        description: body?.description?.trim() || null,
        category,
        status,
        period,
        periodLabel: body?.periodLabel?.trim() || null,
        moduleKey: body?.moduleKey?.trim() || null,
        sportCategory: body?.sportCategory?.trim() || null,
        ageGroupHint: body?.ageGroupHint?.trim() || null,
        startsAt: body?.startsAt ? new Date(body.startsAt) : null,
        endsAt: body?.endsAt ? new Date(body.endsAt) : null,
        nudgeJson: body?.nudgeJson ?? null,
        visibilityScope,
        createdByUserId: check.session.user.id,
        metrics: {
          create: rawMetrics
            .filter((m) => m.label?.trim())
            .map((m, idx) => ({
              label: m.label.trim(),
              type: validMetricTypes.includes(m.type as TargetMetricType)
                ? (m.type as TargetMetricType)
                : TargetMetricType.PERCENTAGE,
              direction: validDirections.includes(m.direction as TargetDirection)
                ? (m.direction as TargetDirection)
                : TargetDirection.INCREASE,
              targetValue: Number(m.targetValue) || 0,
              currentValue: Number(m.currentValue) || 0,
              unit: m.unit?.trim() || null,
              notes: m.notes?.trim() || null,
              sortOrder: m.sortOrder ?? idx,
            })),
        },
      },
      select: { id: true, title: true },
    });

    return NextResponse.json({ target: created }, { status: 201 });
  } catch (error) {
    console.error("Create target failed:", error);
    return NextResponse.json({ error: "Ziel konnte nicht erstellt werden." }, { status: 500 });
  }
}
