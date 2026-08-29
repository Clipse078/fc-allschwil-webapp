/**
 * lib/wochenplan/plan-queries.ts
 *
 * WOCHENPLAN-2.0-01B — read-side helpers for resolving plan-specific
 * allocations over canonical Event fields.
 */

import { prisma } from "@/lib/db/prisma";
import type { WochenplanPlanDto } from "./plan-types";
import { getActiveWochenplanPlan, getWochenplanPlan } from "./plan-service";

export type EventAllocationFields = {
  id: string;
  pitchCode: string | null;
  homeDressingRoomCode: string | null;
  awayDressingRoomCode: string | null;
};

export async function resolveWochenplanPlanForRead(
  tenantId: string,
  planId?: string | null,
): Promise<WochenplanPlanDto | null> {
  if (planId) {
    try {
      return await getWochenplanPlan(tenantId, planId);
    } catch {
      return null;
    }
  }
  return getActiveWochenplanPlan(tenantId);
}

export async function loadPlanAllocationMap(
  tenantId: string,
  planId: string,
): Promise<Map<string, EventAllocationFields>> {
  const rows = await prisma.wochenplanPlanAllocation.findMany({
    where: { tenantId, wochenplanPlanId: planId },
    select: {
      eventId: true,
      pitchCode: true,
      homeDressingRoomCode: true,
      awayDressingRoomCode: true,
    },
  });

  return new Map(
    rows.map((row) => [
      row.eventId,
      {
        id: row.eventId,
        pitchCode: row.pitchCode,
        homeDressingRoomCode: row.homeDressingRoomCode,
        awayDressingRoomCode: row.awayDressingRoomCode,
      },
    ]),
  );
}

export function mergeEventAllocation<T extends EventAllocationFields>(
  event: T,
  override: EventAllocationFields | undefined,
): T {
  if (!override) return event;
  return {
    ...event,
    pitchCode: override.pitchCode,
    homeDressingRoomCode: override.homeDressingRoomCode,
    awayDressingRoomCode: override.awayDressingRoomCode,
  };
}

export async function applyWochenplanPlanAllocations<T extends EventAllocationFields>(
  tenantId: string,
  events: T[],
  plan?: Pick<WochenplanPlanDto, "id" | "isDefault"> | null,
): Promise<T[]> {
  if (!plan || plan.isDefault || events.length === 0) {
    return events;
  }

  const overrides = await loadPlanAllocationMap(tenantId, plan.id);
  if (overrides.size === 0) return events;

  return events.map((event) => mergeEventAllocation(event, overrides.get(event.id)));
}

export async function applyActiveWochenplanPlanAllocations<T extends EventAllocationFields>(
  tenantId: string,
  events: T[],
): Promise<{ events: T[]; activePlan: WochenplanPlanDto | null }> {
  const activePlan = await getActiveWochenplanPlan(tenantId);
  const merged = await applyWochenplanPlanAllocations(tenantId, events, activePlan);
  return { events: merged, activePlan };
}
