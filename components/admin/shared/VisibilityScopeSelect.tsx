import { Eye, EyeOff, Lock } from "lucide-react";

export type VisibilityScopeValue = "ORGANISATION" | "RESTRICTED" | "PRIVATE";

type VisibilityScopeSelectProps = {
  value: VisibilityScopeValue;
  onChange: (value: VisibilityScopeValue) => void;
  className?: string;
};

const OPTIONS: Array<{
  value: VisibilityScopeValue;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  colors: string;
}> = [
  {
    value: "ORGANISATION",
    label: "Organisation",
    description: "Sichtbar für alle angemeldeten Vereinsmitglieder.",
    icon: Eye,
    colors: "border-[var(--sce-border)] bg-[var(--sce-surface-muted)] text-[var(--sce-foreground)]",
  },
  {
    value: "RESTRICTED",
    label: "Eingeschränkt",
    description: "Nur für ausgewählte Rollen oder Personen. Allowlist-Konfiguration folgt.",
    icon: EyeOff,
    colors: "border-[var(--sce-border)] bg-[var(--sce-warning-soft)] text-[var(--sce-warning)]",
  },
  {
    value: "PRIVATE",
    label: "Privat",
    description: "Nur du und explizit erlaubte Personen können diesen Eintrag sehen.",
    icon: Lock,
    colors: "border-[var(--sce-border)] bg-[var(--sce-danger-soft)] text-[var(--sce-danger)]",
  },
];

export default function VisibilityScopeSelect({
  value,
  onChange,
  className = "",
}: VisibilityScopeSelectProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex w-full items-start gap-3 rounded-[16px] border px-4 py-3 text-left transition ${
              active
                ? `${opt.colors} shadow-sm`
                : "border-[var(--sce-border)] bg-[var(--sce-surface-strong)] text-[var(--sce-foreground)] hover:border-[var(--sce-border-strong)] hover:bg-[var(--sce-surface-muted)]"
            }`}
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "" : "text-[var(--sce-subtle)]"}`} />
            <div className="min-w-0">
              <p className={`text-[13px] font-semibold ${active ? "" : "text-[var(--sce-heading)]"}`}>
                {opt.label}
              </p>
              <p className={`mt-0.5 text-[11px] ${active ? "opacity-80" : "text-[var(--sce-muted)]"}`}>
                {opt.description}
              </p>
            </div>
            {active ? (
              <span className="ml-auto shrink-0 mt-0.5 h-4 w-4 rounded-full border-2 border-current flex items-center justify-center">
                <span className="h-2 w-2 rounded-full bg-current" />
              </span>
            ) : (
              <span className="ml-auto shrink-0 mt-0.5 h-4 w-4 rounded-full border-2 border-[var(--sce-border-strong)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
