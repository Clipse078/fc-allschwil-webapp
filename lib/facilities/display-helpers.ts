/**
 * lib/facilities/display-helpers.ts
 *
 * Canonical display-name helpers for pitch and dressing-room codes.
 *
 * Single source of truth for converting internal allocation codes to
 * human-readable labels. Used by the public InfoBoard feed, the kiosk
 * display components, and the Admin → Facilities & Resources UI.
 *
 * All code-to-label mappings live here — never duplicate them in
 * feed formatters, display components, or admin pages.
 *
 * Two tiers of resolution:
 *   1. Tenant-configured DB records (FacilityResource) — checked first when tenantId is provided.
 *   2. Static FCA registries (pitches.ts / dressing-rooms.ts) — fallback for legacy codes.
 */

import { getPitchAllocationByCode } from "@/lib/facilities/pitches";
import { getDressingRoomByCode } from "@/lib/facilities/dressing-rooms";
import { getFacilityResourcesByCodesForTenant } from "@/lib/facilities/queries";

/**
 * Returns the human-readable display label for a pitch allocation code.
 *
 * Uses the canonical FCA_PITCH_ALLOCATIONS registry as the source.
 * Falls back to null when no code is present or the code is unrecognised.
 *
 * @example
 *   getPitchDisplayLabel("STADION")        // "Stadion"
 *   getPitchDisplayLabel("KUNSTRASEN_2_A") // "Kunstrasen 2 A"
 *   getPitchDisplayLabel(null)             // null
 */
export function getPitchDisplayLabel(
  code: string | null | undefined,
): string | null {
  const allocation = getPitchAllocationByCode(code);
  return allocation?.websiteLabel ?? null;
}

/**
 * Returns the human-readable display label for a dressing-room code.
 *
 * Uses the canonical FCA_DRESSING_ROOMS registry as the source.
 * Falls back to null when no code is present or the code is unrecognised.
 *
 * @example
 *   getDressingRoomDisplayLabel("E1") // "E1"
 *   getDressingRoomDisplayLabel("O3") // "O3"
 *   getDressingRoomDisplayLabel(null) // null
 */
export function getDressingRoomDisplayLabel(
  code: string | null | undefined,
): string | null {
  const room = getDressingRoomByCode(code);
  return room?.label ?? null;
}

/**
 * Returns allocation display fields for an event — ready for public consumption.
 *
 * Converts raw DB codes to safe display labels. Returns null labels rather
 * than raw codes so internal identifiers are never leaked to public feeds.
 *
 * Uses only the static FCA registries. For tenant-aware resolution that
 * prefers DB-configured names, use getEventAllocationDisplayForTenant().
 */
export function getEventAllocationDisplay(event: {
  type: string;
  pitchCode: string | null | undefined;
  homeDressingRoomCode: string | null | undefined;
  awayDressingRoomCode: string | null | undefined;
}): {
  pitchLabel: string | null;
  /** Dressing room for home team (matches) or the assigned team (training/tournament) */
  homeDressingRoomLabel: string | null;
  /** Dressing room for away team — only relevant for matches */
  awayDressingRoomLabel: string | null;
} {
  const pitchLabel = getPitchDisplayLabel(event.pitchCode);

  const isMatch = event.type === "MATCH";

  if (isMatch) {
    return {
      pitchLabel,
      homeDressingRoomLabel: getDressingRoomDisplayLabel(
        event.homeDressingRoomCode,
      ),
      awayDressingRoomLabel: getDressingRoomDisplayLabel(
        event.awayDressingRoomCode,
      ),
    };
  }

  // For TRAINING, TOURNAMENT, OTHER: use homeDressingRoomCode as the
  // primary dressing room for the team. awayDressingRoomCode is not
  // relevant outside of matches.
  return {
    pitchLabel,
    homeDressingRoomLabel: getDressingRoomDisplayLabel(
      event.homeDressingRoomCode,
    ),
    awayDressingRoomLabel: null,
  };
}

