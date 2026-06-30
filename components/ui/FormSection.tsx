import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type FormSectionProps = {
  /** Section heading. */
  title: string;
  /** Optional supporting description below the title. */
  description?: string;
  /** Optional slot for section-level actions (right side of header row). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * FormSection
 *
 * Groups a set of form fields under a titled section with optional description
 * and header-level actions. Provides a consistent two-column layout: a left
 * metadata column (title + description) and a right content column (fields).
 *
 * Usage:
 *   <FormSection title="Kontaktdaten" description="Öffentliche Kontaktinfos.">
 *     <InputField label="Name" … />
 *     <InputField label="E-Mail" … />
 *   </FormSection>
 */
export function FormSection({
  title,
  description,
  actions,
  children,
  className,
}: FormSectionProps) {
  return (
    <div
      className={cn(
        "grid gap-6 border-b border-[var(--border)] pb-8 pt-6 last:border-b-0 last:pb-0",
        "sm:grid-cols-[280px_1fr]",
        className,
      )}
    >
      {/* Left column — metadata */}
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            {title}
          </h3>
          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </div>
        {description && (
          <p className="text-xs leading-relaxed text-[var(--text-2)]">
            {description}
          </p>
        )}
      </div>

      {/* Right column — form fields */}
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}
