"use client";

/**
 * WorkspaceDocumentDeleteControl
 *
 * ADMIN-DELETE-03A — permanent-delete action for a WorkspaceDocument.
 *
 * Rendered only when `canDelete` is true (PERMISSIONS.WORKSPACE_DELETE
 * resolved server-side by the caller). Implements the same two-step
 * "inspect impact → explicit confirmation → permanent delete" flow used by
 * TrainingSeriesDeleteControl (ADMIN-DELETE-02A-C1) and the established
 * premium deletion Dialog pattern.
 *
 * Flow:
 *   1. User clicks "Löschen" → calls DELETE .../permanent (preview, no confirm)
 *      to fetch impact; dialog opens.
 *   2. User reviews impact + "Endgültig löschen" button → calls
 *      DELETE .../permanent?confirm=true; document disappears and the list
 *      refreshes.
 *
 * Archive/restore (POST .../archive / POST .../restore) remain completely
 * unaffected — separate reversible lifecycle actions.
 */

import { AlertTriangle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

type Props = {
  documentId: string;
  documentName: string;
  /**
   * ADMIN-DELETE-03A: effective PERMISSIONS.WORKSPACE_DELETE authority,
   * resolved server-side by the caller. Deliberately independent of
   * workspace.manage — archive/upload remain governed by their existing
   * permission and are unaffected by this control.
   */
  canDelete: boolean;
};

export function WorkspaceDocumentDeleteControl({
  documentId,
  documentName,
  canDelete,
}: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versionCount, setVersionCount] = useState<number | null>(null);

  if (!canDelete) {
    return null;
  }

  const permanentUrl = `/api/workspace/documents/${encodeURIComponent(documentId)}/permanent`;

  async function openConfirmation() {
    setConfirming(true);
    setError(null);
    setVersionCount(null);
    setLoadingImpact(true);

    try {
      const response = await fetch(permanentUrl, { method: "DELETE" });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Löschen nicht möglich.");
      }

      setVersionCount(
        typeof data?.impact?.versionCount === "number"
          ? data.impact.versionCount
          : 0,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.",
      );
    } finally {
      setLoadingImpact(false);
    }
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`${permanentUrl}?confirm=true`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Löschen fehlgeschlagen.");
      }

      setConfirming(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.",
      );
    } finally {
      setDeleting(false);
    }
  }

  function closeDialog() {
    setConfirming(false);
    setVersionCount(null);
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        role="menuitem"
        onClick={openConfirmation}
        data-testid="workspace-document-delete-button"
        className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
      >
        <span
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center"
          aria-hidden="true"
        >
          <Trash2 className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">Endgültig löschen</span>
      </button>

      <Dialog
        open={confirming}
        onClose={closeDialog}
        title={`„${documentName}" endgültig löschen?`}
        description="Diese Aktion ist endgültig und kann nicht rückgängig gemacht werden."
        footer={
          <>
            <Button variant="secondary" onClick={closeDialog}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              disabled={loadingImpact}
              onClick={handleConfirmDelete}
            >
              Endgültig löschen
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {error && (
            <p className="text-sm font-medium text-[var(--sce-danger)]">
              {error}
            </p>
          )}

          {loadingImpact ? (
            <p className="text-sm text-[var(--text-2)]">
              Auswirkungen werden geprüft…
            </p>
          ) : versionCount !== null ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2 rounded-lg border border-[var(--sce-warning-border)] bg-[var(--sce-warning-light)] p-3 text-[var(--sce-warning)]">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <p className="text-sm">
                  Das Dokument <strong>{documentName}</strong> wird unwiderruflich
                  entfernt, inklusive aller gespeicherten Dateiversionen.
                </p>
              </div>

              {versionCount > 0 && (
                <ul className="list-inside list-disc space-y-1 text-sm text-[var(--text-2)]">
                  <li>
                    Gespeicherte Dateiversionen:{" "}
                    <span className="font-medium">{versionCount}</span>
                  </li>
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
