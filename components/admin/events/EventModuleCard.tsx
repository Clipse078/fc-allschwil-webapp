import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type EventModuleCardProps = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  sources: string[];
  outputs: string[];
  href?: string;
  accent?: "blue" | "red" | "green" | "amber";
};

function getAccentClasses(accent: EventModuleCardProps["accent"]) {
  switch (accent) {
    case "red":
      return {
        iconClass: "border-red-200 bg-red-50 text-red-600",
        sourceBadge: "border-red-200 bg-red-50 text-red-700",
      };
    case "green":
      return {
        iconClass: "border-emerald-200 bg-emerald-50 text-emerald-600",
        sourceBadge: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "amber":
      return {
        iconClass: "border-amber-200 bg-amber-50 text-amber-600",
        sourceBadge: "border-amber-200 bg-amber-50 text-amber-700",
      };
    case "blue":
    default:
      return {
        iconClass: "border-blue-200 bg-blue-50 text-[var(--blue)]",
        sourceBadge: "border-blue-200 bg-blue-50 text-blue-700",
      };
  }
}

export default function EventModuleCard({
  icon: Icon,
  eyebrow,
  title,
  description,
  sources,
  outputs,
  href,
  accent = "blue",
}: EventModuleCardProps) {
  const styles = getAccentClasses(accent);

  const inner = (
    <div className="sce-detail-section h-full transition-all hover:-translate-y-[1px] hover:shadow-[var(--shadow-md)]">
      <div className="sce-detail-section-header">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${styles.iconClass}`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="sce-data-label">{eyebrow}</p>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {title}
            </p>
          </div>
        </div>
      </div>

      <div className="sce-detail-section-body space-y-4">
        <p className="text-sm text-[var(--muted)]">{description}</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="sce-data-label mb-1.5">Datenquellen</p>
            <div className="flex flex-wrap gap-1.5">
              {sources.map((source) => (
                <span
                  key={source}
                  className={`inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold ${styles.sourceBadge}`}
                >
                  {source}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="sce-data-label mb-1.5">Ausspielung</p>
            <div className="flex flex-wrap gap-1.5">
              {outputs.map((output) => (
                <span
                  key={output}
                  className="inline-flex h-5 items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 text-[0.65rem] font-semibold text-[var(--muted)]"
                >
                  {output}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!href) {
    return inner;
  }

  return (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  );
}
