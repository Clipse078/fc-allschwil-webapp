"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

type InitiativeDeleteButtonProps = {
  initiativeId: string;
  initiativeTitle: string;
};

/**
 * InitiativeDeleteButton — permanent-delete action for an Initiative (ADMIN-HARD-DELETE-UI).
 *
 * Flow: opens confirmation dialog → fetches impact preview → DELETE ?confirm=true.
 */
export default function InitiativeDeleteButton({
  initiativeId,
  initiativeTitle,
}: InitiativeDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impactLoaded, setImpactLoaded] = useState(false);

  async function openConfirmation() {
    setOpen(true);
    setError(null);
    setImpactLoaded(false);
    setLoadingImpact(true);

    try {
      const response = await fetch(
        `/api/initiatives/${encodeURIComponent(initiativeId)}/permanent`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Vorschau nicht verfügbar.");
      }

      setImpactLoaded(true);
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
        `/api/initiatives/${encodeURIComponent(initiativeId)}/permanent?confirm=true`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data?.error ?? "Initiative konnte nicht gelöscht werden.");
        return;
      }

      setOpen(false);
      router.push("/vereinsleitung/initiativen");
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
        title="Initiative endgültig löschen"
        description={`„${initiativeTitle}" dauerhaft und unwiderruflich aus dem System entfernen.`}
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
          ) : impactLoaded ? (
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
                  <li>Initiative &bdquo;{initiativeTitle}&ldquo;</li>
                </ul>
              </div>
            </>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
