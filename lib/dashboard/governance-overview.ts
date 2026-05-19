/**
 * Governance Overview query helpers — server-only.
 *
 * Four deterministic operational queries for the Vereinsleitung dashboard.
 * All queries respect ActorContext visibility — no PRIVATE/RESTRICTED records
 * leak to actors outside the allowlist.
 *
 * Roadmap:
 *   - Push RESTRICTED filtering into DB via JSONB @> queries (Phase 2)
 *   - Cache orgUnitIds in JWT to eliminate per-request DB round-trip
 *   - Pagination once volumes exceed display limits
 */

import { prisma } from "@/lib/db/prisma";
import type { ActorContext } from "@/lib/visibility/actor-context";
import {
  buildVisibilityWhere,
  applyVisibilityFilter,
  canSeeEntity,
} from "@/lib/visibility/visibility-filter";

// ---------------------------------------------------------------------------
// Pending Approvals
// ---------------------------------------------------------------------------

export type PendingApprovalItem = {
  module: "meeting" | "initiative" | "target" | "template";
  moduleLabel: string;
  id: string;
  title: string;
  href: string;
  /** ISO date string — when the record was last updated (proxy for submitted-at) */
  updatedAt: string;
};

/**
 * Returns all Meeting, Initiative, Target, and CommunicationTemplate records
 * currently in reviewStage = SUBMITTED, filtered to what the actor can see.
 *
 * Sorted by updatedAt ascending (oldest pending first — highest urgency).
 */
export async function getPendingApprovals(
  actor: ActorContext,
): Promise<PendingApprovalItem[]> {
  const visWhere = buildVisibilityWhere(actor);

  const [meetings, initiatives, targets, templates] = await Promise.all([
    prisma.meeting.findMany({
      where: { ...visWhere, reviewStage: "SUBMITTED" },
      select: {
        id: true,
        slug: true,
        title: true,
        updatedAt: true,
        visibilityScope: true,
        createdByUserId: true,
        visibleRoleRefs: true,
        visibleUserRefs: true,
        visibleTeamRefs: true,
        visibleOrgUnitRefs: true,
        visiblePersonRefs: true,
      },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.initiative.findMany({
      where: { ...visWhere, reviewStage: "SUBMITTED" },
      select: {
        id: true,
        slug: true,
        title: true,
        updatedAt: true,
        visibilityScope: true,
        createdByUserId: true,
        visibleRoleRefs: true,
        visibleUserRefs: true,
        visibleTeamRefs: true,
        visibleOrgUnitRefs: true,
        visiblePersonRefs: true,
      },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.target.findMany({
      where: { ...visWhere, reviewStage: "SUBMITTED" },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        visibilityScope: true,
        createdByUserId: true,
        visibleRoleRefs: true,
        visibleUserRefs: true,
        visibleTeamRefs: true,
        visibleOrgUnitRefs: true,
        visiblePersonRefs: true,
      },
      orderBy: { updatedAt: "asc" },
    }),
    // CommunicationTemplate: simplified visibility (ORGANISATION or creator)
    prisma.communicationTemplate.findMany({
      where: { reviewStage: "SUBMITTED" },
      select: {
        id: true,
        slug: true,
        title: true,
        updatedAt: true,
        visibilityScope: true,
        createdByUserId: true,
      },
      orderBy: { updatedAt: "asc" },
    }),
  ]);

  const items: PendingApprovalItem[] = [];

  for (const m of applyVisibilityFilter(meetings, actor)) {
    items.push({
      module: "meeting",
      moduleLabel: "Meeting",
      id: m.id,
      title: m.title,
      href: `/meetings/${m.slug}`,
      updatedAt: m.updatedAt.toISOString(),
    });
  }

  for (const i of applyVisibilityFilter(initiatives, actor)) {
    items.push({
      module: "initiative",
      moduleLabel: "Initiative",
      id: i.id,
      title: i.title,
      href: `/initiatives/${i.slug}`,
      updatedAt: i.updatedAt.toISOString(),
    });
  }

  for (const t of applyVisibilityFilter(targets, actor)) {
    items.push({
      module: "target",
      moduleLabel: "Ziel",
      id: t.id,
      title: t.title,
      href: `/targets/${t.id}`,
      updatedAt: t.updatedAt.toISOString(),
    });
  }

  // CommunicationTemplate: simplified visibility check
  for (const tpl of templates) {
    const isVisible =
      tpl.visibilityScope === "ORGANISATION" ||
      (tpl.createdByUserId && tpl.createdByUserId === actor.userId);
    if (isVisible) {
      items.push({
        module: "template",
        moduleLabel: "Vorlage",
        id: tpl.id,
        title: tpl.title,
        href: `/templates/${tpl.id}`,
        updatedAt: tpl.updatedAt.toISOString(),
      });
    }
  }

  // Sort combined list by updatedAt ascending (oldest first)
  items.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));

  return items;
}

// ---------------------------------------------------------------------------
// Stale Targets
// ---------------------------------------------------------------------------

export type StaleTargetItem = {
  id: string;
  title: string;
  category: string;
  /** ISO date string */
  updatedAt: string;
  /** 0–100 derived from first metric, or null if no metrics */
  progress: number | null;
};

const STALE_DAYS = 30;

/**
 * Returns ACTIVE targets that have not been updated in the last 30 days.
 * Filtered by actor visibility.
 */
export async function getStaleTargets(
  actor: ActorContext,
): Promise<StaleTargetItem[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_DAYS);

  const rows = await prisma.target.findMany({
    where: {
      ...buildVisibilityWhere(actor),
      status: "ACTIVE",
      updatedAt: { lt: cutoff },
    },
    select: {
      id: true,
      title: true,
      category: true,
      updatedAt: true,
      visibilityScope: true,
      createdByUserId: true,
      visibleRoleRefs: true,
      visibleUserRefs: true,
      visibleTeamRefs: true,
      visibleOrgUnitRefs: true,
      visiblePersonRefs: true,
      metrics: {
        select: { currentValue: true, targetValue: true, direction: true },
        orderBy: { sortOrder: "asc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "asc" },
  });

  const visible = applyVisibilityFilter(rows, actor);

  return visible.map((t) => {
    const metric = t.metrics[0] ?? null;
    let progress: number | null = null;
    if (metric && metric.targetValue > 0) {
      if (metric.direction === "DECREASE") {
        const start = metric.targetValue * 2;
        progress = Math.max(0, Math.min(100, Math.round(((start - metric.currentValue) / start) * 100)));
      } else {
        progress = Math.max(0, Math.min(100, Math.round((metric.currentValue / metric.targetValue) * 100)));
      }
    }
    return {
      id: t.id,
      title: t.title,
      category: t.category,
      updatedAt: t.updatedAt.toISOString(),
      progress,
    };
  });
}

// ---------------------------------------------------------------------------
// Template Drafts Awaiting Review
// ---------------------------------------------------------------------------

export type TemplateDraftItem = {
  id: string;
  slug: string;
  title: string;
  category: string;
  updatedAt: string;
};

/**
 * Returns CommunicationTemplates in reviewStage = SUBMITTED.
 * Uses simplified visibility (ORGANISATION or creator).
 */
export async function getTemplateDrafts(
  actor: ActorContext,
): Promise<TemplateDraftItem[]> {
  const rows = await prisma.communicationTemplate.findMany({
    where: { reviewStage: "SUBMITTED" },
    select: {
      id: true,
      slug: true,
      title: true,
      category: true,
      updatedAt: true,
      visibilityScope: true,
      createdByUserId: true,
    },
    orderBy: { updatedAt: "asc" },
  });

  return rows
    .filter(
      (t) =>
        t.visibilityScope === "ORGANISATION" ||
        (t.createdByUserId && t.createdByUserId === actor.userId),
    )
    .map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.title,
      category: t.category,
      updatedAt: t.updatedAt.toISOString(),
    }));
}

