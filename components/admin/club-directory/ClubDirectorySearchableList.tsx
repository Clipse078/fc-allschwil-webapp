"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Shield, Users, Archive, Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui";
import { ClubLogo } from "./ClubLogo";

export type ClubDirectoryListItem = {
  id: string;
  name: string;
  shortName: string | null;
  alternativeName: string | null;
  logoUrl: string | null;
  source: string;
  archivedAt: string | null;
  teamCount: number;
  hasProviderMapping: boolean;
};

type ClubDirectorySearchableListProps = {
  clubs: ClubDirectoryListItem[];
  archivedClubs?: ClubDirectoryListItem[];
  showArchived?: boolean;
};

function matches(club: ClubDirectoryListItem, query: string): boolean {
  const q = query.toLowerCase();
  return (
    club.name.toLowerCase().includes(q) ||
    (club.shortName ?? "").toLowerCase().includes(q) ||
    (club.alternativeName ?? "").toLowerCase().includes(q)
  );
}

export default function ClubDirectorySearchableList({
  clubs,
  archivedClubs = [],
  showArchived = false,
}: ClubDirectorySearchableListProps) {
  const [query, setQuery] = useState("");

  const filteredActive = useMemo(
    () => (query.trim() ? clubs.filter((c) => matches(c, query)) : clubs),
    [clubs, query],
  );
  const filteredArchived = useMemo(
    () => (query.trim() ? archivedClubs.filter((c) => matches(c, query)) : archivedClubs),
    [archivedClubs, query],
  );

  const displayClubs = showArchived ? filteredArchived : filteredActive;

  return (
    <div className="space-y-4">
      {archivedClubs.length > 0 ? (
        <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
          <Link
            href="/dashboard/vereine"
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition ${
              !showArchived
                ? "bg-[var(--surface-2)] text-[var(--foreground)] font-semibold"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <Building2 className="h-4 w-4" />
            Aktiv
            <span className="ml-1 rounded-full bg-[var(--border)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[var(--muted)]">
              {clubs.length}
            </span>
          </Link>
          <Link
            href="/dashboard/vereine?view=archived"
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition ${
              showArchived
                ? "bg-[var(--surface-2)] text-[var(--foreground)] font-semibold"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <Archive className="h-4 w-4" />
            Archiviert
            <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[0.65rem] font-semibold text-amber-700">
              {archivedClubs.length}
            </span>
          </Link>
        </div>
      ) : null}

      <div className="sce-page-search">
        <Search className="h-4 w-4 flex-shrink-0 text-[var(--muted)]" />
        <input
          type="text"
          placeholder="Verein suchen nach Name oder Kurzname…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="flex-shrink-0 text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Löschen
          </button>
        ) : null}
      </div>

      {displayClubs.length === 0 && query.trim() ? (
        <EmptyState
          icon={<Search className="h-10 w-10" />}
          heading="Keine Treffer"
          description={`Für „${query}" wurden keine Vereine gefunden.`}
        />
      ) : displayClubs.length === 0 ? (
        <EmptyState
          icon={showArchived ? <Archive className="h-10 w-10" /> : <Shield className="h-10 w-10" />}
          heading={showArchived ? "Keine archivierten Vereine" : "Noch keine Vereine erfasst"}
          description={
            showArchived
              ? "Archivierte Vereine werden hier angezeigt und können wiederhergestellt werden."
              : "Erfasse den ersten externen Verein — manuell oder später per Anbieter-Verknüpfung."
          }
          action={
            !showArchived ? (
              <Link href="/dashboard/vereine/new" className="fca-button-primary">
                Ersten Verein erstellen
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
          {displayClubs.map((club, idx) => (
            <Link
              key={club.id}
              href={`/dashboard/vereine/${club.id}`}
              className={`flex items-center gap-3 px-5 py-3.5 transition hover:bg-[var(--surface-2)] ${
                idx !== displayClubs.length - 1 ? "border-b border-[var(--border)]" : ""
              }`}
            >
              <ClubLogo logoUrl={club.logoUrl} name={club.name} size="sm" />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    {club.name}
                  </span>
                  {club.shortName ? (
                    <code className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0 text-[0.65rem] font-mono text-[var(--muted)]">
                      {club.shortName}
                    </code>
                  ) : null}
                  <Badge variant={club.hasProviderMapping ? "info" : "outline"} size="sm">
                    {club.hasProviderMapping ? "Anbieter-verknüpft" : "Manuell"}
                  </Badge>
                  {club.archivedAt ? (
                    <Badge variant="default" size="sm">
                      Archiviert
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                  <Users className="h-3 w-3" />
                  {club.teamCount} Team{club.teamCount !== 1 ? "s" : ""}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
