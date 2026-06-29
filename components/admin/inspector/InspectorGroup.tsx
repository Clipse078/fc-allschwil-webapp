"use client";

/**
 * components/admin/inspector/InspectorGroup.tsx
 *
 * Groups related inspector fields under an optional sub-label.
 * Provides visual separation between field clusters within a section.
 *
 * Usage:
 *   <InspectorGroup label="Text">
 *     <InspectorField label="Eyebrow">…</InspectorField>
 *     <InspectorField label="Headline">…</InspectorField>
 *   </InspectorGroup>
 */

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type InspectorGroupProps = {
  /** Optional sub-heading above the group. */
  label?: string;
  children: React.ReactNode;
  className?: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InspectorGroup({
  label,
  children,
  className = "",
}: InspectorGroupProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {label && (
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">
          {label}
        </p>
      )}
      {children}
    </div>
  );
}
