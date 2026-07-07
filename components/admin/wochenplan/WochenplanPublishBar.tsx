"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import { parseWeekNumber, formatWochenplanVariantBadge } from "@/lib/wochenplan/format-variant-badge";

export const WEEKPLAN_VARIANT_OPTIONS = [
  { value: "Standard-Wochenplan", label: "Standard" },
  { value: "Schlechtwetter-Wochenplan", label: "Schlechtwetter" },
  { value: "Ferienplan", label: "Ferien" },
  { value: "Turnierwoche", label: "Turnierwoche" },
] as const;

export type WochenplanVariantOption = (typeof WEEKPLAN_VARIANT_OPTIONS)[number]["value"];

type WochenplanPublishBarProps = {
  hasUnsavedChanges: boolean;
  isSaving?: boolean;
  onPublish?: (variantLabel: string) => void;
  weekId?: string;
  activeVariantLabel?: string | null;
  eventCount?: number;
  conflictCount?: number;
};

function getReadiness(eventCount: number, conflictCount: number, hasUnsavedChanges: boolean) {
  if (eventCount === 0) return { label: "Entwurf", detail: "Noch keine Events in dieser Woche.", className: "border-slate-200 bg-slate-50 text-slate-600" };
  if (conflictCount > 0) return { label: "Pruefen", detail: conflictCount + " offene Konflikte.", className: "border-amber-200 bg-amber-50 text-amber-700" };
  if (hasUnsavedChanges) return { label: "Bereit", detail: "Aenderungen koennen publiziert werden.", className: "border-blue-200 bg-blue-50 text-blue-700" };
  return { label: "Stabil", detail: "Keine neuen Grid-Aenderungen.", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
}

export default function WochenplanPublishBar({
  hasUnsavedChanges,
  isSaving = false,
  onPublish,
  weekId,
  activeVariantLabel,
  eventCount = 0,
  conflictCount = 0,
}: WochenplanPublishBarProps) {
  const [selectedVariant, setSelectedVariant] = useState<string>(activeVariantLabel ?? "Standard-Wochenplan");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customLabel, setCustomLabel] = useState("");

  const effectiveLabel = showCustomInput && customLabel.trim() ? customLabel.trim() : selectedVariant;
  const weekNumber = weekId ? parseWeekNumber(weekId) : null;
  const readiness = getReadiness(eventCount, conflictCount, hasUnsavedChanges);
  const activeVariantBadge = activeVariantLabel && weekId ? formatWochenplanVariantBadge(weekId, activeVariantLabel) : activeVariantLabel ? activeVariantLabel + " aktiv" : null;

  function publish() {
    if (!onPublish) return;
    onPublish(effectiveLabel);
  }

  return (
    <AdminSurfaceCard className="border-slate-200 bg-white/90 px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Publikation</p>
            <span className={"inline-flex rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold " + readiness.className}>{readiness.label}</span>
            {activeVariantBadge ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[0.7rem] font-semibold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                {activeVariantBadge}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[0.75rem] text-slate-500">{weekId ? "Woche " + weekId + " - " : ""}{readiness.detail}</p>
        </div>

        <div className="flex flex-col gap-2 2xl:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
              {WEEKPLAN_VARIANT_OPTIONS.map((option) => {
                const active = !showCustomInput && selectedVariant === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={isSaving}
                    onClick={() => { setSelectedVariant(option.value); setShowCustomInput(false); }}
                    className={active ? "rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-sm" : "rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-white hover:text-slate-900 disabled:opacity-50"}
                  >
                    {option.label}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setShowCustomInput(true)}
                className={showCustomInput ? "rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-sm" : "rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-white hover:text-slate-900 disabled:opacity-50"}
              >
                Eigen
              </button>
            </div>

            {showCustomInput ? (
              <input
                autoFocus
                value={customLabel}
                onChange={(event) => setCustomLabel(event.target.value)}
                placeholder="Variante eingeben"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
              />
            ) : null}

            <button
              type="button"
              disabled={!hasUnsavedChanges || isSaving || (showCustomInput && !customLabel.trim())}
              onClick={publish}
              className={hasUnsavedChanges && !isSaving ? "fca-button-primary flex items-center gap-2" : "fca-button-primary flex items-center gap-2 cursor-not-allowed opacity-50"}
              title={hasUnsavedChanges ? "Wochenplan publizieren als: " + effectiveLabel : "Noch keine neuen Aenderungen auf dem Grid"}
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {isSaving ? "Publiziert..." : "Publizieren"}
            </button>
          </div>

          {!isSaving && hasUnsavedChanges && weekNumber !== null ? (
            <p className="text-[0.7rem] text-slate-400">Oeffentlich: KW {weekNumber} | {effectiveLabel} aktiv</p>
          ) : null}
        </div>
      </div>
    </AdminSurfaceCard>
  );
}