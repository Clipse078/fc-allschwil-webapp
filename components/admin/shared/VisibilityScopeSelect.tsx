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
    colors: "border-slate-200 text-slate-700 bg-slate-50",
  },
  {
    value: "RESTRICTED",
    label: "Eingeschränkt",
    description: "Nur für ausgewählte Rollen oder Personen. Allowlist-Konfiguration folgt.",
    icon: EyeOff,
    colors: "border-amber-200 text-amber-700 bg-amber-50",
  },
  {
    value: "PRIVATE",
    label: "Privat",
    description: "Nur du und explizit erlaubte Personen können diesen Eintrag sehen.",
    icon: Lock,
    colors: "border-rose-200 text-rose-700 bg-rose-50",
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
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "" : "text-slate-400"}`} />
            <div className="min-w-0">
              <p className={`text-[13px] font-semibold ${active ? "" : "text-slate-800"}`}>
                {opt.label}
              </p>
              <p className={`mt-0.5 text-[11px] ${active ? "opacity-80" : "text-slate-500"}`}>
                {opt.description}
              </p>
            </div>
            {active ? (
              <span className="ml-auto shrink-0 mt-0.5 h-4 w-4 rounded-full border-2 border-current flex items-center justify-center">
                <span className="h-2 w-2 rounded-full bg-current" />
              </span>
            ) : (
              <span className="ml-auto shrink-0 mt-0.5 h-4 w-4 rounded-full border-2 border-slate-300" />
            )}
          </button>
        );
      })}
    </div>
  );
}
