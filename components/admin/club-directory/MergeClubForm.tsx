"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Merge, Search, Users, X } from "lucide-react";
import { Badge } from "@/components/ui";
import { ClubLogo } from "./ClubLogo";
import {
  formatExternalTeamCompetitionContext,
  type ExternalTeamCompetitionContext,
} from "@/lib/club-directory/competition-context";

type ClubSearchResult = {
  id: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  teamCount: number;
  hasProviderMapping: boolean;
  archivedAt: string | null;
};

type ClubDetail = {
  id: string;
  name: string;
  logoUrl: string | null;
  teams: {
    id: string;
    name: string;
    archivedAt: string | null;
    competitionContext: ExternalTeamCompetitionContext;
  }[];
  providerMappings: { id: string; provider: string; providerClubId: number }[];
};

type MergeClubFormProps = {
  survivingClub: {
    id: string;
    name: string;
    shortName: string | null;
    logoUrl: string | null;
  };
};

const fieldClass =
  "w-full rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0b4aa2]/30";

/**
 * CLUB-DIRECTORY-03 — manual club merge UI. The tenant admin picks one or
 * more duplicate ("losing") clubs to merge into this ("surviving") club,
 * sees exactly what will move (teams + provider mappings) before
 * confirming, then triggers the merge via POST .../clubs/[clubId]/merge.
 *
 * Deliberately NOT automatic: no name-similarity suggestions, no
 * pre-selection — every losing club is explicitly chosen by the admin.
 */
