export type SeasonLifecycleStatus =
  | "PLANNING"
  | "ONGOING"
  | "COMPLETED";

export function getSeasonLifecycleStatusLabel(status: SeasonLifecycleStatus): string {
  switch (status) {
    case "PLANNING":
      return "In Planung";
    case "ONGOING":
      return "Laufend";
    case "COMPLETED":
      return "Abgeschlossen";
    default:
      return "Unbekannt";
  }
}

export function getSeasonLifecycleStatusClasses(status: SeasonLifecycleStatus): string {
  switch (status) {
    case "PLANNING":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "ONGOING":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "COMPLETED":
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

/**
 * SEASON-01 — the Seasons admin surface's "current-season" status label.
 *
 * Deliberately distinct from {@link SeasonLifecycleStatus}: that type is a
 * pure calendar-date computation ("is today between start and end?") used
 * only for informational lifecycle labelling elsewhere (e.g. the season
 * registration picker). "AKTUELL" here means exactly one thing — the
 * persisted `Season.isActive` flag, set ONLY by an explicit admin
 * "Aktuell setzen" action (POST /api/seasons/[seasonId]/activate) — never
 * derived from dates. A Season whose dates say "ongoing" but that the
 * admin has not (yet) chosen as current is "ZUKUENFTIG", not "AKTUELL".
 */
export type SeasonCurrentStatus = "AKTUELL" | "VERGANGEN" | "ZUKUENFTIG";

export function getSeasonCurrentStatus(args: {
  isActive: boolean;
  endDate: Date | string;
  now?: Date | string;
}): SeasonCurrentStatus {
  if (args.isActive) return "AKTUELL";

  const end = args.endDate instanceof Date ? args.endDate : new Date(args.endDate);
  const now = args.now ? (args.now instanceof Date ? args.now : new Date(args.now)) : new Date();

  return end.getTime() < now.getTime() ? "VERGANGEN" : "ZUKUENFTIG";
}

export function getSeasonCurrentStatusLabel(status: SeasonCurrentStatus): string {
  switch (status) {
    case "AKTUELL":
      return "Aktuell";
    case "VERGANGEN":
      return "Vergangen";
    case "ZUKUENFTIG":
      return "Zukünftig";
    default:
      return "Unbekannt";
  }
}

export function getSeasonCurrentStatusClasses(status: SeasonCurrentStatus): string {
  switch (status) {
    case "AKTUELL":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "VERGANGEN":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "ZUKUENFTIG":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}
