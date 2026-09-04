import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import type { ClubEvent } from "@/lib/events/club-events-service";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/ui/page/EmptyState";
import { SectionCard } from "@/components/ui/page/SectionCard";
import VeranstaltungCard from "./VeranstaltungCard";

export type VeranstaltungenTab = "AKTIV" | "ARCHIV";

const TABS: { key: VeranstaltungenTab; label: string }[] = [
  { key: "AKTIV", label: "Aktiv" },
  { key: "ARCHIV", label: "Archiv" },
];

type VeranstaltungenOverviewProps = {
  events: ClubEvent[];
  tab: VeranstaltungenTab;
  canManage: boolean;
  canDelete: boolean;
  basePath?: string;
};

function buildHref(basePath: string, tab: VeranstaltungenTab): string {
  const search = new URLSearchParams();
  if (tab === "ARCHIV") {
    search.set("tab", "archiv");
  }
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function normalizeVeranstaltungenTab(
  value: string | null | undefined,
): VeranstaltungenTab {
  return value?.trim().toLowerCase() === "archiv" ? "ARCHIV" : "AKTIV";
}

export default function VeranstaltungenOverview({
  events,
  tab,
  canManage,
  canDelete,
  basePath = "/dashboard/veranstaltungen",
}: VeranstaltungenOverviewProps) {
  const activeEvents = events.filter((event) => event.status !== "ARCHIVED");
  const archivedEvents = events.filter((event) => event.status === "ARCHIVED");
  const visibleEvents =
    tab === "ARCHIV"
      ? [...archivedEvents].sort(
          (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
        )
      : [...activeEvents].sort(
          (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
        );

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Veranstaltungen-Bereiche"
        className="flex gap-1 border-b border-[var(--border)]"
      >
        {TABS.map((item) => {
          const isActive = item.key === tab;
          return (
            <Link
              key={item.key}
              href={buildHref(basePath, item.key)}
              role="tab"
              aria-selected={isActive}
              data-testid={`veranstaltungen-tab-${item.key.toLowerCase()}`}
              className={cn(
                "-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
                isActive
                  ? "border-[var(--sce-primary)] text-[var(--sce-primary)]"
                  : "border-transparent text-[var(--text-2)] hover:text-[var(--foreground)]",
              )}
            >
              {item.label}
              <span className="ml-2 sce-count-badge">
                {item.key === "AKTIV" ? activeEvents.length : archivedEvents.length}
              </span>
            </Link>
          );
        })}
      </div>

      {visibleEvents.length === 0 ? (
        <SectionCard noPadding>
          <EmptyState
            icon={<CalendarDays className="h-8 w-8" />}
            heading={
              tab === "ARCHIV" ? "Kein Archiv vorhanden" : "Noch keine Veranstaltungen"
            }
            description={
              tab === "ARCHIV"
                ? "Archivierte Vereinsanlässe erscheinen hier."
                : "Erstelle die erste Veranstaltung für deinen Verein — von der Generalversammlung bis zum Sponsorenanlass."
            }
            action={
              tab === "AKTIV" && canManage ? (
                <Link href="/dashboard/veranstaltungen/new" className="fca-button-primary">
                  <Plus className="h-4 w-4" />
                  Veranstaltung erstellen
                </Link>
              ) : undefined
            }
          />
        </SectionCard>
      ) : (
        <div className="space-y-4" data-testid={`veranstaltungen-list-${tab.toLowerCase()}`}>
          {visibleEvents.map((event) => (
            <VeranstaltungCard
              key={event.id}
              event={event}
              canManage={canManage}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
