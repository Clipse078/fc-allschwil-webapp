"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";

type CandidateTeam = {
  id: string;
  name: string;
  slug: string;
  hasOrgUnitHistory: boolean;
};

type BulkRolloverOutcome = {
  teamId: string;
  teamName: string;
  status:
    | "CREATED"
    | "ALREADY_PRESENT"
    | "REJECTED_NOT_FOUND"
    | "REJECTED_TENANT_MISMATCH"
    | "REJECTED_INACTIVE"
    | "REJECTED_ERROR";
  hasOrgUnit?: boolean;
  message: string;
};

type BulkRolloverResult = {
  outcomes: BulkRolloverOutcome[];
  createdCount: number;
  alreadyPresentCount: number;
  rejectedCount: number;
};

type TeamRolloverPanelProps = {
  seasonId: string;
  seasonName: string;
};

const outcomeLabel: Record<BulkRolloverOutcome["status"], string> = {
  CREATED: "übernommen",
  ALREADY_PRESENT: "bereits registriert",
  REJECTED_NOT_FOUND: "abgelehnt",
  REJECTED_TENANT_MISMATCH: "abgelehnt",
  REJECTED_INACTIVE: "abgelehnt",
  REJECTED_ERROR: "abgelehnt",
};

const outcomeTone: Record<BulkRolloverOutcome["status"], string> = {
  CREATED: "text-emerald-600",
  ALREADY_PRESENT: "text-[var(--muted)]",
  REJECTED_NOT_FOUND: "text-rose-600",
  REJECTED_TENANT_MISMATCH: "text-rose-600",
  REJECTED_INACTIVE: "text-rose-600",
  REJECTED_ERROR: "text-rose-600",
};

/**
 * ADMIN-MASTERDATA-UX-01-C2 — "Teams übernehmen".
 *
 * Bulk entry point for establishing the TeamSeason relationship between the
 * given Season and any number of existing active tenant Teams in one
 * operation. Never creates new Team records — reuses the same canonical
 * TeamSeason materialization used by the single-Team registration wizard
 * (see app/api/seasons/[seasonId]/team-rollover/route.ts →
 * lib/teams/team-registration-service.ts#bulkRegisterExistingTeamsForSeason).
 *
 * Works for any target Season regardless of Season.isActive — establishing
 * the TeamSeason rows here never requires the Season to be "AKTUELL" first.
 */
export default function TeamRolloverPanel({ seasonId, seasonName }: TeamRolloverPanelProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidateTeam[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<BulkRolloverResult | null>(null);

  async function openPanel() {
    setIsOpen(true);
    setResult(null);
    setLoadError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/seasons/${seasonId}/team-rollover`);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Teams konnten nicht geladen werden.");
      }

      const loaded: CandidateTeam[] = data?.candidates ?? [];
      setCandidates(loaded);
      // SEASON-01-C3: Season membership and OrgUnit assignment are not
      // coupled — every active, not-yet-registered Team is preselected.
      // Missing OrgUnit history is never a reason to omit a Team; it is
      // only surfaced below as a neutral, non-blocking hint.
      setSelectedIds(new Set(loaded.map((t) => t.id)));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  }

  function closePanel() {
    setIsOpen(false);
    setResult(null);
  }

  function toggleTeam(teamId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  }

  async function handleConfirm() {
    if (selectedIds.size === 0) return;

    setSubmitting(true);
    setLoadError(null);

    try {
      const response = await fetch(`/api/seasons/${seasonId}/team-rollover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamIds: [...selectedIds] }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Teams konnten nicht übernommen werden.");
      }

      setResult(data as BulkRolloverResult);
      router.refresh();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={openPanel}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-white px-3 text-xs font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)]"
      >
        <Users className="h-3.5 w-3.5" />
        Teams übernehmen
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--foreground)]">
          Teams für „{seasonName}“ übernehmen
        </p>
        <button
          type="button"
          onClick={closePanel}
          className="text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Schließen
        </button>
      </div>

      {loading ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-[var(--muted)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Teams werden geladen…
        </p>
      ) : null}

      {loadError ? <p className="mt-3 text-xs text-rose-600">{loadError}</p> : null}

      {!loading && !result && candidates.length === 0 && !loadError ? (
        <p className="mt-3 text-xs text-[var(--muted)]">
          Keine aktiven Teams verfügbar, die noch nicht für diese Saison registriert sind.
        </p>
      ) : null}

      {!loading && !result && candidates.length > 0 ? (
        <>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Aktive Teams, die noch nicht für diese Saison registriert sind. Alle Teams sind vorausgewählt —
            eine Organisationseinheit wird übernommen, sofern eine passende aus einer bisherigen Saison
            vorliegt.
          </p>
          <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
            {candidates.map((team) => (
              <li key={team.id}>
                <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(team.id)}
                    onChange={() => toggleTeam(team.id)}
                    className="h-4 w-4 rounded border-[var(--border-strong)]"
                  />
                  <span className="flex-1 truncate">{team.name}</span>
                  {!team.hasOrgUnitHistory ? (
                    <span className="shrink-0 text-[0.65rem] text-[var(--muted)]">
                      Keine Organisationseinheit wird übernommen
                    </span>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-xs text-[var(--muted)]">{selectedIds.size} von {candidates.length} ausgewählt</p>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting || selectedIds.size === 0}
              className="fca-button-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Übernehme…" : "Bestätigen"}
            </button>
          </div>
        </>
      ) : null}

      {result ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium text-[var(--foreground)]">
            {result.createdCount} übernommen · {result.alreadyPresentCount} bereits registriert ·{" "}
            {result.rejectedCount} abgelehnt
          </p>
          <ul className="max-h-56 space-y-1 overflow-y-auto text-xs">
            {result.outcomes.map((outcome) => (
              <li key={outcome.teamId} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {outcome.teamName}
                  {outcome.status === "CREATED" && outcome.hasOrgUnit === false ? (
                    <span className="ml-1.5 text-[0.65rem] text-[var(--muted)]">
                      (ohne Organisationseinheit)
                    </span>
                  ) : null}
                </span>
                <span className={`shrink-0 font-medium ${outcomeTone[outcome.status]}`}>
                  {outcomeLabel[outcome.status]}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={closePanel}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-white px-3 text-xs font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)]"
          >
            Schließen
          </button>
        </div>
      ) : null}
    </div>
  );
}
