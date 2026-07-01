import { Clock } from "lucide-react";
import { SectionCard } from "@/components/ui/page";
import { cn } from "@/lib/cn";

type TimelinePlaceholderProps = {
  /** Card section title. Defaults to "Aktivität". */
  title?: string;
  className?: string;
};

/**
 * TimelinePlaceholder
 *
 * SportClubEvo Design System primitive.
 * A reserved placeholder card for the per-entity activity timeline.
 * Renders a muted "coming soon" state in the detail page sidebar until
 * the real audit / activity feed is implemented.
 *
 * Usage:
 *   <TimelinePlaceholder />
 *   <TimelinePlaceholder title="Verlauf" />
 */
export function TimelinePlaceholder({
  title = "Aktivität",
  className,
}: TimelinePlaceholderProps) {
  return (
    <SectionCard title={title} className={cn(className)}>
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <Clock
          className="h-7 w-7 text-[var(--muted)]"
          aria-hidden="true"
          strokeWidth={1.5}
        />
        <p className="text-sm font-medium text-[var(--muted)]">
          Aktivitätsprotokoll
        </p>
        <p className="max-w-[200px] text-xs leading-relaxed text-[var(--muted)]">
          Änderungsverlauf wird in einem zukünftigen Update verfügbar sein.
        </p>
      </div>
    </SectionCard>
  );
}
