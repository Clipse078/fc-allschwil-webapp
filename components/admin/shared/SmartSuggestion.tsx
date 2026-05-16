import Link from "next/link";
import { Sparkles } from "lucide-react";

type GuidanceTone = "neutral" | "blue" | "amber";

type GuidanceCardProps = {
  eyebrow?: string;
  title: string;
  description: string;
  nextAction?: string;
  actionHref?: string;
  actionLabel?: string;
  tone?: GuidanceTone;
  compact?: boolean;
};

const TONE_CLASSES: Record<GuidanceTone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
  blue: "border-blue-100 bg-blue-50 text-[#0b4aa2]",
  amber: "border-amber-100 bg-amber-50 text-amber-700",
};

export function GuidanceCard({
  eyebrow = "Smart suggestion",
  title,
  description,
  nextAction,
  actionHref,
  actionLabel,
  tone = "blue",
  compact = false,
}: GuidanceCardProps) {
  return (
    <aside
      className={`rounded-[22px] border ${TONE_CLASSES[tone]} ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/70">
          <Sparkles className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] opacity-70">
            {eyebrow}
          </p>
          <h4 className="mt-1 text-sm font-semibold text-slate-900">{title}</h4>
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>

          {nextAction ? (
            <p className="mt-2 text-xs font-medium text-slate-700">
              Nächster Schritt: {nextAction}
            </p>
          ) : null}

          {actionHref && actionLabel ? (
            <Link
              href={actionHref}
              className="mt-3 inline-flex rounded-full border border-white/80 bg-white px-3 py-1.5 text-xs font-semibold text-[#0b4aa2] shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
            >
              {actionLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

export default function SmartSuggestion(props: GuidanceCardProps) {
  return <GuidanceCard {...props} />;
}
