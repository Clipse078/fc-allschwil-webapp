"use client";

/**
 * components/infoboard/v2/designer/ActivitiesWidgetPanel.tsx
 *
 * Settings panel for the ACTIVITIES widget in the Infoboard Designer.
 *
 * For Designer-01, the Activities widget has no user-configurable settings.
 * Content (trainings, matches, tournaments) is controlled through the
 * canonical publishing pipeline, not the Designer.
 */

export function ActivitiesWidgetPanel() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)] mb-3">
          Inhalt
        </p>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-3)] p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-[0.78rem] text-[var(--foreground)]">Trainings</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
            <span className="text-[0.78rem] text-[var(--foreground)]">Spiele</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-orange-500 shrink-0" />
            <span className="text-[0.78rem] text-[var(--foreground)]">Turniere und Events</span>
          </div>
          <p className="text-[0.7rem] text-[var(--muted)] pt-1">
            Inhalte werden aus dem Spielbetrieb übernommen (4h-Fenster + ausstehende Termine).
          </p>
        </div>
      </div>

      <div>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)] mb-3">
          Layout
        </p>
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2">
          <p className="text-[0.75rem] text-[var(--muted)]">
            Adaptive Kartenhöhe — richtet sich automatisch nach der Anzahl Einträge.
          </p>
        </div>
      </div>

      <div>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)] mb-3">
          Zukunft
        </p>
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2">
          <p className="text-[0.75rem] text-[var(--muted)]">
            Sportanlage-Widget mit Platz­zuweisung in Vorbereitung.
          </p>
        </div>
      </div>
    </div>
  );
}
