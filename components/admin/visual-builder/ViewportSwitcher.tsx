"use client";

/**
 * components/admin/visual-builder/ViewportSwitcher.tsx
 *
 * Viewport mode selector for the Visual Canvas.
 * Allows editors to preview the canvas at different device widths.
 *
 * Viewport widths:
 *   Desktop — unconstrained (100% of available canvas)
 *   Laptop  — 1280px max
 *   Tablet  — 768px max
 *   Mobile  — 375px max
 */

import { Monitor, Laptop, Tablet, Smartphone } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ViewportMode = "desktop" | "laptop" | "tablet" | "mobile";

export type ViewportConfig = {
  label: string;
  icon: React.ElementType;
  maxWidth: string;
  badge: string;
};

// ---------------------------------------------------------------------------
// Viewport configuration
// ---------------------------------------------------------------------------

export const VIEWPORT_CONFIGS: Record<ViewportMode, ViewportConfig> = {
  desktop: { label: "Desktop", icon: Monitor, maxWidth: "100%", badge: "100%" },
  laptop: { label: "Laptop", icon: Laptop, maxWidth: "1280px", badge: "1280" },
  tablet: { label: "Tablet", icon: Tablet, maxWidth: "768px", badge: "768" },
  mobile: { label: "Mobile", icon: Smartphone, maxWidth: "375px", badge: "375" },
};

export const VIEWPORT_MODES: ViewportMode[] = ["desktop", "laptop", "tablet", "mobile"];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ViewportSwitcherProps = {
  mode: ViewportMode;
  onChange: (mode: ViewportMode) => void;
  className?: string;
};

// ---------------------------------------------------------------------------
// ViewportSwitcher
// ---------------------------------------------------------------------------

export default function ViewportSwitcher({ mode, onChange, className = "" }: ViewportSwitcherProps) {
  return (
    <div
      className={`flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5 ${className}`}
    >
      {VIEWPORT_MODES.map((vm) => {
        const cfg = VIEWPORT_CONFIGS[vm];
        const Icon = cfg.icon;
        const isActive = mode === vm;
        return (
          <button
            key={vm}
            type="button"
            onClick={() => onChange(vm)}
            title={`${cfg.label} (${cfg.badge}px)`}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition-all ${
              isActive
                ? "bg-[var(--surface)] font-medium text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--text-2)]"
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">{cfg.label}</span>
          </button>
        );
      })}
    </div>
  );
}
