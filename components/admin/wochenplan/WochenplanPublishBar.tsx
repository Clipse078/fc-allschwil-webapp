import { CheckCircle2, Loader2 } from "lucide-react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

type WochenplanPublishBarProps = {
  hasUnsavedChanges: boolean;
  isSaving?: boolean;
  onPublish?: () => void;
  weekId?: string;
};

export default function WochenplanPublishBar({
  hasUnsavedChanges,
  isSaving = false,
  onPublish,
  weekId,
}: WochenplanPublishBarProps) {
  return (
    <AdminSurfaceCard className="p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="fca-eyebrow">Publish Status</p>
          <h3 className="fca-subheading mt-2">Wochenplan publizieren</h3>
          {weekId ? (
            <p className="mt-1 text-[0.75rem] text-[var(--muted)]">
              Woche {weekId} — Alle platzierten Events auf Wochenplan setzen.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Pitch allocation is auto-saved on drag/room change */}
          <p className="text-[0.75rem] text-[var(--muted)]">
            Platz- und Garderoben-Zuteilung wird automatisch gespeichert.
          </p>

          <button
            type="button"
            disabled={!hasUnsavedChanges || isSaving}
            onClick={onPublish}
            className={
              hasUnsavedChanges && !isSaving
                ? "fca-button-primary flex items-center gap-2"
                : "fca-button-primary flex items-center gap-2 opacity-50 cursor-not-allowed"
            }
            title={
              hasUnsavedChanges
                ? "Alle Events dieser Woche auf Wochenplan publizieren"
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
      </div>
    </AdminSurfaceCard>
  );
}