export default function MergeClubForm({ survivingClub }: MergeClubFormProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ClubSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedDetails, setSelectedDetails] = useState<Record<string, ClubDetail>>({});
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ limit: "20" });
        if (query.trim()) params.set("search", query.trim());
        const res = await fetch(`/api/club-directory/clubs?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && Array.isArray(data?.clubs)) {
          setSearchResults(
            data.clubs.filter(
              (c: ClubSearchResult) => c.id !== survivingClub.id && !selectedIds.includes(c.id),
            ),
          );
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, survivingClub.id, selectedIds]);

  async function addLosingClub(clubId: string) {
    setError(null);
    setSelectedIds((prev) => [...prev, clubId]);
    setSearchResults((prev) => prev.filter((c) => c.id !== clubId));

    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/club-directory/clubs/${clubId}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.club) {
        setSelectedDetails((prev) => ({ ...prev, [clubId]: data.club }));
      }
    } finally {
      setLoadingPreview(false);
    }
  }

  function removeLosingClub(clubId: string) {
    setSelectedIds((prev) => prev.filter((id) => id !== clubId));
    setSelectedDetails((prev) => {
      const next = { ...prev };
      delete next[clubId];
      return next;
    });
    setConfirming(false);
  }

  const totals = useMemo(() => {
    let teams = 0;
    let mappings = 0;
    for (const id of selectedIds) {
      const detail = selectedDetails[id];
      if (!detail) continue;
      teams += detail.teams.length;
      mappings += detail.providerMappings.length;
    }
    return { teams, mappings };
  }, [selectedIds, selectedDetails]);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/club-directory/clubs/${survivingClub.id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ losingClubIds: selectedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Zusammenführung fehlgeschlagen.");
        setConfirming(false);
        return;
      }
      router.push(`/dashboard/vereine/${survivingClub.id}`);
      router.refresh();
    } catch {
      setError("Netzwerkfehler.");
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <h3 className="mb-1 text-[1.05rem] font-semibold text-slate-900">Bleibender Verein</h3>
        <p className="mb-4 text-sm text-slate-500">
          Alle Teams und Anbieter-Verknüpfungen werden auf diesen Verein übertragen.
        </p>
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <ClubLogo logoUrl={survivingClub.logoUrl} name={survivingClub.name} size="sm" />
          <div>
            <p className="text-sm font-semibold text-slate-900">{survivingClub.name}</p>
            {survivingClub.shortName ? (
              <p className="text-xs text-slate-500">{survivingClub.shortName}</p>
            ) : null}
          </div>
          <Badge variant="success" size="sm">
            Bleibt aktiv
          </Badge>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <h3 className="mb-1 text-[1.05rem] font-semibold text-slate-900">
          Zu vereinigende Duplikate
        </h3>
        <p className="mb-4 text-sm text-slate-500">
          Wähle einen oder mehrere Vereine, die in &bdquo;{survivingClub.name}&ldquo; aufgehen sollen.
          Sie werden danach archiviert, nie gelöscht.
        </p>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Verein suchen…"
            className={`${fieldClass} pl-10`}
          />
        </div>

        {searching ? (
          <p className="mb-3 text-xs text-slate-400">Suche…</p>
        ) : searchResults.length > 0 ? (
          <ul className="mb-4 max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-slate-100 p-1.5">
            {searchResults.map((club) => (
              <li key={club.id}>
                <button
                  type="button"
                  onClick={() => addLosingClub(club.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-slate-50"
                >
                  <ClubLogo logoUrl={club.logoUrl} name={club.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{club.name}</span>
                    <span className="block text-xs text-slate-400">
                      {club.teamCount} Team{club.teamCount !== 1 ? "s" : ""}
                      {club.archivedAt ? " · Archiviert" : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-xs text-slate-400">Keine weiteren Treffer.</p>
        )}

        {selectedIds.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
            Noch keine Duplikate ausgewählt.
          </p>
        ) : (
          <ul className="space-y-2">
            {selectedIds.map((id) => {
              const detail = selectedDetails[id];
              return (
                <li
                  key={id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">
                        {detail?.name ?? id}
                      </span>
                      <Badge variant="default" size="sm">
                        Wird archiviert
                      </Badge>
                    </div>
                    {detail ? (
                      <>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                          <Users className="h-3 w-3" />
                          {detail.teams.length} Team{detail.teams.length !== 1 ? "s" : ""} ·{" "}
                          {detail.providerMappings.length} Anbieter-Verknüpfung
                          {detail.providerMappings.length !== 1 ? "en" : ""} werden übertragen
                        </p>
                        {detail.teams.length > 0 ? (
                          <ul className="mt-1.5 space-y-0.5 pl-5 text-xs text-slate-400">
                            {detail.teams.map((team) => {
                              const context = formatExternalTeamCompetitionContext(
                                team.competitionContext,
                              );
                              return (
                                <li key={team.id} className="truncate">
                                  {team.name}
                                  {context ? <span className="text-slate-300"> · {context}</span> : null}
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </>
                    ) : (
                      <p className="mt-0.5 text-xs text-slate-400">Lädt…</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLosingClub(id)}
                    className="rounded-full p-1.5 text-slate-400 hover:bg-white hover:text-slate-600"
                    aria-label="Entfernen"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selectedIds.length > 0 ? (
        <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <h3 className="mb-4 text-[1.05rem] font-semibold text-slate-900">Zusammenfassung</h3>
          <ul className="mb-5 space-y-1.5 text-sm text-slate-600">
            <li>
              <strong>{totals.teams}</strong> Team{totals.teams !== 1 ? "s" : ""} werden zu &bdquo;
              {survivingClub.name}&ldquo; verschoben.
            </li>
            <li>
              <strong>{totals.mappings}</strong> Anbieter-Verknüpfung{totals.mappings !== 1 ? "en" : ""}{" "}
              (z.B. SFV) werden übertragen.
            </li>
            <li>
              <strong>{selectedIds.length}</strong> Verein{selectedIds.length !== 1 ? "e" : ""} werden
              archiviert (nicht gelöscht).
            </li>
          </ul>

          {error ? <p className="mb-3 text-sm font-medium text-rose-600">{error}</p> : null}

          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={loadingPreview}
              className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-6 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60 hover:bg-[#08357a]"
            >
              <Merge className="h-4 w-4" />
              Zusammenführung vorbereiten
            </button>
          ) : (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">
                Zusammenführung wirklich durchführen? Diese Aktion verschiebt Teams und
                Anbieter-Verknüpfungen unwiderruflich.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60 hover:bg-amber-700"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Merge className="h-4 w-4" />}
                  Ja, zusammenführen
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={submitting}
                  className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
