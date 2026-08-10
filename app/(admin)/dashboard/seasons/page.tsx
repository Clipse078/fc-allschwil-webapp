import { CalendarDays } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getSeasonsOverviewData } from "@/lib/seasons/queries";
import { suggestNextSeasonStartYear } from "@/lib/seasons/mutations";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import CreateSeasonForm from "@/components/admin/seasons/CreateSeasonForm";
import SeasonRowCard from "@/components/admin/seasons/SeasonRowCard";

type SeasonsPageProps = {
  searchParams?: Promise<{
    status?: string;
  }>;
};

type FeedbackBanner = {
  boxClass: string;
  text: string;
};

function getFeedbackBanner(status?: string): FeedbackBanner | null {
  switch (status) {
    case "create-success":
      return { boxClass: "fca-status-box-success", text: "Die Saison wurde erfolgreich erstellt." };
    case "create-exists":
      return { boxClass: "fca-status-box-warn", text: "Diese Saison existiert bereits." };
    case "create-invalid":
      return { boxClass: "fca-status-box-error", text: "Die Saison konnte nicht erstellt werden. Bitte ein gültiges Startjahr angeben." };
    case "update-success":
      return { boxClass: "fca-status-box-success", text: "Die Saison wurde erfolgreich aktualisiert." };
    case "update-invalid":
      return { boxClass: "fca-status-box-error", text: "Die Saison konnte nicht aktualisiert werden. Bitte Angaben prüfen." };
    case "update-not-found":
      return { boxClass: "fca-status-box-error", text: "Die gewählte Saison wurde nicht gefunden." };
    case "update-missing-id":
      return { boxClass: "fca-status-box-error", text: "Es wurde keine Saison-ID zur Bearbeitung übergeben." };
    case "delete-success":
      return { boxClass: "fca-status-box-success", text: "Die Saison wurde erfolgreich gelöscht." };
    case "delete-has-dependencies":
      return {
        boxClass: "fca-status-box-error",
        text: "Diese Saison kann nicht gelöscht werden, da sie noch referenziert wird (Teams, Events oder andere Daten).",
      };
    case "delete-not-found":
      return { boxClass: "fca-status-box-error", text: "Die gewählte Saison wurde nicht gefunden." };
    case "delete-missing-id":
      return { boxClass: "fca-status-box-error", text: "Es wurde keine Saison-ID zur Löschung übergeben." };
    case "forbidden":
      return { boxClass: "fca-status-box-error", text: "Du hast keine Berechtigung, um Saisons zu verwalten." };
    default:
      return null;
  }
}

export default async function SeasonsPage({ searchParams }: SeasonsPageProps) {
  const session = await requireAnyPermission([
    PERMISSIONS.SEASONS_VIEW,
    PERMISSIONS.SEASONS_MANAGE,
  ]);
  const canManage = hasPermission(session, PERMISSIONS.SEASONS_MANAGE);

  const params = (await searchParams) ?? {};
  const seasons = await getSeasonsOverviewData();
  const feedback = getFeedbackBanner(params.status);

  const currentCount = seasons.filter((s) => s.currentStatus === "AKTUELL").length;
  const pastCount = seasons.filter((s) => s.currentStatus === "VERGANGEN").length;
  const futureCount = seasons.filter((s) => s.currentStatus === "ZUKUENFTIG").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <AdminSectionHeader
        eyebrow="Saisons"
        title="Saisonverwaltung"
        description="Saisons sind Klassifikation/Kontext für Teams und Events. Beliebig viele sinnvolle Saisons können parallel existieren — genau eine ist als aktuell gesetzt."
      />

      {/* Feedback */}
      {feedback ? <div className={`fca-status-box ${feedback.boxClass}`}>{feedback.text}</div> : null}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="sce-kpi-card">
          <p className="sce-data-label">Saisons</p>
          <p className="mt-1.5 text-2xl font-bold text-[var(--foreground)]" style={{ fontFamily: "var(--font-display)" }}>
            {seasons.length}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Total</p>
        </div>

        <div className="sce-kpi-card">
          <p className="sce-data-label">Aktuell</p>
          <p className="mt-1.5 text-2xl font-bold text-emerald-600" style={{ fontFamily: "var(--font-display)" }}>
            {currentCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">explizit gesetzte Saison</p>
        </div>

        <div className="sce-kpi-card">
          <p className="sce-data-label">Zukünftig</p>
          <p className="mt-1.5 text-2xl font-bold text-amber-600" style={{ fontFamily: "var(--font-display)" }}>
            {futureCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">noch nicht aktuell</p>
        </div>

        <div className="sce-kpi-card">
          <p className="sce-data-label">Vergangen</p>
          <p className="mt-1.5 text-2xl font-bold text-[var(--foreground)]" style={{ fontFamily: "var(--font-display)" }}>
            {pastCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">abgeschlossene Saisons</p>
        </div>
      </div>

      {/* Create form */}
      {canManage ? <CreateSeasonForm suggestedStartYear={suggestNextSeasonStartYear()} /> : null}

      {/* Empty state */}
      {seasons.length === 0 ? (
        <div className="sce-detail-section">
          <div className="sce-detail-section-body flex flex-col items-center justify-center gap-3 py-16 text-center">
            <CalendarDays className="h-10 w-10 text-[var(--muted)]" />
            <p className="font-semibold text-[var(--foreground)]">Noch keine Saisons</p>
            <p className="text-sm text-[var(--muted)]">Erstelle die erste Saison über das Formular oben.</p>
          </div>
        </div>
      ) : null}

      {/* Season rows */}
      {seasons.map((season) => (
        <SeasonRowCard
          key={season.id}
          id={season.id}
          seasonKey={season.key}
          name={season.name}
          isActive={season.isActive}
          startDate={season.startDate}
          endDate={season.endDate}
          currentStatus={season.currentStatus}
          currentStatusLabel={season.currentStatusLabel}
          teamSeasonCount={season.teamSeasonCount}
          eventCount={season.eventCount}
          canManage={canManage}
        />
      ))}
    </div>
  );
}
