import EventImportClubcornerCard from "@/components/admin/events/EventImportClubcornerCard";
import EventImportCsvCard from "@/components/admin/events/EventImportCsvCard";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

export default function EventImportHub() {
  return (
    <div className="space-y-6">
      <AdminSurfaceCard className="p-6">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <div>
            <p className="fca-eyebrow">Import foundation</p>
            <h2 className="fca-heading mt-2">Mehrquellige Event-Ingestion</h2>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
              Hier bündeln wir künftig externe und manuelle Datenzuflüsse in die zentrale
              Events Domain. Jeder Lauf wird als Import Run protokolliert, damit ClubCorner,
              CSV / Excel und spätere Updates sauber nachvollziehbar bleiben.
            </p>
          </div>

          <div className="fca-section-card p-5">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Foundation Status
            </p>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p>CSV / Excel Endpoint vorbereitet</p>
              <p>ClubCorner / fvnws Endpoint vorbereitet</p>
              <p>Import Run Datenmodell vorbereitet</p>
            </div>
          </div>
        </div>
      </AdminSurfaceCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <EventImportCsvCard />
        <EventImportClubcornerCard />
      </div>
    </div>
  );
}