"use client";

/**
 * ProviderMappingDetail
 *
 * Premium mapping workflow for a single TeamSeason.
 *
 * Workflow:
 *   1. Show current mappings (if any)
 *   2. Select provider
 *   3. Select competition (context — narrows provider search)
 *   4. Load suggestions from /api/provider-mapping/suggest
 *   5. Pick a suggestion or enter external team ID manually
 *   6. Confirm → POST /api/provider-mapping
 *
 * Allows create, replace, and remove operations.
 * Read-only when canManage = false.
 *
 * German UI. Provider-neutral.
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Link2, Unlink, RotateCcw, CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import type { ProviderMappingDto, MappingSuggestion } from "@/lib/provider-mapping/types";
import { SectionCard } from "@/components/ui/page";

// ── Types ─────────────────────────────────────────────────────────────────────

type Competition = {
  id: string;
  officialName: string;
  shortName: string | null;
  provider: string;
  ageCategory: string | null;
  gender: string | null;
  externalCompetitionId: number | null;
  externalSeasonId: number | null;
  isArchived: boolean;
  isPrimary: boolean;
};

type TeamSeasonContext = {
  id: string;
  displayName: string;
  shortName: string | null;
  status: string;
  participationType: string;
  teamName: string;
  ageGroup: string | null;
  genderGroup: string | null;
  seasonId: string;
  seasonName: string;
  competitions: Competition[];
};

type Props = {
  teamSeason: TeamSeasonContext;
  currentMappings: ProviderMappingDto[];
  canManage: boolean;
  focusMappingId?: string;
};

// ── Label helpers ─────────────────────────────────────────────────────────────

const CONFIDENCE_CONFIG: Record<string, { label: string; colorClass: string; dotClass: string }> = {
  HIGH: {
    label: "Hohe Konfidenz",
    colorClass: "bg-green-50 border-green-200 text-green-800",
    dotClass: "bg-green-500",
  },
  MEDIUM: {
    label: "Mittlere Konfidenz",
    colorClass: "bg-yellow-50 border-yellow-200 text-yellow-800",
    dotClass: "bg-yellow-500",
  },
  LOW: {
    label: "Niedrige Konfidenz",
    colorClass: "bg-orange-50 border-orange-200 text-orange-800",
    dotClass: "bg-orange-500",
  },
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function ProviderMappingDetail({
  teamSeason,
  currentMappings,
  canManage,
  focusMappingId,
}: Props) {
  const router = useRouter();

  // Workflow state
  const [showWorkflow, setShowWorkflow] = useState(
    canManage && currentMappings.length === 0,
  );
  const [selectedProvider, setSelectedProvider] = useState("SFV");
  const [selectedCompetitionId, setSelectedCompetitionId] = useState(
    teamSeason.competitions[0]?.id ?? "",
  );

  // Suggestion state
  const [suggestions, setSuggestions] = useState<MappingSuggestion[] | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  // Confirmation state
  const [pendingMapping, setPendingMapping] = useState<MappingSuggestion | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null); // mappingId being replaced
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Remove state
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  // Expanded metadata
  const [expandedMetaId, setExpandedMetaId] = useState<string | null>(null);

  const activeCompetitions = teamSeason.competitions.filter((c) => !c.isArchived);

  // ── Load suggestions ─────────────────────────────────────────────────────────

  const loadSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    setSuggestError(null);
    setSuggestions(null);
    setPendingMapping(null);

    try {
      const params = new URLSearchParams({
        teamSeasonId: teamSeason.id,
        provider: selectedProvider,
        ...(selectedCompetitionId ? { competitionId: selectedCompetitionId } : {}),
      });
      const res = await fetch(`/api/provider-mapping/suggest?${params}`);
      const data = await res.json();

      if (!res.ok) {
        setSuggestError(data.error ?? "Fehler beim Laden der Vorschläge.");
        return;
      }

      setSuggestions(data.suggestions ?? []);
    } catch {
      setSuggestError("Netzwerkfehler beim Laden der Vorschläge.");
    } finally {
      setLoadingSuggestions(false);
    }
  }, [teamSeason.id, selectedProvider, selectedCompetitionId]);

  // ── Save mapping ─────────────────────────────────────────────────────────────

  const saveMapping = useCallback(
    async (suggestion: MappingSuggestion) => {
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      const body = {
        teamSeasonId: teamSeason.id,
        provider: selectedProvider,
        externalTeamId: suggestion.providerTeam.externalTeamId,
        externalSeasonId: suggestion.providerTeam.externalSeasonId,
        competitionId: selectedCompetitionId || undefined,
        confidenceLevel: suggestion.confidenceLevel,
      };

      try {
        if (replacing) {
          // Replace existing mapping
          const res = await fetch(`/api/provider-mapping/${replacing}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) {
            setSaveError(data.error ?? "Fehler beim Ersetzen.");
            return;
          }
        } else {
          // Create new mapping
          const res = await fetch(`/api/provider-mapping`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) {
            setSaveError(data.error ?? "Fehler beim Erstellen.");
            return;
          }
        }

        setSaveSuccess(true);
        setShowWorkflow(false);
        setPendingMapping(null);
        setReplacing(null);
        setSuggestions(null);
        router.refresh();
      } catch {
        setSaveError("Netzwerkfehler beim Speichern.");
      } finally {
        setSaving(false);
      }
    },
    [teamSeason.id, selectedProvider, selectedCompetitionId, replacing, router],
  );

  // ── Remove mapping ────────────────────────────────────────────────────────────

  const removeMapping = useCallback(
    async (mappingId: string) => {
      if (confirmRemoveId !== mappingId) {
        setConfirmRemoveId(mappingId);
        return;
      }
      setRemovingId(mappingId);
      setConfirmRemoveId(null);

      try {
        await fetch(`/api/provider-mapping/${mappingId}`, { method: "DELETE" });
        router.refresh();
      } finally {
        setRemovingId(null);
      }
    },
    [confirmRemoveId, router],
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Success message */}
      {saveSuccess && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Zuordnung erfolgreich gespeichert.
        </div>
      )}

      {/* Current mappings */}
      <SectionCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Aktuelle Zuordnungen</h3>
          {canManage && (
            <button
              onClick={() => {
                setShowWorkflow(!showWorkflow);
                setReplacing(null);
                setSuggestions(null);
                setPendingMapping(null);
                setSaveError(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors"
            >
              <Link2 className="w-3.5 h-3.5" />
              Neue Zuordnung
            </button>
          )}
        </div>

        {currentMappings.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Unlink className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">Noch keine Anbieter-Zuordnung vorhanden.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentMappings.map((mapping) => (
              <CurrentMappingCard
                key={mapping.id}
                mapping={mapping}
                canManage={canManage}
                isExpanded={expandedMetaId === mapping.id}
                onToggleExpand={() =>
                  setExpandedMetaId(expandedMetaId === mapping.id ? null : mapping.id)
                }
                isRemoving={removingId === mapping.id}
                isConfirmingRemove={confirmRemoveId === mapping.id}
                onRemove={() => removeMapping(mapping.id)}
                onReplace={() => {
                  setReplacing(mapping.id);
                  setShowWorkflow(true);
                  setSuggestions(null);
                  setPendingMapping(null);
                }}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {/* Mapping workflow */}
      {showWorkflow && (
        <SectionCard>
          <h3 className="font-semibold text-gray-900 mb-4">
            {replacing ? "Zuordnung ersetzen" : "Neue Zuordnung erstellen"}
          </h3>

          {/* Provider + Competition selectors */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Anbieter
              </label>
              <select
                value={selectedProvider}
                onChange={(e) => {
                  setSelectedProvider(e.target.value);
                  setSuggestions(null);
                  setPendingMapping(null);
                }}
                className="w-full py-2 px-3 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              >
                <option value="SFV">SFV (Schweizerischer Fussballverband)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Wettbewerb (Kontext)
                <span className="ml-1 text-xs text-gray-400 font-normal">— schränkt die Suche ein</span>
              </label>
              <select
                value={selectedCompetitionId}
                onChange={(e) => {
                  setSelectedCompetitionId(e.target.value);
                  setSuggestions(null);
                  setPendingMapping(null);
                }}
                className="w-full py-2 px-3 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              >
                <option value="">Kein Wettbewerb gewählt</option>
                {activeCompetitions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.officialName} {c.isPrimary ? "(Primär)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Load suggestions button */}
          <button
            onClick={loadSuggestions}
            disabled={loadingSuggestions}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loadingSuggestions ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Vorschläge werden geladen…
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                Vorschläge laden
              </>
            )}
          </button>

          {/* Error */}
          {suggestError && (
            <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {suggestError}
            </div>
          )}

          {/* Suggestions list */}
          {suggestions !== null && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                {suggestions.length === 0
                  ? "Keine Vorschläge gefunden."
                  : `${suggestions.length} Vorschläge`}
              </h4>

              <div className="space-y-2">
                {suggestions.map((s) => {
                  const cfg = CONFIDENCE_CONFIG[s.confidenceLevel];
                  const isSelected =
                    pendingMapping?.providerTeam.externalTeamId === s.providerTeam.externalTeamId;
                  return (
                    <div
                      key={s.providerTeam.externalTeamId}
                      onClick={() => setPendingMapping(isSelected ? null : s)}
                      className={`cursor-pointer border rounded-lg p-4 transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                          : `${cfg?.colorClass ?? "border-gray-200 bg-white"} hover:border-blue-300`
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-gray-900 text-sm">
                            {s.providerTeam.name}
                          </div>
                          {s.providerTeam.leagueName && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {s.providerTeam.leagueName}
                            </div>
                          )}
                          <div className="text-xs text-gray-400 mt-0.5">
                            Team-ID: {s.providerTeam.externalTeamId}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-4">
                          {cfg && (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${cfg.colorClass}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
                              {cfg.label}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">Score: {s.score}</span>
                        </div>
                      </div>

                      {/* Reasons */}
                      {s.reasons.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {s.reasons.map((r, i) => (
                            <span
                              key={i}
                              className="text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      )}

                      {isSelected && (
                        <div className="mt-2 text-xs text-blue-600 font-medium">
                          ✓ Ausgewählt — unten bestätigen
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Confirmation panel */}
          {pendingMapping && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-2">
                Zuordnung bestätigen
              </p>
              <p className="text-sm text-blue-700 mb-3">
                <strong>{teamSeason.displayName}</strong> wird dem Anbieter-Team{" "}
                <strong>{pendingMapping.providerTeam.name}</strong> (
                {selectedProvider}, ID {pendingMapping.providerTeam.externalTeamId}) zugeordnet.
              </p>
              {saveError && (
                <div className="mb-3 flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {saveError}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => saveMapping(pendingMapping)}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {replacing ? "Ersetzen bestätigen" : "Zuordnung speichern"}
                </button>
                <button
                  onClick={() => {
                    setPendingMapping(null);
                    setSaveError(null);
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {/* TeamSeason metadata */}
      <SectionCard>
        <h3 className="font-semibold text-gray-900 mb-3">TeamSeason-Informationen</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <InfoRow label="Team" value={teamSeason.teamName} />
          <InfoRow label="Saison" value={teamSeason.seasonName} />
          <InfoRow label="Anzeigename" value={teamSeason.displayName} />
          <InfoRow label="Status" value={teamSeason.status} />
          <InfoRow label="Teilnahmetyp" value={teamSeason.participationType} />
          {teamSeason.ageGroup && <InfoRow label="Altersgruppe" value={teamSeason.ageGroup} />}
          {teamSeason.genderGroup && <InfoRow label="Geschlecht" value={teamSeason.genderGroup} />}
        </div>

        {activeCompetitions.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Wettbewerbe
            </p>
            <div className="flex flex-wrap gap-2">
              {activeCompetitions.map((c) => (
                <span
                  key={c.id}
                  className={`inline-flex items-center px-2 py-1 rounded text-xs border ${
                    c.isPrimary
                      ? "bg-blue-50 border-blue-200 text-blue-700"
                      : "bg-gray-50 border-gray-200 text-gray-600"
                  }`}
                >
                  {c.officialName}
                  {c.isPrimary && (
                    <span className="ml-1 text-blue-500 text-xs">(Primär)</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 w-32 flex-shrink-0">{label}:</span>
      <span className="text-gray-900">{value ?? "—"}</span>
    </div>
  );
}

function CurrentMappingCard({
  mapping,
  canManage,
  isExpanded,
  onToggleExpand,
  isRemoving,
  isConfirmingRemove,
  onRemove,
  onReplace,
}: {
  mapping: ProviderMappingDto;
  canManage: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isRemoving: boolean;
  isConfirmingRemove: boolean;
  onRemove: () => void;
  onReplace: () => void;
}) {
  const confidenceCfg = mapping.confidenceLevel
    ? CONFIDENCE_CONFIG[mapping.confidenceLevel]
    : null;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Main row */}
      <div className="flex items-center justify-between p-4 bg-white">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-medium text-white bg-gray-700 px-2 py-1 rounded">
            {mapping.provider}
          </span>
          <div>
            <div className="font-medium text-gray-900 text-sm">
              {mapping.providerTeamName ?? `Team ID ${mapping.externalTeamId}`}
            </div>
            {mapping.providerLeagueName && (
              <div className="text-xs text-gray-500">{mapping.providerLeagueName}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {confidenceCfg && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${confidenceCfg.colorClass}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${confidenceCfg.dotClass}`} />
              {confidenceCfg.label}
            </span>
          )}
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
              mapping.mappingSource === "MANUAL"
                ? "bg-blue-100 text-blue-700 border-blue-200"
                : "bg-gray-100 text-gray-600 border-gray-200"
            }`}
          >
            {mapping.mappingSource === "MANUAL" ? "Manuell" : "Sync"}
          </span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
              mapping.providerIsActive
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-red-50 text-red-600 border-red-200"
            }`}
          >
            {mapping.providerIsActive ? "Aktiv" : "Inaktiv"}
          </span>

          {/* Expand metadata */}
          <button
            onClick={onToggleExpand}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Metadaten anzeigen"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* Actions */}
          {canManage && (
            <div className="flex items-center gap-1 border-l border-gray-200 pl-3 ml-1">
              <button
                onClick={onReplace}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Ersetzen
              </button>
              <button
                onClick={onRemove}
                disabled={isRemoving}
                className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                  isConfirmingRemove
                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                    : "text-red-500 hover:text-red-700 hover:bg-red-50"
                }`}
              >
                {isRemoving ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Unlink className="w-3 h-3" />
                )}
                {isConfirmingRemove ? "Bestätigen?" : "Entfernen"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expanded metadata */}
      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Anbieter-Metadaten
          </p>
          <div className="grid grid-cols-3 gap-x-8 gap-y-1.5 text-xs">
            <MetaRow label="Team-ID" value={String(mapping.externalTeamId)} />
            <MetaRow label="Saison-ID" value={String(mapping.externalSeasonId)} />
            <MetaRow label="Anbieter-Name" value={mapping.providerTeamName} />
            <MetaRow label="Liga-ID" value={mapping.providerLeagueId ? String(mapping.providerLeagueId) : null} />
            <MetaRow label="Ligabezeichnung" value={mapping.providerLeagueName} />
            <MetaRow label="Organisations-ID" value={mapping.providerOrganisationId ? String(mapping.providerOrganisationId) : null} />
            {mapping.mappingCompetitionName && (
              <MetaRow label="Kontext-Wettbewerb" value={mapping.mappingCompetitionName} />
            )}
            <MetaRow
              label="Zuletzt synchronisiert"
              value={new Date(mapping.lastSyncedAt).toLocaleString("de-CH")}
            />
            <MetaRow
              label="Erstellt"
              value={new Date(mapping.createdAt).toLocaleString("de-CH")}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-400 w-36 flex-shrink-0">{label}:</span>
      <span className="text-gray-700 font-mono">{value ?? "—"}</span>
    </div>
  );
}