/**
 * Tenant-aware async variant of getEventAllocationDisplay.
 *
 * Resolution order (no duplicate logic):
 *   1. Tenant-configured FacilityResource records (DB) — preferred.
 *   2. Static FCA registry fallback (pitches.ts / dressing-rooms.ts).
 *
 * Use this in server-side contexts (API routes, server components) where
 * the tenantId is available. Falls back gracefully to the static registries
 * when no tenant DB records exist.
 *
 * @example
 *   // In an API route with tenant context:
 *   const allocation = await getEventAllocationDisplayForTenant(event, tenantId);
 *
 * TODO(tenant-isolation/website): wire resolveTenantFromRequest() to obtain
 *   tenantId from the incoming HTTP request (subdomain / custom domain / path)
 *   before calling this function in public-facing routes.
 */
export async function getEventAllocationDisplayForTenant(
  event: {
    type: string;
    pitchCode: string | null | undefined;
    homeDressingRoomCode: string | null | undefined;
    awayDressingRoomCode: string | null | undefined;
  },
  tenantId: string | null | undefined,
): Promise<{
  pitchLabel: string | null;
  homeDressingRoomLabel: string | null;
  awayDressingRoomLabel: string | null;
}> {
  if (!tenantId) {
    return getEventAllocationDisplay(event);
  }

  const codes = [
    event.pitchCode,
    event.homeDressingRoomCode,
    event.awayDressingRoomCode,
  ].filter((c): c is string => Boolean(c));

  const dbLabels = await getFacilityResourcesByCodesForTenant(codes, tenantId);

  function resolveLabel(code: string | null | undefined): string | null {
    if (!code) return null;
    if (dbLabels.has(code)) return dbLabels.get(code)!;
    // Fallback: try pitch registry, then dressing-room registry
    const pitch = getPitchAllocationByCode(code);
    if (pitch) return pitch.websiteLabel;
    const room = getDressingRoomByCode(code);
    if (room) return room.label;
    return null;
  }

  const pitchLabel = resolveLabel(event.pitchCode);
  const isMatch = event.type === "MATCH";

  return {
    pitchLabel,
    homeDressingRoomLabel: resolveLabel(event.homeDressingRoomCode),
    awayDressingRoomLabel: isMatch ? resolveLabel(event.awayDressingRoomCode) : null,
  };
}

/**
 * Batch-resolve display labels for a list of events, using a single DB lookup.
 *
 * Collects all unique codes across events, fetches from DB once,
 * then applies tenant-aware resolution to each event.
 * Significantly more efficient than calling getEventAllocationDisplayForTenant
 * per event when rendering lists.
 */
export async function batchGetEventAllocationDisplayForTenant(
  events: Array<{
    type: string;
    pitchCode: string | null | undefined;
    homeDressingRoomCode: string | null | undefined;
    awayDressingRoomCode: string | null | undefined;
  }>,
  tenantId: string | null | undefined,
): Promise<
  Array<{
    pitchLabel: string | null;
    homeDressingRoomLabel: string | null;
    awayDressingRoomLabel: string | null;
  }>
> {
  if (!tenantId) {
    return events.map((e) => getEventAllocationDisplay(e));
  }

  const allCodes = new Set<string>();
  for (const event of events) {
    if (event.pitchCode) allCodes.add(event.pitchCode);
    if (event.homeDressingRoomCode) allCodes.add(event.homeDressingRoomCode);
    if (event.awayDressingRoomCode) allCodes.add(event.awayDressingRoomCode);
  }

  const dbLabels = await getFacilityResourcesByCodesForTenant(
    Array.from(allCodes),
    tenantId,
  );

  function resolveLabel(code: string | null | undefined): string | null {
    if (!code) return null;
    if (dbLabels.has(code)) return dbLabels.get(code)!;
    const pitch = getPitchAllocationByCode(code);
    if (pitch) return pitch.websiteLabel;
    const room = getDressingRoomByCode(code);
    if (room) return room.label;
    return null;
  }

  return events.map((event) => {
    const isMatch = event.type === "MATCH";
    return {
      pitchLabel: resolveLabel(event.pitchCode),
      homeDressingRoomLabel: resolveLabel(event.homeDressingRoomCode),
      awayDressingRoomLabel: isMatch ? resolveLabel(event.awayDressingRoomCode) : null,
    };
  });
}
