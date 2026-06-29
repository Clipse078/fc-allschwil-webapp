"use client";

/**
 * components/admin/inspector/InspectorField.tsx
 *
 * Reusable field wrapper for inspector controls. Renders a label,
 * optional hint, and the field content (children).
 *
 * Usage:
 *   <InspectorField label="Eyebrow" hint="Short label above the headline">
 *     <input … />
 *   </InspectorField>
 */

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type InspectorFieldProps = {
  label: string;
  hint?: string;
  required?: boolean;
  /** When true, label and children are rendered side-by-side (compact row). */
  inline?: boolean;
  children: React.ReactNode;
  className?: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InspectorField({
  label,
  hint,
  required,
  inline = false,
  children,
  className = "",
}: InspectorFieldProps) {
  if (inline) {
    return (
      <div className={`flex items-center justify-between gap-3 ${className}`}>
        <div className="min-w-0 flex-1">
          <span className="text-xs font-medium text-[var(--foreground)]">
            {label}
            {required && <span className="ml-0.5 text-rose-500">*</span>}
          </span>
          {hint && (
            <p className="text-[10px] text-[var(--muted)]">{hint}</p>
          )}
        </div>
        <div className="flex-shrink-0">{children}</div>
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-xs font-medium text-[var(--foreground)]">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {hint && (
        <p className="text-[11px] text-[var(--muted)]">{hint}</p>
      )}
      {children}
    </div>
  );
}
