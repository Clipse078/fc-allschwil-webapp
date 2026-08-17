"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

type MeetingDeletionImpact = {
  agendaItems: number;
  decisions: number;
  actions: number;
  participants: number;
};

type MeetingDeleteButtonProps = {
  meetingId: string;
  meetingTitle: string;
};

/**
 * MeetingDeleteButton — permanent-delete action for a Meeting (ADMIN-HARD-DELETE-UI).
 *
 * Flow: clicking "Endgültig löschen" opens the confirmation dialog and fetches
 * the current impact from DELETE /api/meetings/[id]/permanent (preview mode).
 * Clicking "Endgültig löschen" (confirm) sends DELETE ?confirm=true to
 * permanently remove the Meeting and all cascade children.
 */
export default function MeetingDeleteButton({
  meetingId,
  meetingTitle,
}: MeetingDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impact, setImpact] = useState<MeetingDeletionImpact | null>(null);

  async function openConfirmation() {
    setOpen(true);
    setError(null);
    setImpact(null);
    setLoadingImpact(true);

    try {
      const response = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/permanent`, {
        method: "DELETE",
      });
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
        `/api/meetings/${encodeURIComponent(meetingId)}/permanent?confirm=true`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data?.error ?? "Sitzung konnte nicht gelöscht werden.");
        return;
      }

      setOpen(false);
      router.push("/vereinsleitung/meetings");
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setDeleting(false);
    }
  }

  const totalSubItems =
    (impact?.agendaItems ?? 0) +
    (impact?.decisions ?? 0) +
    (impact?.actions ?? 0) +
    (impact?.participants ?? 0);

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
        title="Sitzung endgültig löschen"
        description={`„${meetingTitle}" dauerhaft und unwiderruflich aus dem System entfernen.`}
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
                  <li>Sitzungsprotokoll &bdquo;{meetingTitle}&ldquo;</li>
                  {impact.agendaItems > 0 && (
                    <li>
                      {impact.agendaItems} Traktandum{impact.agendaItems !== 1 ? "en" : ""}
                    </li>
                  )}
                  {impact.decisions > 0 && (
                    <li>
                      {impact.decisions} Beschluss{impact.decisions !== 1 ? "e" : ""}
                    </li>
                  )}
                  {impact.actions > 0 && (
                    <li>
                      {impact.actions} Aufgabe{impact.actions !== 1 ? "n" : ""}
                    </li>
                  )}
                  {impact.participants > 0 && (
                    <li>
                      {impact.participants} Teilnehmer{impact.participants !== 1 ? "-Einträge" : "-Eintrag"}
                    </li>
                  )}
                  {totalSubItems === 0 && (
                    <li className="text-[var(--muted)]">Keine weiteren verknüpften Einträge</li>
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
