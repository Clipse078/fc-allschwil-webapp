"use client";

import { AlertCircle, Loader2, Paperclip, Plus, Trash2 } from "lucide-react";
import { useRef } from "react";

export type ComposerAttachment = {
  localId: string;
  attachmentId: string | null;
  filename: string;
  contentType: string;
  size: number;
  status: "UPLOADING" | "READY" | "ERROR";
  error?: string;
};

export function formatAttachmentSize(size: number | null): string {
  if (size === null || !Number.isFinite(size) || size < 0) return "Grösse unbekannt";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function EmailAttachmentComposer({
  attachments,
  disabled,
  error,
  onAddFiles,
  onRemove,
}: {
  attachments: ComposerAttachment[];
  disabled: boolean;
  error: string | null;
  onAddFiles: (files: File[]) => void;
  onRemove: (localId: string) => void;
}) {
  const totalSize = attachments.reduce((sum, attachment) => sum + attachment.size, 0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <fieldset className="mt-4" disabled={disabled}>
      <div className="flex items-center justify-between gap-3">
        <legend className="text-xs font-semibold text-[var(--text-2)]">Anhänge</legend>
        <span className="text-[0.7rem] text-[var(--muted)]">
          {attachments.length}/10 · {formatAttachmentSize(totalSize)} von 20 MB
        </span>
      </div>
      <button
        ref={addButtonRef}
        type="button"
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
        className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Datei hinzufügen
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        disabled={disabled}
        tabIndex={-1}
        className="hidden"
        aria-label="Dateien hinzufügen"
        accept=".pdf,.docx,.xlsx,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp,.gif"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          addButtonRef.current?.focus({ preventScroll: true });
          onAddFiles(files);
        }}
      />

      {attachments.length > 0 ? (
        <ul className="mt-3 space-y-2" aria-label="Ausgewählte Anhänge">
          {attachments.map((attachment) => (
            <li
              key={attachment.localId}
              className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2"
            >
              <Paperclip className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--muted)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[var(--foreground)]">
                  {attachment.filename}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[0.7rem] text-[var(--muted)]">
                  {formatAttachmentSize(attachment.size)}
                  {attachment.status === "UPLOADING" ? (
                    <>
                      <Loader2 className="ml-1 h-3 w-3 animate-spin" aria-hidden />
                      Wird hochgeladen…
                    </>
                  ) : attachment.status === "READY" ? (
                    " · Bereit"
                  ) : (
                    <span className="text-rose-600"> · {attachment.error ?? "Upload fehlgeschlagen"}</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(attachment.localId)}
                disabled={disabled}
                className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={`${attachment.filename} entfernen`}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-rose-600">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
