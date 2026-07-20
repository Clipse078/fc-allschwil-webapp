"use client";

import { UploadCloud } from "lucide-react";
import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import {
  WorkspaceUploadError,
  uploadWorkspaceFile,
} from "@/lib/workspace/upload-client";

function resolveUploadErrorMessage(error: unknown): string {
  if (error instanceof WorkspaceUploadError) {
    switch (error.code) {
      case "WORKSPACE_UPLOAD_STORAGE_NOT_CONFIGURED":
        return "Upload ist momentan nicht verfügbar. Bitte wenden Sie sich an den Administrator.";
      case "WORKSPACE_FOLDER_NOT_FOUND":
        return "Der ausgewählte Ordner existiert nicht mehr. Bitte laden Sie die Seite neu.";
      case "WORKSPACE_UPLOAD_TOO_LARGE":
        return "Die Datei ist zu gross für den Speicher.";
      case "WORKSPACE_UPLOAD_INVALID_FILE":
        return "Dieser Dateityp wird nicht akzeptiert.";
      case "WORKSPACE_UPLOAD_CONFLICT":
        return "Diese Datei existiert bereits. Bitte benennen Sie die Datei um und versuchen Sie es erneut.";
      case "WORKSPACE_UPLOAD_PERSISTENCE_FAILED":
        return "Das Dokument konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.";
      default:
        return error.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Die Datei konnte nicht hochgeladen werden.";
}

type WorkspaceUploadDropzoneProps = {
  folderId: string;
  disabled?: boolean;
  onUploadComplete?: () => void;
};

export function WorkspaceUploadDropzone({
  folderId,
  disabled = false,
  onUploadComplete,
}: WorkspaceUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadFile(file: File) {
    if (disabled || isUploading) {
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      await uploadWorkspaceFile({
        file,
        folderId,
      });

      setError(null);
      onUploadComplete?.();
    } catch (uploadError) {
      setError(resolveUploadErrorMessage(uploadError));
    } finally {
      setIsUploading(false);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsDragging(false);
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];

    if (!file) {
      return;
    }

    await uploadFile(file);
  }

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    await uploadFile(file);
  }

  function openFilePicker() {
    if (!disabled && !isUploading) {
      inputRef.current?.click();
    }
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || isUploading}
        className={`flex min-h-40 flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
          isDragging
            ? "border-[var(--blue)] bg-[var(--surface-2)]"
            : "border-[var(--border-strong)] bg-[var(--surface)]"
        } ${
          disabled || isUploading
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer hover:border-[var(--blue)] hover:bg-[var(--surface-2)]"
        }`}
        onClick={openFilePicker}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openFilePicker();
          }
        }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <UploadCloud className="h-8 w-8 text-[var(--blue)]" />

        <p className="mt-3 text-sm font-semibold text-[var(--text)]">
          {isUploading
            ? "Uploading file…"
            : "Drop a file here or click to browse"}
        </p>

        <p className="mt-1 text-xs text-[var(--muted)]">
          One file at a time, up to 100 MB.
        </p>

        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          disabled={disabled || isUploading}
          onChange={handleFileChange}
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-2 text-xs leading-5 text-[var(--sce-danger)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
