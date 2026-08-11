import { cn } from "@/lib/cn";

export type DashboardWelcomeProps = {
  /** Personalised greeting line (e.g. "Guten Morgen, Michael"). */
  greeting: string;
  /** Optional supporting subtitle below the greeting. */
  subtitle?: string;
  className?: string;
};

/**
 * DashboardWelcome
 *
 * Greeting text block for the dashboard hero area.
 * Renders the primary greeting heading and an optional subtitle.
 * Composable — used inside DashboardHero or standalone.
 *
 * Usage:
 *   <DashboardWelcome
 *     greeting="Guten Morgen, Michael 👋"
 *     subtitle="Schön, dich wiederzusehen."
 *   />
 */
export function DashboardWelcome({
  greeting,
  subtitle,
  className,
}: DashboardWelcomeProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <h1 className="text-[1.5rem] font-bold leading-tight tracking-tight text-[var(--foreground)]">
        {greeting}
      </h1>
      {subtitle && (
        <p className="text-sm leading-relaxed text-[var(--text-2)]">{subtitle}</p>
      )}
    </div>
  );
}
