import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type BaseProps = {
  children: ReactNode;
  className?: string;
};

/**
 * PageEyebrow
 *
 * Small uppercase label placed above the page title.
 * Uses the tenant secondary (accent) color for brand identity.
 *
 * Example: "Organisation", "Website", "Teams"
 */
export function PageEyebrow({ children, className }: BaseProps) {
  return (
    <p className={cn("fca-eyebrow", className)}>{children}</p>
  );
}

/**
 * PageTitle
 *
 * Primary h1 for each page. Calm, semibold, Inter — no display font,
 * no uppercase, no aggressive sizing. Premium SaaS look.
 */
export function PageTitle({ children, className }: BaseProps) {
  return (
    <h1 className={cn("fca-heading", className)}>{children}</h1>
  );
}

/**
 * PageSubtitle
 *
 * Supporting description below the page title. Muted gray, consistent
 * size and line-height on every page.
 */
export function PageSubtitle({ children, className }: BaseProps) {
  return (
    <p className={cn("fca-body-muted max-w-2xl", className)}>{children}</p>
  );
}

/**
 * SectionTitle
 *
 * h2 for in-page sections or card headers. Slightly smaller than PageTitle,
 * same weight and tracking. Can render as h2 or h3 via `as` prop.
 */
export function SectionTitle({
  children,
  className,
  as: Tag = "h2",
}: BaseProps & { as?: "h2" | "h3" | "p" }) {
  return (
    <Tag className={cn("fca-subheading", className)}>{children}</Tag>
  );
}

/**
 * SectionDescription
 *
 * Short description below a section title. Same size/line-height everywhere.
 */
export function SectionDescription({ children, className }: BaseProps) {
  return (
    <p className={cn("text-[0.8125rem] text-[var(--text-2)] leading-relaxed", className)}>
      {children}
    </p>
  );
}

/**
 * CardKpiLabel
 *
 * Micro uppercase label inside KPI/data cards.
 * Uses the canonical sce-data-label style.
 */
export function CardKpiLabel({ children, className }: BaseProps) {
  return (
    <p className={cn("sce-data-label", className)}>{children}</p>
  );
}

/**
 * EmptyStateTitle
 *
 * Short friendly heading for zero-data placeholders.
 */
export function EmptyStateTitle({ children, className }: BaseProps) {
  return (
    <p className={cn("text-[0.9375rem] font-semibold text-[var(--foreground)]", className)}>
      {children}
    </p>
  );
}

/**
 * EmptyStateText
 *
 * Supporting text below EmptyStateTitle. Muted, consistent size.
 */
export function EmptyStateText({ children, className }: BaseProps) {
  return (
    <p className={cn("text-sm text-[var(--text-2)]", className)}>{children}</p>
  );
}
