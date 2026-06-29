"use client";

/**
 * components/admin/inspector/InspectorSection.tsx
 *
 * Collapsible inspector section. Used as the building block for the
 * InspectorPanel. Each section has a labelled header with a toggle
 * and an optional badge indicating modified values.
 *
 * Usage:
 *   <InspectorSection id="layout" title="Layout" icon={<Layers />} defaultOpen>
 *     <LayoutConfigPanel … />
 *   </InspectorSection>
 */

import { useState, useId } from "react";
import { ChevronDown } from "lucide-react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type InspectorSectionProps = {
  /** Stable section key — used for aria + session tracking. */
  id: string;
  /** Display title. */
  title: string;
  /** Leading icon (Lucide element). */
  icon?: React.ReactNode;
  /** Trailing badge (e.g. "Modified", count). */
  badge?: React.ReactNode;
  /** Expanded by default. */
  defaultOpen?: boolean;
  /** Controlled open state (optional). Overrides internal state if provided. */
  open?: boolean;
  /** Fired when the header is toggled. */
  onToggle?: (open: boolean) => void;
  children: React.ReactNode;
  /** Extra class on the outer wrapper. */
  className?: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InspectorSection({
  id,
  title,
  icon,
  badge,
  defaultOpen = false,
  open: controlledOpen,
  onToggle,
  children,
  className = "",
}: InspectorSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const uid = useId();
  const panelId = `inspector-section-panel-${uid}`;

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  function handleToggle() {
    const next = !isOpen;
    if (controlledOpen === undefined) setInternalOpen(next);
    onToggle?.(next);
  }

  return (
    <div
      className={`border-b border-[var(--border)] last:border-b-0 ${className}`}
      data-inspector-section={id}
    >
      {/* Header */}
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={handleToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-primary,#f97316)]"
      >
        <div className="flex min-w-0 items-center gap-2">
          {icon && (
            <span className="flex-shrink-0 text-[var(--text-2)]">{icon}</span>
          )}
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            {title}
          </span>
          {badge && <span className="flex-shrink-0">{badge}</span>}
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 flex-shrink-0 text-[var(--muted)] transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Content */}
      {isOpen && (
        <div id={panelId} className="px-4 pb-4 pt-1">
          {children}
        </div>
      )}
    </div>
  );
}
