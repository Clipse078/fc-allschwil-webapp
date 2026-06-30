import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ValidationSummaryProps = {
  /** Error messages — shown in red. Prevents form submission when present. */
  errors?: string[];
  /** Warning messages — shown in amber. Do not block form submission. */
  warnings?: string[];
  /** Informational messages — shown in blue. */
  info?: string[];
  className?: string;
};

/**
 * ValidationSummary
 *
 * Shared component for surfacing form-level validation messages.
 * Renders nothing when all arrays are empty or undefined.
 *
 * Usage:
 *   <ValidationSummary errors={["Titel ist erforderlich."]} />
 *   <ValidationSummary warnings={["Slug ist noch nicht vergeben."]} />
 *   <ValidationSummary errors={errors} warnings={warnings} info={infoMessages} />
 */
export function ValidationSummary({
  errors,
  warnings,
  info,
  className,
}: ValidationSummaryProps) {
  const hasErrors   = (errors?.length   ?? 0) > 0;
  const hasWarnings = (warnings?.length ?? 0) > 0;
  const hasInfo     = (info?.length     ?? 0) > 0;

  if (!hasErrors && !hasWarnings && !hasInfo) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {errors?.map((msg, i) => (
        <MessageRow key={i} variant="error">
          {msg}
        </MessageRow>
      ))}
      {warnings?.map((msg, i) => (
        <MessageRow key={i} variant="warning">
          {msg}
        </MessageRow>
      ))}
      {info?.map((msg, i) => (
        <MessageRow key={i} variant="info">
          {msg}
        </MessageRow>
      ))}
    </div>
  );
}

// ── Internal helper ──────────────────────────────────────────────────────────

type Variant = "error" | "warning" | "info";

const variantClass: Record<Variant, string> = {
  error:   "border-[var(--sce-danger-border)]   bg-[var(--sce-danger-light)]   text-[var(--sce-danger)]",
  warning: "border-[var(--sce-warning-border)]  bg-[var(--sce-warning-light)]  text-[var(--sce-warning)]",
  info:    "border-[var(--sce-info-border)]     bg-[var(--sce-info-light)]     text-[var(--sce-info)]",
};

function MessageRow({
  variant,
  children,
}: {
  variant: Variant;
  children: ReactNode;
}) {
  return (
    <div
      role={variant === "error" ? "alert" : undefined}
      aria-live={variant === "error" ? "assertive" : "polite"}
      className={cn(
        "rounded-lg border px-4 py-3 text-sm font-medium",
        variantClass[variant],
      )}
    >
      {children}
    </div>
  );
}
