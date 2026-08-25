/**
 * lib/participation/statistics.ts
 *
 * Reusable participation summary counting logic.
 */

import type { ParticipationResponseStatus } from "@prisma/client";
import type { ParticipationStatusCounts, ParticipationSummary } from "./types";

export function countParticipationStatuses(
  statuses: ParticipationResponseStatus[],
): ParticipationStatusCounts {
  const counts: ParticipationStatusCounts = {
    open: 0,
    yes: 0,
    no: 0,
    maybe: 0,
  };

  for (const status of statuses) {
    switch (status) {
      case "OPEN":
        counts.open += 1;
        break;
      case "YES":
        counts.yes += 1;
        break;
      case "NO":
        counts.no += 1;
        break;
      case "MAYBE":
        counts.maybe += 1;
        break;
      default: {
        const _exhaustive: never = status;
        void _exhaustive;
      }
    }
  }

  return counts;
}

export function buildParticipationSummary(
  rosterSize: number,
  statuses: ParticipationResponseStatus[],
): ParticipationSummary {
  return {
    totalPlayers: rosterSize,
    counts: countParticipationStatuses(statuses),
  };
}
