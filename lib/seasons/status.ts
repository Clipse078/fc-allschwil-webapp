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
