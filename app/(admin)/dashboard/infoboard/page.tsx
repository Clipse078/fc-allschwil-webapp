import Link from "next/link";
import { ExternalLink, Monitor } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import InfoboardEventList from "@/components/admin/infoboard/InfoboardEventList";

const EVENT_SELECT = {
  id: true,
  title: true,
  type: true,
  status: true,
  startAt: true,
  endAt: true,
  opponentName: true,
  location: true,
  infoboardVisible: true,
  team: { select: { name: true } },
  season: { select: { name: true } },
} as const;

function toEventItem(e: {
  id: string;
  title: string;
  type: string;
  status: string;
  startAt: Date;
  endAt: Date | null;
  opponentName: string | null;
  location: string | null;
  infoboardVisible: boolean;
  team: { name: string } | null;
  season: { name: string };
}) {
  return {
    id: e.id,
    title: e.title,
    type: e.type,
    status: e.status,
    startAt: e.startAt.toISOString(),
    endAt: e.endAt?.toISOString() ?? null,
    opponentName: e.opponentName,
    location: e.location,
    infoboardVisible: e.infoboardVisible,
    teamName: e.team?.name ?? null,
    seasonName: e.season.name,
  };
}

export default async function InfoboardAdminPage() {
  const session = await requireAnyPermission([
    PERMISSIONS.INFOBOARD_MANAGE,
    PERMISSIONS.EVENTS_PUBLISH_INFOBOARD,
  ]);

  const canToggle = hasPermission(session, PERMISSIONS.INFOBOARD_MANAGE) ||
    hasPermission(session, PERMISSIONS.EVENTS_PUBLISH_INFOBOARD);

  const now = new Date();
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [onBoard, upcoming] = await Promise.all([
    // Events currently visible on infoboard (upcoming + recent, ordered by startAt)
    prisma.event.findMany({
      where: {
        infoboardVisible: true,
        status: { in: ["SCHEDULED", "LIVE", "COMPLETED", "POSTPONED"] },
        startAt: { gte: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
      },
      orderBy: [{ startAt: "asc" }],
      take: 100,
      select: EVENT_SELECT,
    }),
    // Upcoming events NOT yet on infoboard (next 30 days)
    prisma.event.findMany({
      where: {
        infoboardVisible: false,
        status: { in: ["SCHEDULED", "LIVE", "POSTPONED"] },
        startAt: { gte: now, lte: thirtyDaysOut },
      },
      orderBy: [{ startAt: "asc" }],
      take: 50,
      select: EVENT_SELECT,
    }),
  ]);

  const onBoardItems = onBoard.map(toEventItem);
  const upcomingItems = upcoming.map(toEventItem);

  const publicUrl = "/infoboard";

  return (
    <div className="space-y-8 max-w-[1400px]">
      <AdminSectionHeader
        eyebrow="Spielbetrieb"
        title="Infoboard"
        description="Öffentliches Anzeigeboard — steuere welche Events live auf dem Infoboard erscheinen."
        actions={
          <Link
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="fca-button-secondary flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Öffentliches Display öffnen
          </Link>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="sce-kpi-card p-5">
          <p className="sce-data-label">Auf Infoboard</p>
          <p className="mt-2 text-[2rem] font-bold leading-none tracking-tight text-emerald-600"
            style={{ fontFamily: "var(--font-display)" }}>
            {onBoardItems.length}
          </p>
          <p className="mt-1.5 text-[0.75rem] text-[var(--text-2)]">Aktive Events</p>
        </div>
        <div className="sce-kpi-card p-5">
          <p className="sce-data-label">Live jetzt</p>
          <p className="mt-2 text-[2rem] font-bold leading-none tracking-tight text-blue-600"
            style={{ fontFamily: "var(--font-display)" }}>
            {onBoardItems.filter((e) => e.status === "LIVE").length}
          </p>
          <p className="mt-1.5 text-[0.75rem] text-[var(--text-2)]">Status LIVE</p>
        </div>
        <div className="sce-kpi-card p-5">
          <p className="sce-data-label">Bereit (30 Tage)</p>
          <p className="mt-2 text-[2rem] font-bold leading-none tracking-tight text-amber-600"
            style={{ fontFamily: "var(--font-display)" }}>
            {upcomingItems.length}
          </p>
          <p className="mt-1.5 text-[0.75rem] text-[var(--text-2)]">Nicht auf Infoboard</p>
        </div>
        <div className="sce-kpi-card p-5">
          <p className="sce-data-label">Display-URL</p>
          <p className="mt-2 font-mono text-[0.75rem] text-[var(--blue)] break-all">
            /infoboard
          </p>
          <p className="mt-1.5 text-[0.75rem] text-[var(--text-2)]">Öffentlich zugänglich</p>
        </div>
      </div>

      {/* Public display link banner */}
      <div className="flex items-center gap-4 rounded-[var(--radius-2xl)] border border-blue-200 bg-blue-50 px-5 py-4">
        <Monitor className="h-6 w-6 shrink-0 text-[var(--blue)]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--blue)]">
            Öffentliches Infoboard-Display
          </p>
          <p className="mt-0.5 text-[0.78rem] text-[var(--text-2)]">
            Das Display unter <code className="font-mono text-[var(--blue)]">/infoboard</code> ist
            öffentlich zugänglich und lädt sich automatisch alle 60 Sekunden neu.
            Für Kiosk-Modus: Browser-Vollbild (F11) und URL aufrufen.
          </p>
        </div>
        <Link
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-2 rounded-[var(--radius-lg)] bg-[var(--blue)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--blue-dark)]"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Öffnen
        </Link>
      </div>

      {/* Currently on infoboard */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-[var(--muted)]" />
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                Aktuell
              </p>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Auf dem Infoboard
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[0.72rem] font-semibold tabular-nums text-emerald-700">
            {onBoardItems.length} Events
          </span>
        </div>
        <div className="sce-detail-section-body p-0">
          <InfoboardEventList
            events={onBoardItems}
            canToggle={canToggle}
            emptyLabel="Keine Events auf dem Infoboard. Füge unten Events hinzu."
          />
        </div>
      </div>

      {/* Upcoming — not yet on infoboard */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
              Nächste 30 Tage
            </p>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Nicht auf dem Infoboard
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--surface-3)] px-2.5 py-1 text-[0.72rem] font-semibold tabular-nums text-[var(--text-2)]">
            {upcomingItems.length} Events
          </span>
        </div>
        <div className="sce-detail-section-body p-0">
          <InfoboardEventList
            events={upcomingItems}
            canToggle={canToggle}
            emptyLabel="Alle kommenden Events der nächsten 30 Tage sind bereits auf dem Infoboard."
          />
        </div>
      </div>

      {/* Link to full events management */}
      <div className="flex items-center justify-between rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
        <p className="text-sm text-[var(--muted)]">
          Events erstellen und bearbeiten im Events-Modul.
        </p>
        <Link href="/dashboard/events" className="fca-button-secondary text-sm">
          Zum Events-Modul
        </Link>
      </div>
    </div>
  );
}
