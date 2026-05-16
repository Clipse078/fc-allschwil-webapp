import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

type WochenplanPublishBarProps = {
  hasUnsavedChanges: boolean;
};

export default function WochenplanPublishBar({
  hasUnsavedChanges,
}: WochenplanPublishBarProps) {
  return (
    <AdminSurfaceCard className="p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="fca-eyebrow">Publish Status</p>
          <h3 className="fca-subheading mt-2">Website & Infoboard</h3>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!hasUnsavedChanges}
            className={
              hasUnsavedChanges
                ? "fca-button-primary"
                : "fca-button-primary opacity-50 cursor-not-allowed"
            }
            title={
              hasUnsavedChanges
                ? "Lokale Änderungen sind bereit zum Publizieren"
                : "Noch keine neuen Änderungen auf dem Grid"
            }
          >
            Für Website & Infoboard publizieren
          </button>
        </div>
      </div>
    </AdminSurfaceCard>
  );
}
