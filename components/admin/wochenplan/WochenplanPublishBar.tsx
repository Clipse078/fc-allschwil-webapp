"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, ChevronDown } from "lucide-react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import {
  parseWeekNumber,
  formatWochenplanVariantBadge,
} from "@/lib/wochenplan/format-variant-badge";

// â”€â”€ Variant options â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const WEEKPLAN_VARIANT_OPTIONS = [
  { value: "Standard-Wochenplan", label: "Standard-Wochenplan" },
  { value: "Schlechtwetter-Wochenplan", label: "Schlechtwetter-Wochenplan" },
  { value: "Ferienplan", label: "Ferienplan" },
  { value: "Turnierwoche", label: "Turnierwoche" },
] as const;

export type WochenplanVariantOption = (typeof WEEKPLAN_VARIANT_OPTIONS)[number]["value"];

// â”€â”€ Props â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type WochenplanPublishBarProps = {
  hasUnsavedChanges: boolean;
  isSaving?: boolean;
  onPublish?: (variantLabel: string) => void;
  weekId?: string;
  /** Currently active publication for this week, if any. */
  activeVariantLabel?: string | null;
};

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function WochenplanPublishBar({
  hasUnsavedChanges,
  isSaving = false,
  onPublish,
  weekId,
  activeVariantLabel,
}: WochenplanPublishBarProps) {
  const [selectedVariant, setSelectedVariant] = useState<string>(
    activeVariantLabel ?? "Standard-Wochenplan",
  );
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customLabel, setCustomLabel] = useState("");

  const effectiveLabel = showCustomInput && customLabel.trim()
    ? customLabel.trim()
    : selectedVariant;

  function handleVariantChange(value: string) {
    if (value === "__custom__") {
      setShowCustomInput(true);
    } else {
      setShowCustomInput(false);
      setSelectedVariant(value);
    }
  }

  function handlePublish() {
    if (!onPublish) return;
    onPublish(effectiveLabel);
  }

  const weekNumber = weekId ? parseWeekNumber(weekId) : null;
  const activeVariantBadge =
    activeVariantLabel && weekId
      ? formatWochenplanVariantBadge(weekId, activeVariantLabel)
      : activeVariantLabel
        ? `${activeVariantLabel} aktiv`
        : null;

  return (
    <AdminSurfaceCard className="border-slate-200 bg-white/90 px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="fca-eyebrow">Publikation</p>
          
          {weekId ? (
            <p className="mt-1 text-[0.75rem] text-slate-500">
              Woche {weekId} â€” Variante pruefen und bewusst publizieren.
            </p>
          ) : null}

          {/* Active variant badge */}
          {activeVariantBadge ? (
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[0.7rem] font-semibold text-emerald-700">
              <CheckCircle2 className="h-3 w-3" />
              {activeVariantBadge}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          {/* Pitch allocation auto-save notice */}
          <p className="hidden text-[0.75rem] text-slate-500">
            Platz- und Garderobenzuteilungen werden automatisch gespeichert. Die Publikation bleibt ein bewusster Schritt.
          </p>

          {/* Variant selector */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <select
                value={showCustomInput ? "__custom__" : selectedVariant}
                onChange={(e) => handleVariantChange(e.target.value)}
                disabled={isSaving}
                className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20 disabled:opacity-50"
              >
                {WEEKPLAN_VARIANT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
                <option value="__custom__">Benutzerdefiniertâ€¦</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            {showCustomInput ? (
              <input
                autoFocus
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Variante eingebenâ€¦"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
              />
            ) : null}

            <button
              type="button"
              disabled={!hasUnsavedChanges || isSaving || (showCustomInput && !customLabel.trim())}
              onClick={handlePublish}
              className={
                hasUnsavedChanges && !isSaving
                  ? "fca-button-primary flex items-center gap-2"
                  : "fca-button-primary flex items-center gap-2 cursor-not-allowed opacity-50"
              }
              title={
                hasUnsavedChanges
                  ? `Wochenplan publizieren als: ${effectiveLabel}`
                  : "Noch keine neuen Ã„nderungen auf dem Grid"
              }
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {isSaving ? "Publiziertâ€¦" : "Publizieren"}
            </button>
          </div>

          {/* Preview of the variant badge that will be displayed publicly */}
          {!isSaving && hasUnsavedChanges && weekNumber !== null ? (
            <p className="text-[0.7rem] text-slate-400">
              Ã–ffentlich: &ldquo;KW {weekNumber} | {effectiveLabel} aktiv&rdquo;
            </p>
          ) : null}
        </div>
      </div>
    </AdminSurfaceCard>
  );
}

