"use client";

/**
 * ProviderMappingAssignForm
 *
 * Assignment form for an unmapped TeamExternalMapping row.
 *
 * Allows the administrator to select a canonical TeamSeason from this tenant
 * and assign it to the provider team. On success, navigates back to the
 * TeamSeason-based mapping page so the assignment can be reviewed.
 *
 * Uses POST /api/provider-mapping to create the assignment.
 * The server uses upsert semantics — the existing unmapped row is updated
 * rather than creating a duplicate.
 *
 * German UI. Client Component.
 * TEAM-PROVIDER-01.
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Link2, CheckCircle2, AlertCircle, Loader2, Search } from "lucide-react";
import type { ProviderMappingDto } from "@/lib/provider-mapping/types";
import type { EligibleTeamSeason } from "@/lib/provider-mapping/provider-mapping-queries";
import { SectionCard } from "@/components/ui/page";

// ── Props ──────────────────────────────────────────────────────────────────────

type Props = {
  mapping: ProviderMappingDto;
  eligibleTeamSeasons: EligibleTeamSeason[];
  canManage: boolean;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProviderMappingAssignForm({
  mapping,
  eligibleTeamSeasons,
  canManage,
}: Props) {
  const router = useRouter();
  const [selectedTeamSeasonId, setSelectedTeamSeasonId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const filteredSeasons = eligibleTeamSeasons.filter((ts) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      ts.displayName.toLowerCase().includes(q) ||
      ts.teamName.toLowerCase().includes(q) ||
      ts.seasonName.toLowerCase().includes(q)
    );
  });

  const handleAssign = useCallback(async () => {
    if (!selectedTeamSeasonId) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/provider-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamSeasonId: selectedTeamSeasonId,
          provider: mapping.provider,
          externalTeamId: mapping.externalTeamId,
          externalSeasonId: mapping.externalSeasonId,
          competitionId: mapping.mappingCompetitionId ?? undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(
          data?.error ?? data?.message ?? `Fehler beim Speichern (${response.status}).`
        );
        return;
      }

      if (data.ok === false) {
        setError(data.message ?? "Zuordnung fehlgeschlagen.");
        return;
      }

      setSuccess(true);
      // Navigate to the TeamSeason-based page to confirm the assignment.
      router.push(
        `/dashboard/teams/provider-mapping/${selectedTeamSeasonId}?mappingId=${mapping.id}`
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setSaving(false);
    }
  }, [selectedTeamSeasonId, mapping, router]);

  return (
    <div className="space-y-6">
      {/* Provider team details */}
      <SectionCard title="Anbieter-Team">
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Anbieter</p>
            <p className="mt-1 font-mono font-medium text-[var(--foreground)]">{mapping.provider}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Team-Name (Anbieter)</p>
            <p className="mt-1 font-medium text-[var(--foreground)]">
              {mapping.providerTeamName ?? <span className="text-[var(--muted)]">—</span>}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Externe Team-ID</p>
            <p className="mt-1 font-mono text-[var(--foreground)]">{mapping.externalTeamId}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Externe Saison-ID</p>
            <p className="mt-1 font-mono text-[var(--foreground)]">{mapping.externalSeasonId}</p>
          </div>
          {mapping.providerLeagueName && (
            <div>
              <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Liga (Anbieter)</p>
              <p className="mt-1 text-[var(--foreground)]">{mapping.providerLeagueName}</p>
            </div>
          )}
          {mapping.mappingCompetitionName && (
            <div>
              <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Wettbewerb (Kontext)</p>
              <p className="mt-1 text-[var(--foreground)]">{mapping.mappingCompetitionName}</p>
            </div>
          )}
        </div>
      </SectionCard>

      {/* TeamSeason assignment */}
      <SectionCard title="Kanon. TeamSeason zuordnen">
        {!canManage ? (
          <p className="text-sm text-[var(--muted)]">
            Sie haben keine Berechtigung, Zuordnungen zu bearbeiten.
          </p>
        ) : eligibleTeamSeasons.length === 0 ? (
          <div className="py-8 text-center text-[var(--muted)]">
            <Link2 className="mx-auto mb-2 h-8 w-8 text-[var(--border-strong)]" />
            <p className="font-medium">Keine verfügbaren TeamSaison-Einträge</p>
            <p className="mt-1 text-xs">
              Erstellen Sie zunächst eine TeamSaison unter Teams, bevor Sie eine Zuordnung vornehmen.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="text"
                placeholder="TeamSaison suchen…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] py-2 pl-8 pr-3 text-sm outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/20"
              />
            </div>

            {/* TeamSeason list */}
            {filteredSeasons.length === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--muted)]">
                Keine Einträge für &bdquo;{search}&ldquo; gefunden.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-md border border-[var(--border)] divide-y divide-[var(--border)]">
                {filteredSeasons.map((ts) => (
                  <label
                    key={ts.id}
                    className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <input
                      type="radio"
                      name="teamSeasonId"
                      value={ts.id}
                      checked={selectedTeamSeasonId === ts.id}
                      onChange={(e) => setSelectedTeamSeasonId(e.target.value)}
                      className="accent-[var(--blue)]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-[var(--foreground)] truncate">
                          {ts.displayName}
                        </span>
                        {ts.status !== "ACTIVE" && (
                          <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            {ts.status}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--muted)] truncate">
                        {ts.teamName} · {ts.seasonName}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* Feedback */}
            {error && (
              <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Zuordnung gespeichert. Weiterleitung…</span>
              </div>
            )}

            {/* Action */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.push("/dashboard/teams/provider-mapping")}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)]"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={!selectedTeamSeasonId || saving || success}
                onClick={handleAssign}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--blue)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Speichern…
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4" />
                    Zuordnung speichern
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
