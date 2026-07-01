import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";

type EmptyStateHelpLink = {
  /** Visible link text. */
  label: string;
  /** URL — opens in a new tab. */
  href: string;
};

type EmptyStateProps = {
  /**
   * Icon displayed in the accent chip above the heading.
   * Pass a Lucide icon or any ReactNode.
   */
  icon?: ReactNode;
  /** Short, friendly heading. */
  heading: string;
  /** Optional supporting text with more context. */
  description?: string;
  /** Primary CTA rendered below the description. */
  action?: ReactNode;
  /** Secondary CTA (e.g. import, learn more) rendered next to the primary. */
  secondaryAction?: ReactNode;
  /**
   * Optional documentation / help link shown below the CTAs.
   * Renders a small external-link row with an icon.
   */
  helpLink?: EmptyStateHelpLink;
  className?: string;
};

/**
 * EmptyState
 *
 * An onboarding-quality empty placeholder for zero-data scenarios.
 * Supports primary + secondary CTAs and an optional help link so
 * every empty page guides the user toward the next action.
 *
 * Tenant-branding-ready: icon accent uses `--sce-primary` tokens.
 *
 * Usage:
 *   <EmptyState
 *     icon={<Users className="h-10 w-10" />}
 *     heading="Noch keine Teams"
 *     description="Erstelle das erste Team für diese Saison."
 *     action={<Link href="/dashboard/teams/new" className="fca-button-primary">Erstes Team anlegen</Link>}
 *     secondaryAction={<Link href="/dashboard/teams/import" className="fca-button-secondary">Teams importieren</Link>}
 *     helpLink={{ label: "Dokumentation lesen", href: "https://docs.sportclubevo.ch/teams" }}
 *   />
 */
export function EmptyState({
  icon,
  heading,
  description,
  action,
  secondaryAction,
  helpLink,
  className,
}: EmptyStateProps) {
  const hasCtas = !!(action ?? secondaryAction);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-16 text-center",
        className,
      )}
    >
      {icon && (
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{
            background: "var(--sce-accent)",
            color: "var(--sce-primary)",
          }}
        >
          {icon}
        </div>
      )}

      <div className="max-w-sm space-y-1.5">
        <p className="text-sm font-semibold text-[var(--foreground)]">{heading}</p>
        {description && (
          <p className="text-sm leading-relaxed text-[var(--text-2)]">{description}</p>
        )}
      </div>

      {hasCtas && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}

      {helpLink && (
        <a
          href={helpLink.href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 flex items-center gap-1.5 text-xs text-[var(--muted)] transition hover:text-[var(--text-2)]"
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          {helpLink.label}
        </a>
      )}
    </div>
  );
}
