"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

type TargetGroupDeletionImpact = {
  linkedRegistrations: number;
};

type TargetGroupDeleteButtonProps = {
  targetGroupId: string;
  targetGroupName: string;
  targetGroupKey: string;
};

/**
 * TargetGroupDeleteButton — permanent-delete action for a TargetGroup (ADMIN-HARD-DELETE-UI).
 *
 * Impact: linked registrations have their targetGroupId nulled (SetNull — they are preserved).
 */
export default function TargetGroupDeleteButton({
  targetGroupId,
  targetGroupName,
  targetGroupKey,
}: TargetGroupDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impact, setImpact] = useState<TargetGroupDeletionImpact | null>(null);

  async function openConfirmation() {
    setOpen(true);
    setError(null);
    setImpact(null);
    setLoadingImpact(true);

    try {
      const response = await fetch(
        `/api/target-groups/${encodeURIComponent(targetGroupId)}/permanent`,
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
        `/api/target-groups/${encodeURIComponent(targetGroupId)}/permanent?confirm=true`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data?.error ?? "Zielgruppe konnte nicht gelöscht werden.");
        return;
      }

      setOpen(false);
      router.push("/dashboard/target-groups");
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
        title="Zielgruppe endgültig löschen"
        description={`„${targetGroupName}" (${targetGroupKey}) dauerhaft und unwiderruflich aus dem System entfernen.`}
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
                  <li>Zielgruppe &bdquo;{targetGroupName}&ldquo; ({targetGroupKey})</li>
                </ul>
              </div>

              {impact.linkedRegistrations > 0 ? (
                <div>
                  <p className="mb-2 font-medium text-[var(--foreground)]">Bleibt erhalten:</p>
                  <ul className="ml-4 list-disc space-y-1">
                    <li>
                      {impact.linkedRegistrations} verknüpfte Anmeldung
                      {impact.linkedRegistrations !== 1 ? "en" : ""} — Zielgruppen-Verlinkung wird entfernt, Anmeldungen bleiben bestehen
                    </li>
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
