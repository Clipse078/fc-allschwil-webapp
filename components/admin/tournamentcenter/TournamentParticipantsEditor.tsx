"use client";

/**
 * components/admin/tournamentcenter/TournamentParticipantsEditor.tsx
 *
 * TOURNAMENTCENTER-01B — "Teilnehmende Teams" editor.
 *
 * Supports a variable, unbounded number of participants mixing
 * tenant-owned canonical Teams and Club-Directory ExternalTeams (and, as a
 * smallest clean fallback, a free-text manual label for a genuinely
 * unknown team). Per-participant Garderobe allocation is only shown for
 * HOME tournaments (AWAY tournaments have no FCA dressing-room
 * requirement — see lib/tournaments/operational-state.ts).
 */

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Building2, Loader2, Plus, Shirt, Trash2, UserRound, UsersRound } from "lucide-react";
import type {
  TournamentHomeAway,
  TournamentParticipantDto,
} from "@/lib/tournaments/types";
import { FacilityResourceSelector, type FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";

type TeamOption = {
  id: string;
  name: string;
  ageGroup: string | null;
  genderGroup: string | null;
  isActive: boolean;
};

type ExternalTeamOption = {
  id: string;
  name: string;
  shortName: string | null;
  categoryLabel: string | null;
  externalClub: { id: string; name: string; shortName: string | null };
};

type Props = {
  tournamentId: string;
  canManage: boolean;
  homeAway: TournamentHomeAway;
  initialParticipants: TournamentParticipantDto[];
  /** Non-archived DRESSING_ROOM resources, grouped by facility — only relevant for HOME tournaments. */
  dressingRoomFacilityGroups: FacilityGroup[];
};

function participantSubLabel(participant: TournamentParticipantDto): string | null {
  if (participant.kind === "TEAM" && participant.team) {
    const suffix = [participant.team.ageGroup, participant.team.genderGroup].filter(Boolean).join(" / ");
    return suffix || null;
  }
  if (participant.kind === "EXTERNAL_TEAM" && participant.externalTeam) {
    const parts = [participant.externalTeam.club.name, participant.externalTeam.categoryLabel].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : null;
  }
  return "Manuell erfasst — kein kanonisches Team verknüpft";
}

export default function TournamentParticipantsEditor({
  tournamentId,
  canManage,
  homeAway,
  initialParticipants,
  dressingRoomFacilityGroups,
}: Props) {
  const [participants, setParticipants] = useState<TournamentParticipantDto[]>(initialParticipants);
  const [error, setError] = useState<string | null>(null);

  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [externalTeams, setExternalTeams] = useState<ExternalTeamOption[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [externalTeamsLoading, setExternalTeamsLoading] = useState(false);

  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedExternalTeamId, setSelectedExternalTeamId] = useState("");
  const [manualLabel, setManualLabel] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!canManage) return;
    let active = true;

    async function load() {
      setTeamsLoading(true);
      setExternalTeamsLoading(true);
      try {
        const [teamsRes, externalTeamsRes] = await Promise.all([
          fetch("/api/teams", { cache: "no-store" }),
          fetch("/api/club-directory/teams", { cache: "no-store" }),
        ]);
        const teamsData = (await teamsRes.json().catch(() => null)) as TeamOption[] | null;
        const externalTeamsData = (await externalTeamsRes.json().catch(() => null)) as {
          teams?: ExternalTeamOption[];
        } | null;

        if (!active) return;
        setTeams(Array.isArray(teamsData) ? teamsData.filter((t) => t.isActive) : []);
        setExternalTeams(externalTeamsData?.teams ?? []);
      } finally {
        if (active) {
          setTeamsLoading(false);
          setExternalTeamsLoading(false);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [canManage]);

  const assignedTeamIds = useMemo(
    () => new Set(participants.map((p) => p.team?.id).filter((id): id is string => !!id)),
    [participants],
  );
  const assignedExternalTeamIds = useMemo(
    () => new Set(participants.map((p) => p.externalTeam?.id).filter((id): id is string => !!id)),
    [participants],
  );

  const availableTeams = teams.filter((t) => !assignedTeamIds.has(t.id));
  const availableExternalTeams = externalTeams.filter((t) => !assignedExternalTeamIds.has(t.id));

  const externalTeamsByClub = useMemo(() => {
    const groups = new Map<string, { clubName: string; teams: ExternalTeamOption[] }>();
    for (const team of availableExternalTeams) {
      const group = groups.get(team.externalClub.id) ?? {
        clubName: team.externalClub.name,
        teams: [],
      };
      group.teams.push(team);
      groups.set(team.externalClub.id, group);
    }
    return Array.from(groups.values());
  }, [availableExternalTeams]);

  const addParticipant = useCallback(
    (body: { teamId?: string } | { externalTeamId?: string } | { manualLabel?: string }) => {
      setError(null);
      startTransition(async () => {
        try {
          const res = await fetch(`/api/tournaments/${tournamentId}/participants`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = (await res.json().catch(() => null)) as
            | { participant?: TournamentParticipantDto; error?: string }
            | null;
          if (!res.ok || !data?.participant) {
            throw new Error(data?.error ?? "Teilnehmer konnte nicht hinzugefügt werden.");
          }
          setParticipants((prev) => [...prev, data.participant as TournamentParticipantDto]);
          setSelectedTeamId("");
          setSelectedExternalTeamId("");
          setManualLabel("");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Teilnehmer konnte nicht hinzugefügt werden.");
        }
      });
    },
    [tournamentId],
  );

  const removeParticipant = useCallback(
    (participantId: string) => {
      setError(null);
      startTransition(async () => {
        try {
          const res = await fetch(`/api/tournaments/${tournamentId}/participants/${participantId}`, {
            method: "DELETE",
          });
          if (!res.ok) {
            const data = (await res.json().catch(() => null)) as { error?: string } | null;
            throw new Error(data?.error ?? "Teilnehmer konnte nicht entfernt werden.");
          }
          setParticipants((prev) => prev.filter((p) => p.id !== participantId));
        } catch (err) {
          setError(err instanceof Error ? err.message : "Teilnehmer konnte nicht entfernt werden.");
        }
      });
    },
    [tournamentId],
  );

  const addDressingRoom = useCallback(
    async (participantId: string, facilityResourceId: string) => {
      const res = await fetch(
        `/api/tournaments/${tournamentId}/participants/${participantId}/dressing-room-allocations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ facilityResourceId }),
        },
      );
      const data = (await res.json().catch(() => null)) as
        | { allocation?: TournamentParticipantDto["dressingRoomAllocations"][number]; error?: string }
        | null;
      if (!res.ok || !data?.allocation) {
        throw new Error(data?.error ?? "Garderobe konnte nicht zugewiesen werden.");
      }
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === participantId
            ? { ...p, dressingRoomAllocations: [...p.dressingRoomAllocations, data.allocation!] }
            : p,
        ),
      );
    },
    [tournamentId],
  );

  const removeDressingRoom = useCallback(
    async (participantId: string, allocationId: string) => {
      const res = await fetch(
        `/api/tournaments/${tournamentId}/participants/${participantId}/dressing-room-allocations/${allocationId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Garderobe konnte nicht entfernt werden.");
      }
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === participantId
            ? {
                ...p,
                dressingRoomAllocations: p.dressingRoomAllocations.filter((a) => a.id !== allocationId),
              }
            : p,
        ),
      );
    },
    [tournamentId],
  );

  return (
    <div className="space-y-4" data-testid="tournament-participants-editor">
      {participants.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-[var(--border)] py-8 text-center">
          <UsersRound className="mx-auto mb-2 h-6 w-6 text-[var(--muted)]" aria-hidden />
          <p className="text-sm text-[var(--text-2)]">Noch keine Teams zugeordnet.</p>
        </div>
      ) : (
        <ul className="space-y-2" data-testid="tournament-participant-list">
          {participants.map((participant) => (
            <li
              key={participant.id}
              data-testid={`tournament-participant-row-${participant.id}`}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  {participant.kind === "TEAM" ? (
                    <UsersRound className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sce-primary)]" aria-hidden />
                  ) : participant.kind === "EXTERNAL_TEAM" ? (
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sce-info)]" aria-hidden />
                  ) : (
                    <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                      {participant.displayName}
                    </p>
                    {participantSubLabel(participant) ? (
                      <p className="mt-0.5 text-xs text-[var(--text-2)]">{participantSubLabel(participant)}</p>
                    ) : null}
                  </div>
                </div>

                {canManage && (
                  <button
                    type="button"
                    onClick={() => removeParticipant(participant.id)}
                    disabled={isPending}
                    aria-label={`${participant.displayName} entfernen`}
                    data-testid={`tournament-participant-remove-${participant.id}`}
                    className="shrink-0 rounded p-1 text-[var(--muted)] transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {homeAway === "HOME" && (
                <div className="mt-3 border-t border-[var(--border)] pt-3">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    <Shirt className="h-3.5 w-3.5" aria-hidden />
                    Garderobe
                  </p>

                  {participant.dressingRoomAllocations.length > 0 && (
                    <ul className="mb-2 flex flex-wrap gap-1.5">
                      {participant.dressingRoomAllocations.map((allocation) => (
                        <li
                          key={allocation.id}
                          className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs text-[var(--text-2)]"
                        >
                          {allocation.facilityResourceName}
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => {
                                setError(null);
                                startTransition(async () => {
                                  try {
                                    await removeDressingRoom(participant.id, allocation.id);
                                  } catch (err) {
                                    setError(
                                      err instanceof Error
                                        ? err.message
                                        : "Garderobe konnte nicht entfernt werden.",
                                    );
                                  }
                                });
                              }}
                              disabled={isPending}
                              aria-label={`Garderobe ${allocation.facilityResourceName} entfernen`}
                              className="text-[var(--muted)] hover:text-rose-600"
                            >
                              ×
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {canManage && (
                    <FacilityResourceSelector
                      facilityGroups={dressingRoomFacilityGroups}
                      allocatedResourceIds={
                        new Set(participant.dressingRoomAllocations.map((a) => a.facilityResourceId))
                      }
                      onAdd={(resourceId) => addDressingRoom(participant.id, resourceId)}
                      placeholder="Garderobe auswählen…"
                      addButtonLabel="Zuweisen"
                      testId={`tournament-participant-${participant.id}-dressing-room`}
                    />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}

      {canManage && (
        <div className="space-y-3 rounded-lg border border-dashed border-[var(--border)] p-4">
          <p className="text-sm font-medium text-[var(--text-2)]">Team hinzufügen</p>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex gap-2">
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                disabled={teamsLoading || isPending}
                data-testid="tournament-participant-add-team-select"
                className="fca-select flex-1"
              >
                <option value="">
                  {teamsLoading ? "Teams laden…" : "FC Allschwil Team…"}
                </option>
                {availableTeams.map((team) => {
                  const suffix = [team.ageGroup, team.genderGroup].filter(Boolean).join(" / ");
                  return (
                    <option key={team.id} value={team.id}>
                      {suffix ? `${team.name} · ${suffix}` : team.name}
                    </option>
                  );
                })}
              </select>
              <button
                type="button"
                onClick={() => selectedTeamId && addParticipant({ teamId: selectedTeamId })}
                disabled={!selectedTeamId || isPending}
                data-testid="tournament-participant-add-team-button"
                className="fca-button-secondary shrink-0"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex gap-2">
              <select
                value={selectedExternalTeamId}
                onChange={(e) => setSelectedExternalTeamId(e.target.value)}
                disabled={externalTeamsLoading || isPending}
                data-testid="tournament-participant-add-external-team-select"
                className="fca-select flex-1"
              >
                <option value="">
                  {externalTeamsLoading ? "Externe Teams laden…" : "Externes Team (Club Directory)…"}
                </option>
                {externalTeamsByClub.map((group) => (
                  <optgroup key={group.clubName} label={group.clubName}>
                    {group.teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  selectedExternalTeamId && addParticipant({ externalTeamId: selectedExternalTeamId })
                }
                disabled={!selectedExternalTeamId || isPending}
                data-testid="tournament-participant-add-external-team-button"
                className="fca-button-secondary shrink-0"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {showManualEntry ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={manualLabel}
                onChange={(e) => setManualLabel(e.target.value)}
                placeholder="z. B. unbekanntes Gastteam"
                disabled={isPending}
                data-testid="tournament-participant-manual-input"
                className="fca-input flex-1"
              />
              <button
                type="button"
                onClick={() => manualLabel.trim() && addParticipant({ manualLabel: manualLabel.trim() })}
                disabled={!manualLabel.trim() || isPending}
                data-testid="tournament-participant-add-manual-button"
                className="fca-button-secondary shrink-0"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowManualEntry(true)}
              className="text-xs font-medium text-[var(--muted)] underline-offset-2 hover:underline"
            >
              Team ohne Verzeichniseintrag manuell erfassen…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