// ---------------------------------------------------------------------------
// Overdue Actions
// ---------------------------------------------------------------------------

export type OverdueActionItem = {
  id: string;
  title: string;
  owner: string | null;
  /** ISO date string */
  dueDate: string;
  meetingId: string;
  meetingTitle: string;
  meetingSlug: string;
};

/**
 * Returns open MeetingActions where dueDate is in the past.
 * Only includes actions from meetings the actor can see.
 * Actions with no dueDate are excluded.
 */
export async function getOverdueActions(
  actor: ActorContext,
): Promise<OverdueActionItem[]> {
  const now = new Date();

  const rows = await prisma.meetingAction.findMany({
    where: {
      status: "OPEN",
      dueDate: { lt: now },
    },
    select: {
      id: true,
      title: true,
      owner: true,
      dueDate: true,
      meeting: {
        select: {
          id: true,
          slug: true,
          title: true,
          visibilityScope: true,
          createdByUserId: true,
          visibleRoleRefs: true,
          visibleUserRefs: true,
          visibleTeamRefs: true,
          visibleOrgUnitRefs: true,
          visiblePersonRefs: true,
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  return rows
    .filter((a) => a.dueDate !== null && canSeeEntity(a.meeting, actor))
    .map((a) => ({
      id: a.id,
      title: a.title,
      owner: a.owner,
      dueDate: a.dueDate!.toISOString(),
      meetingId: a.meeting.id,
      meetingTitle: a.meeting.title,
      meetingSlug: a.meeting.slug,
    }));
}

// ---------------------------------------------------------------------------
// Aggregate type for page.tsx
// ---------------------------------------------------------------------------

export type GovernanceOverviewData = {
  pendingApprovals: PendingApprovalItem[];
  staleTargets: StaleTargetItem[];
  templateDrafts: TemplateDraftItem[];
  overdueActions: OverdueActionItem[];
};
