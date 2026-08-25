/**
 * Read-only operational history labels for past/non-actionable matches.
 */

import type { FacilityResourceOption } from "@/lib/facilities/resource-options";

export type OperationalHistoryInput = {
  pitchCode: string | null;
  homeDressingRoomCode: string | null;
  awayDressingRoomCode: string | null;
};

function resolveResourceLabel(
  code: string | null | undefined,
  options: readonly FacilityResourceOption[],
): string | null {
  const trimmed = code?.trim();
  if (!trimmed) {
    return null;
  }

  const match = options.find((option) => option.code === trimmed);
  return match?.name ?? trimmed;
}

/**
 * Concise read-only organisation line, e.g.
 * "Kunstrasen 2 · Heim O1 · Gast E1"
 */
export function formatOperationalHistoryLabel(
  operational: OperationalHistoryInput,
  options: {
    pitchOptions?: readonly FacilityResourceOption[];
    dressingRoomOptions?: readonly FacilityResourceOption[];
  } = {},
): string | null {
  const pitchOptions = options.pitchOptions ?? [];
  const dressingRoomOptions = options.dressingRoomOptions ?? [];

  const parts: string[] = [];

  const pitch = resolveResourceLabel(operational.pitchCode, pitchOptions);
  if (pitch) {
    parts.push(pitch);
  }

  const homeRoom = resolveResourceLabel(
    operational.homeDressingRoomCode,
    dressingRoomOptions,
  );
  if (homeRoom) {
    parts.push(`Heim ${homeRoom}`);
  }

  const awayRoom = resolveResourceLabel(
    operational.awayDressingRoomCode,
    dressingRoomOptions,
  );
  if (awayRoom) {
    parts.push(`Gast ${awayRoom}`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}
