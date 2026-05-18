import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";
import {
  TargetCategory,
  TargetStatus,
  TargetPeriod,
  TargetMetricType,
  TargetDirection,
} from "@prisma/client";

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

  const targets = await prisma.target.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      status: true,
      period: true,
      periodLabel: true,
      startsAt: true,
      endsAt: true,
      metrics: {
        select: {
          id: true,
          label: true,
          type: true,
          direction: true,
          targetValue: true,
          currentValue: true,
          unit: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

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
