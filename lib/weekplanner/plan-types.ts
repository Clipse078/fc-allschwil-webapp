/**
 * lib/weekplanner/plan-types.ts
 *
 * WEEKPLANNER-01B — DTOs and input types for WeekplannerPlan /
 * WeekplannerPlanAllocation. Mirrors lib/training/types.ts's
 * TrainingSessionAllocationDto convention.
 */

import type { WeekplannerActivityType, WeekplannerAllocationGroup } from "@prisma/client";

export type { WeekplannerActivityType, WeekplannerAllocationGroup };

export type WeekplannerPlanDto = {
  id: string;
  tenantId: string;
  /** Monday "YYYY-MM-DD" (Europe/Zurich) — same convention as WeekplannerWindow.param. */
  weekId: string;
  name: string;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Null while active. Set when archived (soft delete). */
  archivedAt: string | null;
};

export type WeekplannerPlanAllocationDto = {
  id: string;
  tenantId: string;
  weekplannerPlanId: string;
  activityType: WeekplannerActivityType;
  /** TrainingSession.id (TRAINING) or Event.id (MATCH/TOURNAMENT). */
  activityId: string;
  allocationGroup: WeekplannerAllocationGroup;
  /** TournamentParticipant.id for TOURNAMENT+DRESSING_ROOM; "" otherwise. */
  participantId: string;
  facilityResourceId: string;
  facilityResourceName: string;
  facilityResourceCode: string;
  facilityResourceType: string;
  facilityId: string;
  facilityName: string;
  notes: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateWeekplannerPlanInput = {
  weekId: string;
  name: string;
  createdByUserId?: string | null;
};

export type CreateWeekplannerPlanAllocationInput = {
  weekplannerPlanId: string;
  activityType: WeekplannerActivityType;
  activityId: string;
  allocationGroup: WeekplannerAllocationGroup;
  /** Required for TOURNAMENT+DRESSING_ROOM; must be omitted/empty otherwise. */
  participantId?: string | null;
  facilityResourceId: string;
  notes?: string | null;
  displayOrder?: number;
};
