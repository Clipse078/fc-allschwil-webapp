"use client";

import { ChevronDown, ChevronRight } from "lucide-react";

type Props = {
  id: string;
  title: string;
  icon?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  /** Highlight this section when it matches a search query */
  searchMatch?: boolean;
  disabled?: boolean;
};

/**
 * Collapsible Inspector accordion section.
 * Figma/Framer-style: compact header, smooth CSS-grid expand/collapse,
 * keyboard accessible with ARIA attributes.
 */
export default function InspectorSection({
  id,
  title,
  icon,
  isOpen,
  onToggle,
  children,
  searchMatch,
  disabled,
}: Props) {
  return (
    <div
      className={`border-b border-[var(--border)] last:border-b-0 ${
        searchMatch && !isOpen ? "bg-amber-50/30" : ""
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        id={`inspector-section-${id}`}
        aria-expanded={isOpen}
        aria-controls={`inspector-section-content-${id}`}
        className={`group flex w-full items-center gap-2 px-3.5 py-2.5 text-left transition-colors duration-100 hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-primary,#f97316)] disabled:cursor-not-allowed disabled:opacity-50 ${
          isOpen ? "bg-[var(--surface-2)/40]" : ""
        }`}
      >
        {icon && (
          <span
            className={`flex h-4 w-4 flex-shrink-0 items-center justify-center transition-colors duration-100 ${
              isOpen
                ? "text-[var(--brand-primary,#f97316)]"
                : "text-[var(--muted)] group-hover:text-[var(--text-2)]"
            }`}
          >
            {icon}
          </span>
        )}

        <span
          className={`flex-1 select-none text-[11px] font-semibold uppercase tracking-[0.07em] transition-colors duration-100 ${
            isOpen ? "text-[var(--foreground)]" : "text-[var(--text-2)]"
          }`}
        >
          {title}
        </span>

        {searchMatch && (
          <span
            className="mr-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400"
            aria-label="Suchergebnis"
          />
        )}

        <span
          className={`flex-shrink-0 transition-colors duration-100 ${
            isOpen
              ? "text-[var(--text-2)]"
              : "text-[var(--muted)] group-hover:text-[var(--text-2)]"
          }`}
        >
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </span>
      </button>

      {/* CSS-grid accordion animation — no JS height measurement needed */}
      <div
        id={`inspector-section-content-${id}`}
        role="region"
        aria-labelledby={`inspector-section-${id}`}
        className={`inspector-accordion-body ${isOpen ? "is-open" : ""}`}
      >
        <div>
          <div className="px-3.5 pb-4 pt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}
