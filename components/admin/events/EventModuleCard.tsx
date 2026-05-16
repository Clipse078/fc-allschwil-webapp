import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

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
        glow: "shadow-[0_18px_40px_rgba(199,51,44,0.08)]",
        icon: "text-red-600 border-red-100 bg-red-50",
      };
    case "green":
      return {
        glow: "shadow-[0_18px_40px_rgba(34,197,94,0.10)]",
        icon: "text-emerald-600 border-emerald-100 bg-emerald-50",
      };
    case "amber":
      return {
        glow: "shadow-[0_18px_40px_rgba(245,158,11,0.10)]",
        icon: "text-amber-600 border-amber-100 bg-amber-50",
      };
    case "blue":
    default:
      return {
        glow: "shadow-[0_18px_40px_rgba(59,130,246,0.10)]",
        icon: "text-[#0b4aa2] border-blue-100 bg-blue-50",
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

  const content = (
    <AdminSurfaceCard className={"h-full p-6 transition hover:-translate-y-[2px] " + styles.glow}>
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="fca-eyebrow">{eyebrow}</p>
            <h3 className="fca-heading mt-2">{title}</h3>
          </div>

          <div className={"flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border " + styles.icon}>
            <Icon className="h-5 w-5" />
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-600">{description}</p>

        <div className="mt-5 space-y-4">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Datenquellen
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {sources.map((source) => (
                <span key={source} className="fca-pill">
                  {source}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Ausspielung
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {outputs.map((output) => (
                <span key={output} className="fca-pill">
                  {output}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-2">
          {href ? (
            <span className="fca-button-primary inline-flex">Bereich öffnen</span>
          ) : (
            <span className="fca-pill">Foundation</span>
          )}
        </div>
      </div>
    </AdminSurfaceCard>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="block h-full">
      {content}
    </Link>
  );
}