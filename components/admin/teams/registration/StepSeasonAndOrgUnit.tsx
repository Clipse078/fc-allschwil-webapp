"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { Calendar, Building2, Search, X, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui";
import type { EligibleSeason, EligibleOrgUnit } from "./types";

type Props = {
  seasons: EligibleSeason[];
  orgUnits: EligibleOrgUnit[];
  selectedSeasonId: string;
  selectedOrgUnitIds: string[];
  onSeasonChange: (seasonId: string) => void;
  onOrgUnitToggle: (orgUnitId: string) => void;
  onPrimaryChange: (orgUnitId: string) => void;
  loading: boolean;
};

/**
 * StepSeasonAndOrgUnit — Step 1 of the Team registration wizard.
 *
 * Season selection + mandatory Organisationseinheit multi-selection.
 * First selected OrgUnit is primary.
 */
export default function StepSeasonAndOrgUnit({
  seasons,
  orgUnits,
  selectedSeasonId,
  selectedOrgUnitIds,
  onSeasonChange,
  onOrgUnitToggle,
  onPrimaryChange,
  loading,
}: Props) {
  const [orgUnitSearch, setOrgUnitSearch] = useState("");
  const searchId = useId();
  const seasonSelectId = useId();

  const filteredOrgUnits = useMemo(() => {
    if (!orgUnitSearch.trim()) return orgUnits;
    const term = orgUnitSearch.toLowerCase().trim();
    return orgUnits.filter(
      (ou) =>
        ou.name.toLowerCase().includes(term) ||
        ou.key.toLowerCase().includes(term),
    );
  }, [orgUnits, orgUnitSearch]);

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId) ?? null;

  function lifecycleBadgeClass(status: string) {
    switch (status) {
      case "ONGOING":
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
      case "PLANNING":
        return "border-amber-200 bg-amber-50 text-amber-700";
      case "COMPLETED":
        return "border-slate-200 bg-slate-100 text-slate-500";
      default:
        return "border-slate-200 bg-slate-50 text-slate-600";
    }
  }

  function lifecycleLabel(status: string) {
    switch (status) {
      case "ONGOING":
        return "Laufend";
      case "PLANNING":
        return "In Planung";
      case "COMPLETED":
        return "Abgeschlossen";
      default:
        return status;
    }
  }

  return (
    <div className="space-y-8">
      {/* ── Season selection ─────────────────────────────────────────────────── */}
      <section aria-labelledby="section-season-heading">
        <div className="mb-4">
          <h3
            id="section-season-heading"
            className="text-sm font-semibold text-[var(--foreground)]"
          >
            Saison
          </h3>
          <p className="mt-1 text-xs text-[var(--text-2)]">
            Wähle die Saison, für die das Team registriert wird.
          </p>
        </div>

        {loading ? (
          <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--surface-2)]" />
        ) : seasons.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-5 py-6 text-center">
            <Calendar className="mx-auto mb-2 h-7 w-7 text-[var(--text-3)]" aria-hidden="true" />
            <p className="font-semibold text-[var(--foreground)]">
              Keine verfügbare Saison
            </p>
            <p className="mt-1 text-sm text-[var(--text-2)]">
              Lege zuerst eine aktive Saison an, bevor du ein Team registrierst.
            </p>
            <Link
              href="/dashboard/seasons"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--sce-primary)] underline-offset-4 hover:underline"
            >
              Zur Saisonverwaltung
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            <label htmlFor={seasonSelectId} className="sr-only">
              Saison auswählen
            </label>
            <select
              id={seasonSelectId}
              value={selectedSeasonId}
              onChange={(e) => onSeasonChange(e.target.value)}
              className="fca-select w-full"
              required
              aria-required="true"
              aria-describedby="season-hint"
            >
              <option value="">Saison wählen …</option>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                  {season.lifecycleStatus === "ONGOING" ? " (Laufend)" : ""}
                  {season.lifecycleStatus === "PLANNING" ? " (In Planung)" : ""}
                  {season.lifecycleStatus === "COMPLETED" ? " (Abgeschlossen)" : ""}
                </option>
              ))}
            </select>

            {/* Selected season summary */}
            {selectedSeason && (
              <div
                id="season-hint"
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium",
                  lifecycleBadgeClass(selectedSeason.lifecycleStatus),
                )}
                aria-live="polite"
              >
                <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                {selectedSeason.name} —{" "}
                {lifecycleLabel(selectedSeason.lifecycleStatus)}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── OrgUnit selection ────────────────────────────────────────────────── */}
      <section aria-labelledby="section-orgunit-heading">
        <div className="mb-4">
          <h3
            id="section-orgunit-heading"
            className="text-sm font-semibold text-[var(--foreground)]"
          >
            Organisationseinheiten{" "}
            <span className="text-[var(--sce-danger)]" aria-hidden="true">
              *
            </span>
          </h3>
          <p className="mt-1 text-xs text-[var(--text-2)]">
            Wähle mindestens eine Organisationseinheit. Die erste gewählte Einheit
            wird als primär markiert.
          </p>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-lg bg-[var(--surface-2)]"
              />
            ))}
          </div>
        ) : orgUnits.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-5 py-6 text-center">
            <Building2 className="mx-auto mb-2 h-7 w-7 text-[var(--text-3)]" aria-hidden="true" />
            <p className="font-semibold text-[var(--foreground)]">
              Keine Organisationseinheiten verfügbar
            </p>
            <p className="mt-1 text-sm text-[var(--text-2)]">
              Lege im Organisation Builder mindestens eine aktive
              Organisationseinheit an.
            </p>
            <Link
              href="/dashboard/org-units"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--sce-primary)] underline-offset-4 hover:underline"
            >
              Zum Organisation Builder
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Search */}
            {orgUnits.length > 6 && (
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-3)]"
                  aria-hidden="true"
                />
                <input
                  id={searchId}
                  type="search"
                  value={orgUnitSearch}
                  onChange={(e) => setOrgUnitSearch(e.target.value)}
                  placeholder="Einheiten suchen …"
                  className="fca-input w-full pl-9 text-sm"
                  aria-label="Organisationseinheiten filtern"
                />
              </div>
            )}

            {/* OrgUnit list */}
            <fieldset>
              <legend className="sr-only">Organisationseinheiten auswählen</legend>
              <div
                className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]"
                role="group"
                aria-labelledby="section-orgunit-heading"
              >
                {filteredOrgUnits.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-[var(--text-2)]">
                    Keine Einheiten gefunden.
                  </p>
                ) : (
                  filteredOrgUnits.map((ou) => {
                    const isSelected = selectedOrgUnitIds.includes(ou.id);
                    const isPrimary =
                      isSelected && selectedOrgUnitIds[0] === ou.id;

                    return (
                      <label
                        key={ou.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 px-4 py-3",
                          "transition-colors hover:bg-[var(--surface-2)]",
                          "first:rounded-t-xl last:rounded-b-xl",
                          isSelected &&
                            "bg-[color-mix(in_srgb,var(--sce-primary)_5%,transparent)]",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onOrgUnitToggle(ou.id)}
                          className="h-4 w-4 rounded border-[var(--border)] accent-[var(--sce-primary)]"
                          aria-describedby={isPrimary ? `primary-${ou.id}` : undefined}
                        />

                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="truncate text-sm font-medium text-[var(--foreground)]">
                            {ou.name}
                          </span>
                          {ou.key && (
                            <span className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-3)] ring-1 ring-[var(--border)]">
                              {ou.key}
                            </span>
                          )}
                        </div>

                        {isPrimary && (
                          <span
                            id={`primary-${ou.id}`}
                            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--sce-primary)] bg-[color-mix(in_srgb,var(--sce-primary)_10%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--sce-primary)]"
                          >
                            <Star className="h-2.5 w-2.5" aria-hidden="true" />
                            Primär
                          </span>
                        )}

                        {isSelected && !isPrimary && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              onPrimaryChange(ou.id);
                            }}
                            aria-label={`${ou.name} als primär festlegen`}
                            className="shrink-0 text-xs"
                          >
                            Als primär
                          </Button>
                        )}
                      </label>
                    );
                  })
                )}
              </div>
            </fieldset>

            {/* Selected summary */}
            {selectedOrgUnitIds.length > 0 && (
              <div
                className="rounded-lg bg-[var(--surface-2)] px-4 py-3"
                aria-live="polite"
                aria-label="Ausgewählte Organisationseinheiten"
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">
                  Ausgewählt ({selectedOrgUnitIds.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedOrgUnitIds.map((id, index) => {
                    const ou = orgUnits.find((o) => o.id === id);
                    if (!ou) return null;
                    return (
                      <span
                        key={id}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                          index === 0
                            ? "border-[var(--sce-primary)] bg-[color-mix(in_srgb,var(--sce-primary)_10%,transparent)] text-[var(--sce-primary)]"
                            : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)]",
                        )}
                      >
                        {index === 0 && (
                          <Star className="h-2.5 w-2.5" aria-hidden="true" />
                        )}
                        {ou.name}
                        <button
                          type="button"
                          onClick={() => onOrgUnitToggle(id)}
                          aria-label={`${ou.name} entfernen`}
                          className="ml-0.5 rounded-full hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)]"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
