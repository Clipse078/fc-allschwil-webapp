/**
 * lib/facilities/resource-options.ts
 *
 * MASTERDATA-CONSISTENCY-02 — pure, I/O-free helpers for building canonical
 * FacilityResource select-option lists.
 *
 * Deliberately has NO Prisma/DB import so this module is safe to import from
 * both server code (lib/facilities/queries.ts re-exports it) and "use client"
 * components (MatchcenterDetailOperational, WochenplanRoomDrawer,
 * WochenplanRoomDayPlannerDialog) without pulling the Prisma client into the
 * browser bundle.
 */

/** Minimal shape shared by every canonical resource selector across the app. */
export type FacilityResourceOption = {
  code: string;
  name: string;
};

/**
 * Merges codes that MUST remain selectable (typically the value(s) already
 * persisted on an existing record) into an active-options list.
 *
 * This is the shared "historical compatibility" primitive: when a resource
 * has been archived, or a submitted code no longer resolves to an active
 * FacilityResource, the existing allocation must stay visible/selected
 * rather than silently disappearing or resetting to empty.
 *
 * - Codes already present in `activeOptions` are left untouched (the
 *   canonical current name always wins for active resources).
 * - Missing codes are appended using the resolved display name from
 *   `fallbackNamesByCode` when available (e.g. resolved via
 *   getFacilityResourcesByCodesForTenant, which does not filter by status),
 *   or the bare code itself when no name can be resolved at all.
 * - null/undefined/blank codes are ignored.
 */
export function withRequiredCodes(
  activeOptions: FacilityResourceOption[],
  requiredCodes: Array<string | null | undefined>,
  fallbackNamesByCode?: Map<string, string>,
): FacilityResourceOption[] {
  const known = new Set(activeOptions.map((option) => option.code));
  const merged = [...activeOptions];

  for (const code of requiredCodes) {
    if (!code || known.has(code)) continue;
    known.add(code);
    merged.push({ code, name: fallbackNamesByCode?.get(code) ?? code });
  }

  return merged;
}
