"use client";

type Props = {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
};

/**
 * Shared Inspector field wrapper.
 * Provides consistent label, optional hint, and required indicator.
 */
export default function InspectorField({
  label,
  hint,
  required,
  children,
  className = "",
}: Props) {
  return (
    <div className={className}>
      <label className="mb-1 block text-[11px] font-medium text-[var(--foreground)]">
        {label}
        {required && (
          <span className="ml-0.5 text-red-500" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {hint && (
        <p className="mb-1.5 text-[10px] leading-relaxed text-[var(--muted)]">{hint}</p>
      )}
      {children}
    </div>
  );
}
