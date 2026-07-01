"use client";

/**
 * components/admin/homepage-builder/block-editors/BlockEditorShell.tsx
 *
 * Reusable primitives for Inspector-based block editors.
 *
 * Exports:
 *   CollapsibleSection  — accordion-style panel with header + chevron
 *   InspectorField      — label + optional help text wrapper
 *   SegmentedControl    — pill-style radio group
 *   MediaPlaceholder    — coming-in-Slice-G media selector placeholder
 */

import { useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Video,
  Palette,
  Layers,
} from "lucide-react";

// ---------------------------------------------------------------------------
// CollapsibleSection
// ---------------------------------------------------------------------------

type CollapsibleSectionProps = {
  title: string;
  defaultOpen?: boolean;
  badge?: string;
  children: ReactNode;
};

export function CollapsibleSection({
  title,
  defaultOpen = true,
  badge,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-[var(--border)] last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-[var(--surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sce-primary)]"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            {title}
          </span>
          {badge && (
            <span className="text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 leading-none">
              {badge}
            </span>
          )}
        </span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-[var(--muted)] shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)] shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3">{children}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// InspectorField
// ---------------------------------------------------------------------------

type InspectorFieldProps = {
  label: string;
  help?: string;
  children: ReactNode;
};

export function InspectorField({ label, help, children }: InspectorFieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--text-2)] mb-1">
        {label}
      </label>
      {children}
      {help && (
        <p className="mt-1 text-[11px] text-[var(--muted)] leading-relaxed">
          {help}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SegmentedControl
// ---------------------------------------------------------------------------

type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
};

type SegmentedControlProps<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  compact?: boolean;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  compact,
}: SegmentedControlProps<T>) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5"
      role="group"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`flex flex-1 items-center justify-center gap-1 rounded ${
            compact ? "px-1.5 py-1" : "px-2.5 py-1.5"
          } text-xs transition focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--sce-primary)] ${
            value === opt.value
              ? "bg-white text-[var(--foreground)] shadow-sm font-medium"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          {opt.icon}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MediaPlaceholder — Slice G preparation
// ---------------------------------------------------------------------------

type MediaPlaceholderType = "image" | "background" | "gradient" | "theme" | "video";

type MediaPlaceholderProps = {
  label: string;
  hint?: string;
  type?: MediaPlaceholderType;
};

const MEDIA_ICON_MAP: Record<MediaPlaceholderType, React.ElementType> = {
  image: ImageIcon,
  background: ImageIcon,
  gradient: Layers,
  theme: Palette,
  video: Video,
};

export function MediaPlaceholder({
  label,
  hint,
  type = "image",
}: MediaPlaceholderProps) {
  const Icon = MEDIA_ICON_MAP[type];
  return (
    <div className="rounded-lg border-2 border-dashed border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 flex items-center gap-3">
      <div className="h-7 w-7 rounded-md bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-[var(--muted)]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[var(--text-2)]">{label}</p>
        {hint && (
          <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-relaxed">
            {hint}
          </p>
        )}
      </div>
      <span className="shrink-0 text-[10px] font-medium text-[var(--muted)] bg-[var(--surface)] border border-[var(--border)] rounded px-1.5 py-0.5 leading-none">
        Slice G
      </span>
    </div>
  );
}
