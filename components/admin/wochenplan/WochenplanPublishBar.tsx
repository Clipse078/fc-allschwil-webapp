"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import {
  parseWeekNumber,
  formatWochenplanVariantBadge,
} from "@/lib/wochenplan/format-variant-badge";

type WochenplanPublishBarProps = {
  hasUnsavedChanges: boolean;
  isSaving?: boolean;
  onPublish?: (variantLabel: string) => void;
  weekId?: string;
  /** Currently active publication for this week, if any. */
  activeVariantLabel?: string | null;
  /** WOCHENPLAN-2.0-01B — tenant's active plan name. */
  activePlanName?: string | null;
};

export default function WochenplanPublishBar({
  hasUnsavedChanges,
  isSaving = false,
  onPublish,
  weekId,
  activeVariantLabel,
  activePlanName,
}: WochenplanPublishBarProps) {
  const effectiveLabel = activePlanName?.trim() || activeVariantLabel || "Wochenplan";

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
    <AdminSurfaceCard className="p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="fca-eyebrow">Publish Status</p>
          <h3 className="fca-subheading mt-2">Wochenplan publizieren</h3>
          {weekId ? (
            <p className="mt-1 text-[0.75rem] text-[var(--muted)]">
              Woche {weekId} — Aktiver Plan: {effectiveLabel}
            </p>
          ) : null}

          {activeVariantBadge ? (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3 w-3" />
              {activeVariantBadge}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <p className="text-[0.75rem] text-[var(--muted)]">
            Platz- und Garderoben-Zuteilung wird automatisch gespeichert.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!hasUnsavedChanges || isSaving}
              onClick={handlePublish}
              className={
                hasUnsavedChanges && !isSaving
                  ? "fca-button-primary flex items-center gap-2"
                  : "fca-button-primary flex items-center gap-2 cursor-not-allowed opacity-50"
              }
              title={
                hasUnsavedChanges
                  ? `Wochenplan publizieren als: ${effectiveLabel}`
                  : "Noch keine neuen Änderungen auf dem Grid"
              }
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {isSaving ? "Publiziert…" : "Wochenplan publizieren"}
            </button>
          </div>

          {!isSaving && hasUnsavedChanges && weekNumber !== null ? (
            <p className="text-[0.7rem] text-slate-400">
              Öffentlich: &ldquo;KW {weekNumber} | {effectiveLabel} aktiv&rdquo;
            </p>
          ) : null}
        </div>
      </div>
    </AdminSurfaceCard>
  );
}

