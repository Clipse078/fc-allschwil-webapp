"use client";

import { Globe, Monitor } from "lucide-react";
import { cn } from "@/lib/cn";
import type { WizardFormData } from "./types";

type Props = {
  websiteVisible: WizardFormData["websiteVisible"];
  infoboardVisible: WizardFormData["infoboardVisible"];
  onWebsiteVisibleChange: (value: boolean) => void;
  onInfoboardVisibleChange: (value: boolean) => void;
};

/**
 * StepPublication — Step 4 of the Team registration wizard.
 *
 * Controls seasonal visibility flags:
 *   - websiteVisible  → TeamSeason.websiteVisible
 *   - infoboardVisible → TeamSeason.infoboardVisible
 *
 * Does NOT redesign Website or Infoboard management.
 */
export default function StepPublication({
  websiteVisible,
  infoboardVisible,
  onWebsiteVisibleChange,
  onInfoboardVisibleChange,
}: Props) {
  return (
    <div className="space-y-4" role="group" aria-labelledby="publication-heading">
      <p id="publication-heading" className="sr-only">
        Veröffentlichungsoptionen
      </p>

      <ToggleRow
        icon={<Globe className="h-4 w-4" />}
        label="Auf der Website anzeigen"
        description="Das Team kann auf der öffentlichen Vereinswebsite angezeigt werden."
        checked={websiteVisible}
        onChange={onWebsiteVisibleChange}
        id="pub-website"
      />

      <ToggleRow
        icon={<Monitor className="h-4 w-4" />}
        label="Auf dem Infoboard anzeigen"
        description="Das Team kann in relevanten Infoboard-Inhalten verwendet werden."
        checked={infoboardVisible}
        onChange={onInfoboardVisibleChange}
        id="pub-infoboard"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

type ToggleRowProps = {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  id: string;
};

function ToggleRow({
  icon,
  label,
  description,
  checked,
  onChange,
  id,
}: ToggleRowProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-4 rounded-xl border px-5 py-4",
        "transition-colors hover:bg-[var(--surface-2)]",
        checked
          ? "border-[var(--sce-primary)] bg-[color-mix(in_srgb,var(--sce-primary)_4%,transparent)]"
          : "border-[var(--border)] bg-[var(--surface)]",
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          checked
            ? "bg-[color-mix(in_srgb,var(--sce-primary)_12%,transparent)] text-[var(--sce-primary)]"
            : "bg-[var(--surface-2)] text-[var(--text-3)]",
        )}
        aria-hidden="true"
      >
        {icon}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-semibold",
            checked ? "text-[var(--foreground)]" : "text-[var(--text-2)]",
          )}
        >
          {label}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-2)]">
          {description}
        </p>
      </div>

      {/* Toggle */}
      <div className="mt-0.5 shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-checked={checked}
          className="sr-only"
        />
        <div
          className={cn(
            "relative h-5 w-9 rounded-full transition-colors duration-150",
            checked ? "bg-[var(--sce-primary)]" : "bg-[var(--border-strong)]",
          )}
          aria-hidden="true"
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-150",
              checked ? "translate-x-4" : "translate-x-0.5",
            )}
          />
        </div>
      </div>
    </label>
  );
}
