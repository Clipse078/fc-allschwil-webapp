"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

type OrgUnitImpact = {
  childOrgUnits: number;
  teamSeasonLinks: number;
  orgUnitMemberships: number;
  personAssignments: number;
  scopedUserRoles: number;
  legacyTeamLinks: number;
};

type Props = {
  orgUnitId: string;
  orgUnitName: string;
};

/**
 * OrgUnitDeleteButton — permanent-delete action for an OrgUnit.
 *
 * ADMIN-DELETE-ORG-01: Two-step preview/confirm flow using
 * DELETE /api/org-units/[id]/permanent (preview) and ?confirm=true (perform).
 * Persons, Teams, TeamSeasons, and non-scoped UserRoles are preserved.
 */
export default function OrgUnitDeleteButton({ orgUnitId, orgUnitName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impact, setImpact] = useState<OrgUnitImpact | null>(null);

  async function openConfirmation() {
    setOpen(true);
    setError(null);
    setImpact(null);
    setLoadingImpact(true);

    try {
      const response = await fetch(`/api/org-units/${encodeURIComponent(orgUnitId)}/permanent`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Vorschau nicht verfügbar.");
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
        `/api/org-units/${encodeURIComponent(orgUnitId)}/permanent?confirm=true`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error ?? "Organisationseinheit konnte nicht gelöscht werden.");
        return;
      }
      setOpen(false);
      router.push("/dashboard/org-units");
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
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-transparent px-3.5 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Endgültig löschen
      </button>

      <Dialog
        open={open}
        onClose={() => !deleting && setOpen(false)}
        title="Organisationseinheit endgültig löschen"
        description={`„${orgUnitName}" dauerhaft und unwiderruflich aus dem System entfernen.`}
        footer={
          <div className="flex flex-col gap-2">
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={deleting || loadingImpact}
              >
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
                  <li>Organisationseinheit &bdquo;{orgUnitName}&ldquo;</li>
                  {impact.orgUnitMemberships > 0 && (
                    <li>{impact.orgUnitMemberships} OE-Mitgliedschaft{impact.orgUnitMemberships !== 1 ? "en" : ""}</li>
                  )}
                  {impact.personAssignments > 0 && (
                    <li>{impact.personAssignments} Personenzuordnung{impact.personAssignments !== 1 ? "en" : ""}</li>
                  )}
                  {impact.teamSeasonLinks > 0 && (
                    <li>{impact.teamSeasonLinks} Saison-Zuordnung{impact.teamSeasonLinks !== 1 ? "en" : ""} (Teams bleiben erhalten)</li>
                  )}
                  {impact.scopedUserRoles > 0 && (
                    <li>{impact.scopedUserRoles} OE-spezifische Rollenzuweisung{impact.scopedUserRoles !== 1 ? "en" : ""}</li>
                  )}
                </ul>
              </div>

              <div>
                <p className="mb-2 font-medium text-[var(--foreground)]">Bleibt erhalten:</p>
                <ul className="ml-4 list-disc space-y-1">
                  {impact.childOrgUnits > 0 && (
                    <li>{impact.childOrgUnits} Untereinheit{impact.childOrgUnits !== 1 ? "en" : ""} — werden zu Haupteinheiten (parentId → null)</li>
                  )}
                  {impact.legacyTeamLinks > 0 && (
                    <li>{impact.legacyTeamLinks} Team{impact.legacyTeamLinks !== 1 ? "s" : ""} — OE-Link wird entfernt, Team bleibt bestehen</li>
                  )}
                  <li>Personen — Personendatensätze werden nicht gelöscht</li>
                  <li>Teams & TeamSeasons — bleiben vollständig erhalten</li>
                  <li>Benutzerkonten — globale User und andere Rollen unberührt</li>
                </ul>
              </div>
            </>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
