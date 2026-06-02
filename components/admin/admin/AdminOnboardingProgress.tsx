import { CheckCircle2, Circle, Clock } from "lucide-react";

type OnboardingStep = {
  id: string;
  label: string;
  description: string;
  status: "complete" | "in_progress" | "pending";
};

type AdminOnboardingProgressProps = {
  steps: OnboardingStep[];
};

function StepIcon({ status }: { status: OnboardingStep["status"] }) {
  if (status === "complete") {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50">
        <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" style={{ width: 18, height: 18 }} />
      </div>
    );
  }
  if (status === "in_progress") {
    return (
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ background: "var(--blue-light)" }}
      >
        <Clock className="text-[var(--blue)]" style={{ width: 16, height: 16 }} />
      </div>
    );
  }
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
      style={{ background: "var(--surface-3)" }}
    >
      <Circle className="text-[var(--muted)]" style={{ width: 16, height: 16 }} />
    </div>
  );
}

function StepStatusBadge({ status }: { status: OnboardingStep["status"] }) {
  if (status === "complete") {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[0.68rem] font-medium bg-emerald-50 text-emerald-700">
        Abgeschlossen
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-[0.68rem] font-medium"
        style={{ background: "var(--blue-light)", color: "var(--blue)" }}
      >
        In Bearbeitung
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[0.68rem] font-medium"
      style={{ background: "var(--surface-3)", color: "var(--muted)" }}
    >
      Ausstehend
    </span>
  );
}

export default function AdminOnboardingProgress({
  steps,
}: AdminOnboardingProgressProps) {
  const completed = steps.filter((s) => s.status === "complete").length;
  const total = steps.length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="sce-detail-section">
      <div className="sce-detail-section-header">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
              Setup
            </p>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Plattform-Einrichtung
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[0.72rem] font-medium text-[var(--muted)]">
              {completed} / {total} abgeschlossen
            </p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 pt-4 pb-2">
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: "var(--surface-3)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: progressPct === 100 ? "#10b981" : "var(--blue)",
            }}
          />
        </div>
        <p className="mt-1.5 text-[0.7rem] text-[var(--muted)]">
          {progressPct}% eingerichtet
        </p>
      </div>

      <div className="sce-detail-section-body space-y-0 divide-y divide-[var(--border)] pt-0">
        {steps.map((step) => (
          <div
            key={step.id}
            className="flex items-start gap-3 py-3.5 first:pt-0"
          >
            <StepIcon status={step.status} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className="text-sm font-medium"
                  style={{
                    color:
                      step.status === "complete"
                        ? "var(--foreground)"
                        : step.status === "in_progress"
                          ? "var(--foreground)"
                          : "var(--text-2)",
                  }}
                >
                  {step.label}
                </p>
                <StepStatusBadge status={step.status} />
              </div>
              <p className="mt-0.5 text-[0.75rem] leading-relaxed text-[var(--muted)]">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
