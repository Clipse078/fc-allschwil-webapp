/**
 * lib/wochenplan/plan-types.ts
 *
 * WOCHENPLAN-2.0-01B — DTOs for tenant-level WochenplanPlan /
 * WochenplanPlanAllocation.
 */

export type WochenplanPlanDto = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  /** Canonical plan — allocations stored on Event fields. */
  isDefault: boolean;
  /** Canonical active plan for this tenant — drives website, Infoboard, and other consumers. */
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type WochenplanPlanAllocationDto = {
  id: string;
  tenantId: string;
  wochenplanPlanId: string;
  eventId: string;
  pitchCode: string | null;
  homeDressingRoomCode: string | null;
  awayDressingRoomCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateWochenplanPlanInput = {
  name: string;
  description?: string | null;
};

export type WochenplanPlanCreationMode = "empty" | "copy";

export type CreateWochenplanPlanWithWeekInput = {
  name: string;
  description?: string | null;
  weekId: string;
  mode: WochenplanPlanCreationMode;
  sourceWochenplanPlanId?: string | null;
};

export type UpsertWochenplanPlanAllocationInput = {
  wochenplanPlanId: string;
  eventId: string;
  pitchCode: string | null;
  homeDressingRoomCode: string | null;
  awayDressingRoomCode: string | null;
};
