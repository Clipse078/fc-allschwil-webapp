"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Trophy,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { EligibleCompetition, WizardFormData } from "./types";

type Props = {
  competitions: EligibleCompetition[];
  selectedCompetitionId: WizardFormData["competitionId"];
  onSelectCompetition: (id: string | null) => void;
  loading: boolean;
};

const COMPETITION_TYPE_LABELS: Record<string, string> = {
  LEAGUE: "Liga",
  CUP: "Pokal",
  TOURNAMENT_SERIES: "Turnierserie",
  OTHER: "Sonstiges",
};

const PROVIDER_LABELS: Record<string, string> = {
  MANUAL: "Manuell",
  SFV: "SFV",
};

/**
 * StepCompetition — Step 5 of the Team registration wizard (TEAM-CREATE-02).
 *
 * Shown only when Participation Type = COMPETITION.
 * Displays all non-archived competitions for the tenant.
 * Provider-independent: shows both manual and synced competitions.
 *
 * Empty state: if no competitions exist, shows a message with a link to create one.
 * Registration is not blocked when no competitions exist (user can return later).
 */
export default function StepCompetition({
  competitions,
  selectedCompetitionId,
  onSelectCompetition,
  loading,
}: Props) {
  const searchId = useId();
  const [searchTerm, setSearchTerm] = useState("");

  const selected = competitions.find((c) => c.id === selectedCompetitionId) ?? null;

  const filteredCompetitions = useMemo(() => {
    if (!searchTerm.trim()) return competitions;
    const term = searchTerm.toLowerCase().trim();
    return competitions.filter(
      (c) =>
        c.officialName.toLowerCase().includes(term) ||
        (c.shortName ?? "").toLowerCase().includes(term) ||
        (c.groupName ?? "").toLowerCase().includes(term) ||
        (c.ageCategory ?? "").toLowerCase().includes(term) ||
        PROVIDER_LABELS[c.provider]?.toLowerCase().includes(term),
    );
  }, [competitions, searchTerm]);

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-xl bg-[var(--surface-2)]"
          />
        ))}
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  if (competitions.length === 0) {
    return (
      <div
        className="flex flex-col items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-6 py-10 text-center"
        role="status"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-3)]">
          <Trophy className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Es wurden noch keine Wettkämpfe angelegt.
          </p>
          <p className="mt-1 text-xs text-[var(--text-2)]">
            Du kannst das Team jetzt registrieren und den Wettkampf später
            ergänzen.
          </p>
        </div>
        <Link
          href="/dashboard/competitions"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-[var(--sce-primary)] px-4 py-2",
            "text-sm font-semibold text-[var(--sce-primary)]",
            "hover:bg-[color-mix(in_srgb,var(--sce-primary)_6%,transparent)] transition-colors",
          )}
        >
          <PlusCircle className="h-4 w-4" aria-hidden="true" />
          Wettkampf erstellen
        </Link>
      </div>
    );
  }

  // ── Main content ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Selected competition banner */}
      {selected && (
        <div
          className="flex items-center justify-between gap-4 rounded-xl border border-[var(--sce-primary)] bg-[color-mix(in_srgb,var(--sce-primary)_6%,transparent)] px-4 py-3"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2
              className="h-4 w-4 shrink-0 text-[var(--sce-primary)]"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {selected.shortName ?? selected.officialName}
              </p>
              {selected.groupName && (
                <p className="text-xs text-[var(--text-2)]">
                  {selected.groupName}
                </p>
              )}
              <p className="font-mono text-xs text-[var(--text-3)]">
                {PROVIDER_LABELS[selected.provider] ?? selected.provider}
                {" · "}
                {COMPETITION_TYPE_LABELS[selected.competitionType] ??
                  selected.competitionType}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectCompetition(null)}
            className={cn(
              "shrink-0 rounded-lg border border-[var(--border-strong)] px-3 py-1.5",
              "text-xs font-semibold text-[var(--text-2)]",
              "hover:bg-[var(--surface-2)] transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)]",
            )}
          >
            Auswahl aufheben
          </button>
        </div>
      )}

      {/* Notice: registration not blocked */}
      {!selected && (
        <div
          className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
          role="note"
        >
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
            aria-hidden="true"
          />
          <p className="text-xs text-[var(--text-2)]">
            Wettkampfteams sollten einem Wettkampf zugeordnet sein. Wähle einen
            Wettkampf aus der Liste aus.
          </p>
        </div>
      )}

      {/* Search */}
      {competitions.length > 5 && (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-3)]"
            aria-hidden="true"
          />
          <input
            id={searchId}
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Wettkampf suchen …"
            className="fca-input w-full pl-9 text-sm"
            aria-label="Wettkämpfe filtern"
          />
        </div>
      )}

      {/* Competition list */}
      <section aria-labelledby="competitions-list-heading">
        <h3
          id="competitions-list-heading"
          className="mb-2 text-sm font-semibold text-[var(--foreground)]"
        >
          Verfügbare Wettkämpfe
        </h3>

        <div
          className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]"
          role="list"
          aria-label="Verfügbare Wettkämpfe"
        >
          {filteredCompetitions.length === 0 ? (
            <p className="px-4 py-4 text-center text-sm text-[var(--text-2)]">
              Kein Wettkampf gefunden.
            </p>
          ) : (
            filteredCompetitions.map((competition) => {
              const isSelected = competition.id === selectedCompetitionId;
              const providerLabel =
                PROVIDER_LABELS[competition.provider] ?? competition.provider;
              const typeLabel =
                COMPETITION_TYPE_LABELS[competition.competitionType] ??
                competition.competitionType;

              return (
                <div
                  key={competition.id}
                  role="listitem"
                  className={cn(
                    "flex items-center justify-between gap-4 px-4 py-3",
                    "first:rounded-t-xl last:rounded-b-xl",
                    isSelected &&
                      "bg-[color-mix(in_srgb,var(--sce-primary)_5%,transparent)]",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                      {competition.officialName}
                    </p>
                    {competition.groupName && (
                      <p className="truncate text-xs text-[var(--text-2)]">
                        {competition.groupName}
                      </p>
                    )}
                    <p className="font-mono text-xs text-[var(--text-3)]">
                      {providerLabel}
                      {" · "}
                      {typeLabel}
                      {competition.ageCategory
                        ? ` · ${competition.ageCategory}`
                        : ""}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      isSelected
                        ? onSelectCompetition(null)
                        : onSelectCompetition(competition.id)
                    }
                    className={cn(
                      "shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5",
                      "text-xs font-semibold transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)]",
                      isSelected
                        ? "border-[var(--sce-primary)] bg-[color-mix(in_srgb,var(--sce-primary)_10%,transparent)] text-[var(--sce-primary)]"
                        : "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--surface-2)]",
                    )}
                    aria-pressed={isSelected}
                    aria-label={
                      isSelected
                        ? `${competition.officialName} Auswahl aufheben`
                        : `${competition.officialName} auswählen`
                    }
                  >
                    {isSelected ? (
                      <>
                        <CheckCircle2
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        Ausgewählt
                      </>
                    ) : (
                      "Auswählen"
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
