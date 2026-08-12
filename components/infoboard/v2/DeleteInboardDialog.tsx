"use client";

/**
 * components/infoboard/v2/DeleteInboardDialog.tsx
 *
 * Confirmation dialog for permanent Infoboard deletion.
 */

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

type DeleteInboardDialogProps = {
  boardId: string | null;
  boardName: string;
  onConfirm: (id: string) => Promise<void>;
  onClose: () => void;
};

export function DeleteInboardDialog({
  boardId,
  boardName,
  onConfirm,
  onClose,
}: DeleteInboardDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!boardId) return null;

  async function handleConfirm() {
    if (!boardId) return;
    setDeleting(true);
    setError(null);
    try {
      await onConfirm(boardId);
      onClose();
    } catch {
      setError("Fehler beim Löschen. Bitte erneut versuchen.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-sm rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] shadow-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              Infoboard löschen
            </h2>
            <p className="mt-1.5 text-sm text-[var(--text-2)]">
              <strong className="text-[var(--foreground)]">{boardName}</strong> wird dauerhaft
              gelöscht. Konfigurierte Kiosk-Geräte mit dieser URL werden nicht mehr funktionieren.
            </p>
            <p className="mt-2 text-sm text-[var(--text-2)]">
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-[0.78rem] text-red-600">{error}</p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="fca-button-secondary text-[0.82rem] px-4 py-2"
          >
            Abbrechen
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="inline-flex items-center justify-center rounded-[var(--radius-lg)] bg-red-600 px-4 py-2 text-[0.82rem] font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {deleting ? "Löscht…" : "Dauerhaft löschen"}
          </button>
        </div>
      </div>
    </div>
  );
}
