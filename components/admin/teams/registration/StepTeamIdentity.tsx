"use client";

import { useId, useMemo, useState } from "react";
import { AlertTriangle, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { normalizeTeamSlug } from "@/lib/teams/team-season-rules";
import type { ExistingTeam, WizardFormData } from "./types";

type Props = {
  form: Pick<
    WizardFormData,
    | "teamName"
    | "teamSlug"
    | "teamShortName"
    | "teamGenderGroup"
    | "teamAgeGroup"
    | "teamSortOrder"
    | "existingTeamId"
  >;
  existingTeams: ExistingTeam[];
  onFieldChange: <K extends keyof WizardFormData>(key: K, value: WizardFormData[K]) => void;
  validationErrors: Partial<Record<string, string>>;
};

/**
 * StepTeamIdentity — Step 2 of the Team registration wizard.
 *
 * Captures Team identity fields:
 *   - Teamname (required)
 *   - Slug (auto-generated, editable)
 *   - Kurzname (optional)
 *   - Geschlecht (optional)
 *   - Altersklasse (optional)
 *   - Sortierung (optional)
 *
 * Also allows explicitly reusing an existing Team identity.
 */
export default function StepTeamIdentity({
  form,
  existingTeams,
  onFieldChange,
  validationErrors,
}: Props) {
  const nameId = useId();
  const slugId = useId();
  const shortNameId = useId();
  const genderGroupId = useId();
  const ageGroupId = useId();
  const sortOrderId = useId();

  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Detect probable duplicates in existing teams by name similarity
  const probableDuplicates = useMemo(() => {
    if (!form.teamName.trim() || form.existingTeamId) return [];
    const term = form.teamName.toLowerCase().trim();
    return existingTeams.filter((t) =>
      t.name.toLowerCase().includes(term) ||
      term.includes(t.name.toLowerCase()),
    );
  }, [form.teamName, form.existingTeamId, existingTeams]);

  function handleNameChange(value: string) {
    onFieldChange("teamName", value);
    if (!slugManuallyEdited) {
      onFieldChange("teamSlug", normalizeTeamSlug(value));
    }
    // Clear existingTeamId if user types a different name
    if (form.existingTeamId) {
      const existing = existingTeams.find((t) => t.id === form.existingTeamId);
      if (existing && existing.name.toLowerCase() !== value.trim().toLowerCase()) {
        onFieldChange("existingTeamId", null);
      }
    }
  }

  function handleSlugChange(value: string) {
    setSlugManuallyEdited(true);
    onFieldChange("teamSlug", normalizeTeamSlug(value));
  }

  function handleReuseTeam(team: ExistingTeam) {
    onFieldChange("existingTeamId", team.id);
    onFieldChange("teamName", team.name);
    if (!slugManuallyEdited) {
      onFieldChange("teamSlug", team.slug);
    }
  }

  function handleClearReuse() {
    onFieldChange("existingTeamId", null);
  }

  const isReusingExisting = form.existingTeamId !== null;
  const reusingTeam = isReusingExisting
    ? existingTeams.find((t) => t.id === form.existingTeamId) ?? null
    : null;

  return (
    <div className="space-y-6">
      {/* ── Existing team reuse ────────────────────────────────────────────── */}
      {probableDuplicates.length > 0 && !isReusingExisting && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4"
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-800">
                Ähnlich benanntes Team vorhanden
              </p>
              <p className="mt-0.5 text-xs text-amber-700">
                Ein ähnlich benanntes Team existiert bereits. Möchtest du dieses
                bestehende Team für diese Saison registrieren?
              </p>

              <div className="mt-3 space-y-1.5">
                {probableDuplicates.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-amber-900">
                        {team.name}
                      </p>
                      <p className="font-mono text-xs text-amber-600">
                        /{team.slug}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleReuseTeam(team)}
                      className={cn(
                        "shrink-0 rounded-lg border border-amber-300 px-3 py-1.5",
                        "text-xs font-semibold text-amber-800",
                        "hover:bg-amber-100 transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                      )}
                    >
                      Bestehendes Team für diese Saison registrieren
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Reusing existing team banner ───────────────────────────────────── */}
      {isReusingExisting && reusingTeam && (
        <div
          className="flex items-center justify-between gap-4 rounded-xl border border-[var(--sce-primary)] bg-[color-mix(in_srgb,var(--sce-primary)_6%,transparent)] px-4 py-3"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3">
            <Users
              className="h-4 w-4 shrink-0 text-[var(--sce-primary)]"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Bestehendes Team wird wiederverwendet
              </p>
              <p className="text-xs text-[var(--text-2)]">
                {reusingTeam.name}{" "}
                <span className="font-mono text-[var(--text-3)]">
                  /{reusingTeam.slug}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearReuse}
            className={cn(
              "shrink-0 rounded-lg border border-[var(--border-strong)] px-3 py-1.5",
              "text-xs font-semibold text-[var(--text-2)]",
              "hover:bg-[var(--surface-2)] transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)]",
            )}
            aria-label="Wiederverwendung aufheben"
          >
            Abbrechen
          </button>
        </div>
      )}

      {/* ── Required: Teamname ─────────────────────────────────────────────── */}
      <div>
        <label htmlFor={nameId} className="block space-y-1.5">
          <span className="fca-label">
            Teamname{" "}
            <span className="text-[var(--sce-danger)]" aria-hidden="true">
              *
            </span>
          </span>
          <input
            id={nameId}
            type="text"
            value={form.teamName}
            onChange={(e) => handleNameChange(e.target.value)}
            className={cn(
              "fca-input w-full",
              validationErrors.teamName && "border-[var(--sce-danger)]",
            )}
            placeholder="z. B. Frauen 1"
            required
            aria-required="true"
            aria-describedby={
              validationErrors.teamName ? `${nameId}-error` : undefined
            }
            disabled={isReusingExisting}
          />
          {validationErrors.teamName && (
            <p
              id={`${nameId}-error`}
              className="text-xs font-medium text-[var(--sce-danger)]"
              role="alert"
            >
              {validationErrors.teamName}
            </p>
          )}
        </label>
      </div>

      {/* ── Optional: Kurzname ────────────────────────────────────────────── */}
      <div>
        <label htmlFor={shortNameId} className="block space-y-1.5">
          <span className="fca-label">Kurzname</span>
          <input
            id={shortNameId}
            type="text"
            value={form.teamShortName}
            onChange={(e) => onFieldChange("teamShortName", e.target.value)}
            className="fca-input w-full"
            placeholder="z. B. F1"
          />
        </label>
        <p className="mt-1 text-xs text-[var(--text-2)]">
          Wird für Platzanzeigen und kompakte Ansichten verwendet.
        </p>
      </div>

      {/* ── Slug (advanced, shown collapsed) ─────────────────────────────── */}
      <div>
        <label htmlFor={slugId} className="block space-y-1.5">
          <span className="fca-label">URL-Pfad</span>
          <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-mono text-sm focus-within:border-[var(--sce-primary)] focus-within:ring-1 focus-within:ring-[var(--sce-primary)]">
            <span className="shrink-0 text-[var(--text-3)]">/</span>
            <input
              id={slugId}
              type="text"
              value={form.teamSlug}
              onChange={(e) => handleSlugChange(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[var(--foreground)] outline-none"
              aria-describedby={`${slugId}-hint`}
              disabled={isReusingExisting}
            />
          </div>
        </label>
        <p
          id={`${slugId}-hint`}
          className="mt-1 text-xs text-[var(--text-2)]"
        >
          Wird automatisch aus dem Teamnamen generiert. Innerhalb deiner
          Organisation eindeutig.
        </p>
        {validationErrors.teamSlug && (
          <p
            className="mt-1 text-xs font-medium text-[var(--sce-danger)]"
            role="alert"
          >
            {validationErrors.teamSlug}
          </p>
        )}
      </div>

      {/* ── Optional fields grid ──────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={genderGroupId} className="block space-y-1.5">
            <span className="fca-label">Geschlechtergruppe</span>
            <input
              id={genderGroupId}
              type="text"
              value={form.teamGenderGroup}
              onChange={(e) => onFieldChange("teamGenderGroup", e.target.value)}
              className="fca-input w-full"
              placeholder="z. B. Mixed, Boys"
            />
          </label>
        </div>

        <div>
          <label htmlFor={ageGroupId} className="block space-y-1.5">
            <span className="fca-label">Altersklasse / Stufe</span>
            <input
              id={ageGroupId}
              type="text"
              value={form.teamAgeGroup}
              onChange={(e) => onFieldChange("teamAgeGroup", e.target.value)}
              className="fca-input w-full"
              placeholder="z. B. U18, Aktive"
            />
          </label>
        </div>

        <div>
          <label htmlFor={sortOrderId} className="block space-y-1.5">
            <span className="fca-label">Sortierung</span>
            <input
              id={sortOrderId}
              type="number"
              value={form.teamSortOrder}
              onChange={(e) =>
                onFieldChange("teamSortOrder", Number(e.target.value))
              }
              className="fca-input w-full"
              min={0}
            />
          </label>
          <p className="mt-1 text-xs text-[var(--text-2)]">
            Steuert die Reihenfolge in der Teamübersicht.
          </p>
        </div>
      </div>

      {/* ── Hidden: existingTeamId for screen-reader awareness ────────────── */}
      {isReusingExisting && (
        <p className="sr-only" aria-live="polite">
          Bestehendes Team {reusingTeam?.name} wird für diese Saison
          registriert.
        </p>
      )}
    </div>
  );
}
