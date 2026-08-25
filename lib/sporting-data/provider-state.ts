/**
 * lib/sporting-data/provider-state.ts
 *
 * TEAM-SFV-02B — provider match-state interpretation for the sporting lifecycle.
 *
 * Reads MatchExternalMapping.providerMatchStateName (SFV matchStateName) and
 * classifies it into a small, deterministic disposition. Raw provider integers
 * are intentionally not used — only textual evidence (same conservative
 * strategy as schedule-mapper.ts::mapMatchStateToEventStatus).
 */

export type ProviderMatchDisposition =
  | "NOT_PLAYED"
  | "COMPLETED"
  | "POSTPONED"
  | "CANCELLED"
  | "LIVE"
  | "UNKNOWN";

function normalizedProviderStateName(
  providerMatchStateName: string | null | undefined,
): string {
  return (providerMatchStateName ?? "").trim().toLowerCase();
}

/**
 * Classifies the SFV provider match state name into a canonical disposition.
 *
 * Pure, synchronous, no I/O.
 */
export function classifyProviderMatchDisposition(
  providerMatchStateName: string | null | undefined,
): ProviderMatchDisposition {
  const name = normalizedProviderStateName(providerMatchStateName);

  if (name.length === 0) {
    return "UNKNOWN";
  }

  if (
    name.includes("annull") ||
    name.includes("annulé") ||
    name.includes("abgesagt") ||
    name.includes("cancelled") ||
    name.includes("canceled")
  ) {
    return "CANCELLED";
  }

  if (
    name.includes("verschob") ||
    name.includes("reporté") ||
    name.includes("postponed")
  ) {
    return "POSTPONED";
  }

  if (
    name.includes("läuft") ||
    name.includes("en cours") ||
    name.includes("live")
  ) {
    return "LIVE";
  }

  if (
    name.includes("noch nicht ausgetragen") ||
    name.includes("pas encore joué")
  ) {
    return "NOT_PLAYED";
  }

  if (
    name.includes("ausgetragen") ||
    name.includes("gespielt") ||
    name.includes("joué") ||
    name.includes("abgeschlossen") ||
    name.includes("beendet") ||
    name.includes("terminé") ||
    name.includes("finished") ||
    name.includes("completed")
  ) {
    return "COMPLETED";
  }

  if (
    name.includes("angesetzt") ||
    name.includes("geplant") ||
    name.includes("planifié") ||
    name.includes("scheduled") ||
    name.includes("programmé")
  ) {
    return "NOT_PLAYED";
  }

  return "UNKNOWN";
}
