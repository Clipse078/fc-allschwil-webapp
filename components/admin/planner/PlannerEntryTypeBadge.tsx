type PlannerEntryTypeBadgeProps = {
  type: string;
  label: string;
};

function getClasses(type: string) {
  switch (type) {
    case "TRAINING":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "MATCH":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "TOURNAMENT":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "VACATION_PERIOD":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "OTHER":
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

export default function PlannerEntryTypeBadge({
  type,
  label,
}: PlannerEntryTypeBadgeProps) {
  return (
    <span
      className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${getClasses(type)}`}
    >
      {label}
    </span>
  );
}
