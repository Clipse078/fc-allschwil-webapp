type MetricProgressProps = {
  label: string;
  type: "PERCENTAGE" | "NUMERIC" | "CURRENCY" | "BOOLEAN";
  direction: "INCREASE" | "DECREASE" | "MAINTAIN";
  targetValue: number;
  currentValue: number;
  unit?: string | null;
};

function computeProgress(
  current: number,
  target: number,
  direction: MetricProgressProps["direction"],
): number {
  if (target === 0) return current === 0 ? 100 : 0;

  if (direction === "DECREASE") {
    if (current >= target) return 100;
    const start = target * 2;
    const ratio = (start - current) / start;
    return Math.max(0, Math.min(100, Math.round(ratio * 100)));
  }

  const ratio = current / target;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

function formatValue(
  value: number,
  type: MetricProgressProps["type"],
  unit?: string | null,
): string {
  if (type === "BOOLEAN") return value >= 1 ? "Ja" : "Nein";
  if (type === "CURRENCY") {
    return (
      new Intl.NumberFormat("de-CH", { minimumFractionDigits: 0 }).format(value) +
      (unit ? ` ${unit}` : " CHF")
    );
  }
  if (type === "PERCENTAGE") {
    return `${value}${unit ?? "%"}`;
  }
  return `${value}${unit ? ` ${unit}` : ""}`;
}

function getProgressColor(percent: number): string {
  if (percent >= 90) return "bg-emerald-500";
  if (percent >= 60) return "bg-[var(--sce-primary)]";
  if (percent >= 30) return "bg-amber-500";
  return "bg-rose-400";
}

export default function TargetMetricProgress({
  label,
  type,
  direction,
  targetValue,
  currentValue,
  unit,
}: MetricProgressProps) {
  const percent = computeProgress(currentValue, targetValue, direction);
  const progressColor = getProgressColor(percent);

  const currentFormatted = formatValue(currentValue, type, unit);
  const targetFormatted = formatValue(targetValue, type, unit);

  const directionLabel =
    direction === "INCREASE" ? "↑" : direction === "DECREASE" ? "↓" : "→";

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium leading-5 text-[var(--sce-heading)]">
            {directionLabel} {label}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--sce-muted)]">
            Aktuell: <span className="font-semibold text-[var(--sce-foreground)]">{currentFormatted}</span>
            {" · "}
            Ziel: <span className="font-semibold text-[var(--sce-foreground)]">{targetFormatted}</span>
          </p>
        </div>
        <span
          className={`sce-chip shrink-0 px-2.5 py-0.5 text-[11px] ${
            percent >= 90
              ? "sce-chip-success"
              : percent >= 60
                ? "sce-chip-primary"
                : percent >= 30
                  ? "sce-chip-warning"
                  : "sce-chip-danger"
          }`}
        >
          {percent}%
        </span>
      </div>

      <div className="h-2 rounded-full bg-[var(--sce-surface-muted)]">
        <div
          className={`h-2 rounded-full transition-all ${progressColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
