/**
 * Publishing Cockpit — server-only query helpers.
 *
 * Aggregates ReviewWorkflowStage counts and pipeline items across content
 * modules. Sprint 1 covers Events; future sprints will extend to News, Teams,
 * Players, and Trainers without changing the page contract.
 */

import { prisma } from "@/lib/db/prisma";
import { ReviewWorkflowStage } from "@prisma/client";

// ---------------------------------------------------------------------------
// KPI counts — events grouped by review stage
// ---------------------------------------------------------------------------

export type PublishingKpiCounts = {
  draft: number;
  submitted: number;
  approved: number;
  published: number;
};

export async function getPublishingKpiCounts(): Promise<PublishingKpiCounts> {
  const rows = await prisma.event.groupBy({
    by: ["reviewStage"],
    _count: { _all: true },
  });

  const map = Object.fromEntries(rows.map((r) => [r.reviewStage, r._count._all]));

  return {
    draft: map[ReviewWorkflowStage.DRAFT] ?? 0,
    submitted: map[ReviewWorkflowStage.SUBMITTED] ?? 0,
    approved: map[ReviewWorkflowStage.APPROVED] ?? 0,
    published: map[ReviewWorkflowStage.PUBLISHED] ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Recent pipeline items — events in SUBMITTED / APPROVED / PUBLISHED stages
// ---------------------------------------------------------------------------

export type RecentEventInPipeline = {
  id: string;
  title: string;
  type: string;
  reviewStage: ReviewWorkflowStage;
  startAt: Date;
  updatedAt: Date;
  seasonName: string | null;
  teamName: string | null;
};

export async function getRecentEventsInPipeline(
  take = 8,
): Promise<RecentEventInPipeline[]> {
  const events = await prisma.event.findMany({
    where: {
      reviewStage: {
        in: [
          ReviewWorkflowStage.SUBMITTED,
          ReviewWorkflowStage.APPROVED,
          ReviewWorkflowStage.PUBLISHED,
        ],
      },
    },
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      title: true,
      type: true,
      reviewStage: true,
      startAt: true,
      updatedAt: true,
      season: { select: { name: true } },
      team: { select: { name: true } },
    },
  });

  return events.map((e) => ({
    id: e.id,
    title: e.title,
    type: e.type,
    reviewStage: e.reviewStage,
    startAt: e.startAt,
    updatedAt: e.updatedAt,
    seasonName: e.season?.name ?? null,
    teamName: e.team?.name ?? null,
  }));
}
