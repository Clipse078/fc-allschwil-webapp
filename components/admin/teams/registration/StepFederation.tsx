"use client";

import { useId, useMemo, useState } from "react";
import { Link2, Link2Off, Search, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { UnmappedFederationTeam, WizardFormData } from "./types";

type Props = {
  unmappedFederationTeams: UnmappedFederationTeam[];
  form: Pick<
    WizardFormData,
    | "federationProvider"
    | "federationExternalTeamId"
    | "federationExternalSeasonId"
    | "federationProviderTeamName"
    | "federationProviderLeagueName"
  >;
  onSelectFederationTeam: (team: UnmappedFederationTeam | null) => void;
  loading: boolean;
  providerUnavailable: boolean;
};

/**
 * StepFederation — Step 3 of the Team registration wizard.
 *
 * Optional: Connect to a provider (e.g. SFV) team.
 * Shows unmapped federation teams from the DB.
 * Manual (no mapping) path is always available.
 */
export default function StepFederation({
  unmappedFederationTeams,
  form,
  onSelectFederationTeam,
  loading,
  providerUnavailable,
}: Props) {
  const searchId = useId();
  const [searchTerm, setSearchTerm] = useState("");

  const hasMapping =
    form.federationExternalTeamId !== null &&
    form.federationExternalSeasonId !== null;

  const filteredTeams = useMemo(() => {
    if (!searchTerm.trim()) return unmappedFederationTeams;
    const term = searchTerm.toLowerCase().trim();
    return unmappedFederationTeams.filter(
      (t) =>
        (t.providerTeamName ?? "").toLowerCase().includes(term) ||
        (t.providerLeagueName ?? "").toLowerCase().includes(term) ||
        String(t.externalTeamId).includes(term),
    );
  }, [unmappedFederationTeams, searchTerm]);

  function isSelected(team: UnmappedFederationTeam): boolean {
    return (
      form.federationExternalTeamId === team.externalTeamId &&
      form.federationExternalSeasonId === team.externalSeasonId &&
      form.federationProvider === team.provider
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Provider unavailable notice ───────────────────────────────────── */}
      {providerUnavailable && (
        <div
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4"
          role="status"
          aria-live="polite"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Verbandsdaten sind momentan nicht verfügbar
            </p>
            <p className="mt-1 text-xs text-amber-700">
              Du kannst das Team ohne Verbandsverbindung registrieren und die
              Verbindung später ergänzen.
            </p>
          </div>
        </div>
      )}

      {/* ── Current selection ─────────────────────────────────────────────── */}
      {hasMapping && (
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
                {form.federationProviderTeamName ?? "Verbandsteam ausgewählt"}
              </p>
              {form.federationProviderLeagueName && (
                <p className="text-xs text-[var(--text-2)]">
                  {form.federationProviderLeagueName}
                </p>
              )}
              <p className="font-mono text-xs text-[var(--text-3)]">
                {form.federationProvider} · ID {form.federationExternalTeamId}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectFederationTeam(null)}
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

      {/* ── Manual path option ────────────────────────────────────────────── */}
      {!hasMapping && (
        <div
          className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4"
          role="note"
        >
          <Link2Off
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-3)]"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Keine Verbandsverbindung
            </p>
            <p className="mt-1 text-xs text-[var(--text-2)]">
              Das Team wird manuell in SportClubEvo geführt. Eine Verbindung
              kann später ergänzt werden.
            </p>
          </div>
        </div>
      )}

      {/* ── Available federation teams ────────────────────────────────────── */}
      {!loading && unmappedFederationTeams.length > 0 && (
        <section aria-labelledby="federation-teams-heading">
          <div className="mb-3 flex items-center gap-3">
            <h3
              id="federation-teams-heading"
              className="text-sm font-semibold text-[var(--foreground)]"
            >
              Verfügbare Verbandsteams verbinden
            </h3>
          </div>

          {/* Search */}
          {unmappedFederationTeams.length > 5 && (
            <div className="relative mb-3">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-3)]"
                aria-hidden="true"
              />
              <input
                id={searchId}
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Verband-Team suchen …"
                className="fca-input w-full pl-9 text-sm"
                aria-label="Verbandsteams filtern"
              />
            </div>
          )}

          <div
            className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]"
            role="list"
            aria-label="Verfügbare Verbandsteams"
          >
            {filteredTeams.length === 0 ? (
              <p className="px-4 py-3 text-sm text-[var(--text-2)]">
                Keine Verbandsteams gefunden.
              </p>
            ) : (
              filteredTeams.map((team) => {
                const selected = isSelected(team);
                return (
                  <div
                    key={team.id}
                    role="listitem"
                    className={cn(
                      "flex items-center justify-between gap-4 px-4 py-3",
                      "first:rounded-t-xl last:rounded-b-xl",
                      selected &&
                        "bg-[color-mix(in_srgb,var(--sce-primary)_5%,transparent)]",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                        {team.providerTeamName ?? `Team ${team.externalTeamId}`}
                      </p>
                      {team.providerLeagueName && (
                        <p className="truncate text-xs text-[var(--text-2)]">
                          {team.providerLeagueName}
                        </p>
                      )}
                      <p className="font-mono text-xs text-[var(--text-3)]">
                        {team.provider} · Saison {team.externalSeasonId} · ID{" "}
                        {team.externalTeamId}
                      </p>
                    </div>

                    {!team.providerIsActive && (
                      <span className="shrink-0 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        Inaktiv
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        selected ? onSelectFederationTeam(null) : onSelectFederationTeam(team)
                      }
                      className={cn(
                        "shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5",
                        "text-xs font-semibold transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)]",
                        selected
                          ? "border-[var(--sce-primary)] bg-[color-mix(in_srgb,var(--sce-primary)_10%,transparent)] text-[var(--sce-primary)]"
                          : "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--surface-2)]",
                      )}
                      aria-pressed={selected}
                      aria-label={
                        selected
                          ? `${team.providerTeamName ?? "Team"} Auswahl aufheben`
                          : `${team.providerTeamName ?? "Team"} verbinden`
                      }
                    >
                      {selected ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Verbunden
                        </>
                      ) : (
                        <>
                          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Verbinden
                        </>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg bg-[var(--surface-2)]"
            />
          ))}
        </div>
      )}

      {/* No federation teams available */}
      {!loading && !providerUnavailable && unmappedFederationTeams.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-5 py-6 text-center">
          <Link2Off
            className="mx-auto mb-2 h-7 w-7 text-[var(--text-3)]"
            aria-hidden="true"
          />
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Keine Verbandsteams verfügbar
          </p>
          <p className="mt-1 text-sm text-[var(--text-2)]">
            Führe eine Verbandssynchronisation durch oder setze die Verbindung
            später.
          </p>
        </div>
      )}
    </div>
  );
}
