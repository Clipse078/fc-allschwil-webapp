"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

type TeamSeasonImpact = {
  displayName: string;
  seasonName: string;
  squadMembers: number;
  trainerMembers: number;
  trainingSeries: number;
  trainingSessions: number;
  weekplannerAllocations: number;
  weekplannerOverrides: number;
  competitionAssignments: number;
  externalMappings: number;
};

type TeamSeasonDeleteButtonProps = {
  teamId: string;
  teamSeasonId: string;
  teamSeasonName: string;
};

/**
 * TeamSeasonDeleteButton — permanent-delete action for a TeamSeason.
 *
 * Reuses TEAMS_DELETE. Impact dialog shows cascade children and non-FK weekplanner cleanup.
 * Team, Persons, OrgUnits, Competitions are preserved.
 */
export default function TeamSeasonDeleteButton({
  teamId,
  teamSeasonId,
  teamSeasonName,
}: TeamSeasonDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impact, setImpact] = useState<TeamSeasonImpact | null>(null);

  async function openConfirmation() {
    setOpen(true);
    setError(null);
    setImpact(null);
    setLoadingImpact(true);

    try {
      const response = await fetch(
        `/api/teams/${encodeURIComponent(teamId)}/team-seasons/${encodeURIComponent(teamSeasonId)}/permanent`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Vorschau nicht verfügbar.");
      }

      setImpact(data?.impact ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setLoadingImpact(false);
    }
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/teams/${encodeURIComponent(teamId)}/team-seasons/${encodeURIComponent(teamSeasonId)}/permanent?confirm=true`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data?.error ?? "TeamSaison konnte nicht gelöscht werden.");
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openConfirmation}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-transparent px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
        title="Saison endgültig löschen"
      >
        <Trash2 className="h-3 w-3" />
        Endgültig löschen
      </button>

      <Dialog
        open={open}
        onClose={() => !deleting && setOpen(false)}
        title="TeamSaison endgültig löschen"
        description={`Saison „${teamSeasonName}" dauerhaft und unwiderruflich entfernen.`}
        footer={
          <div className="flex flex-col gap-2">
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex items-center justify-end gap-3">
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={deleting || loadingImpact}>
                Abbrechen
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmDelete}
                loading={deleting}
                disabled={loadingImpact || !!error}
              >
                Endgültig löschen
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-sm text-[var(--text-2)]">
          {loadingImpact ? (
            <p className="text-[var(--muted)]">Auswirkungen werden geprüft…</p>
          ) : impact ? (
            <>
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <p className="font-medium text-red-800">
                    Diese Aktion ist dauerhaft und kann nicht rückgängig gemacht werden.
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 font-medium text-[var(--foreground)]">Wird gelöscht:</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>Saison &bdquo;{impact.displayName}&ldquo; ({impact.seasonName})</li>
                  {impact.squadMembers > 0 && (
                    <li>{impact.squadMembers} Kadermitglied{impact.squadMembers !== 1 ? "er" : ""}</li>
                  )}
                  {impact.trainerMembers > 0 && (
                    <li>{impact.trainerMembers} Trainerstab-Eintrag{impact.trainerMembers !== 1 ? "" : ""}</li>
                  )}
                  {impact.trainingSeries > 0 && (
                    <li>
                      {impact.trainingSeries} Trainingsreihe{impact.trainingSeries !== 1 ? "n" : ""}
                      {impact.trainingSessions > 0 && ` (inkl. ${impact.trainingSessions} Einheit${impact.trainingSessions !== 1 ? "en" : ""})`}
                    </li>
                  )}
                  {(impact.weekplannerAllocations + impact.weekplannerOverrides) > 0 && (
                    <li>
                      {impact.weekplannerAllocations + impact.weekplannerOverrides} Wochenplan-Einträge (Referenzen auf gelöschte Trainingseinheiten)
                    </li>
                  )}
                  {impact.competitionAssignments > 0 && (
                    <li>{impact.competitionAssignments} Wettbewerbs-Zuweisung{impact.competitionAssignments !== 1 ? "en" : ""}</li>
                  )}
                </ul>
              </div>

              <div>
                <p className="mb-2 font-medium text-[var(--foreground)]">Bleibt erhalten:</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>Team und alle anderen Saisonen</li>
                  <li>Personen (Spieler, Trainer) — nur Saison-Zuweisung wird entfernt</li>
                  <li>Wettbewerbe</li>
                  {impact.externalMappings > 0 && (
                    <li>
                      {impact.externalMappings} externe Provider-Zuordnung{impact.externalMappings !== 1 ? "en" : ""} — Saison-Verlinkung wird getrennt
                    </li>
                  )}
                </ul>
              </div>
            </>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
