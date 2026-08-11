"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SectionCard } from "@/components/ui/page";

type Blocker = {
  key: string;
  label: string;
  count: number;
};

type Props = {
  seriesId: string;
  seriesTitle: string;
  /**
   * ADMIN-DELETE-02A: effective PERMISSIONS.TRAININGS_DELETE authority,
   * resolved by the caller (see app/(admin)/dashboard/training/series/
   * [seriesId]/edit/page.tsx). Deliberately independent of
   * trainings.manage — archive/edit remain governed by their existing
   * permission and are unaffected by this control.
   */
  canDelete: boolean;
};

/**
 * TrainingSeriesDeleteControl — permanent-delete action for a TrainingSeries.
 *
 * The smallest additive lifecycle control for TrainingCenter's existing
 * detail/edit surface (TrainingCenter is NOT redesigned): archive/restore
 * continue to work exactly as before via the existing archive button/route
 * (components/admin/training/TrainingSeriesArchiveButton.tsx, DELETE
 * /api/training-series/[seriesId]). This component only ever renders when
 * the caller holds trainings.delete, and calls the dedicated permanent-
 * delete endpoint. The server blocks deletion and reports the concrete
 * dependencies whenever meaningful history exists (generated sessions,
 * facility allocations, plan assignments), recommending archiving instead.
 */
export default function TrainingSeriesDeleteControl({ seriesId, seriesTitle, canDelete }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<Blocker[] | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (!canDelete) {
    return null;
  }

  async function handleDelete() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/training-series/${seriesId}/permanent`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 409 && Array.isArray(data?.blockers)) {
          setBlockers(data.blockers);
          setError(data?.error ?? "Löschen nicht möglich.");
          return;
        }
        throw new Error(data?.error ?? "Löschen fehlgeschlagen.");
      }

      setConfirming(false);
      setBlockers(null);
      router.push("/dashboard/training");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionCard title="Endgültig löschen">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-[var(--text-2)]">
            Entfernt die Trainingsserie unwiderruflich. Nur möglich, solange keine generierten
            Termine, Ressourcen-Zuordnungen oder Trainingsplan-Zuweisungen bestehen.
          </p>

          {error && !blockers && (
            <p className="text-xs font-medium text-[var(--sce-danger)]">{error}</p>
          )}

          <Button
            variant="danger"
            size="sm"
            iconLeft={<Trash2 className="h-3.5 w-3.5" />}
            onClick={() => setConfirming(true)}
          >
            Löschen
          </Button>
        </div>
      </SectionCard>

      <Dialog
        open={confirming}
        onClose={() => {
          setConfirming(false);
          setBlockers(null);
          setError(null);
        }}
        title={`„${seriesTitle}" endgültig löschen?`}
        description={
          blockers
            ? undefined
            : "Diese Aktion kann nicht rückgängig gemacht werden. Nur möglich, wenn keine Historie (Termine, Zuordnungen, Planzuweisungen) besteht."
        }
        footer={
          blockers ? (
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Schließen
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Abbrechen
              </Button>
              <Button variant="danger" loading={busy} onClick={handleDelete}>
                Endgültig löschen
              </Button>
            </>
          )
        }
      >
        {blockers ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-[var(--sce-warning-border)] bg-[var(--sce-warning-light)] p-3 text-[var(--sce-warning)]">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="text-sm">
                Löschen blockiert — es bestehen noch Daten/Historie. Bitte stattdessen archivieren.
              </p>
            </div>
            <ul className="list-inside list-disc space-y-1 text-sm text-[var(--text-2)]">
              {blockers.map((blocker) => (
                <li key={blocker.key}>
                  {blocker.label}: {blocker.count}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
