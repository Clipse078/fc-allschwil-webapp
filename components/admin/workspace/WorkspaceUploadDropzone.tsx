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
import { workspaceDE } from "@/lib/workspace/workspace-i18n";

function resolveUploadErrorMessage(error: unknown): string {
  const t = workspaceDE.upload.errors;

  if (error instanceof WorkspaceUploadError) {
    switch (error.code) {
      case "WORKSPACE_UPLOAD_STORAGE_NOT_CONFIGURED":
        return t.storageNotConfigured;
      case "WORKSPACE_FOLDER_NOT_FOUND":
        return t.folderNotFound;
      case "WORKSPACE_UPLOAD_TOO_LARGE":
        return t.tooLarge;
      case "WORKSPACE_UPLOAD_INVALID_FILE":
        return t.invalidFile;
      case "WORKSPACE_UPLOAD_CONFLICT":
        return t.conflict;
      case "WORKSPACE_UPLOAD_PERSISTENCE_FAILED":
        return t.persistenceFailed;
      default:
        return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return t.generic;
}

type WorkspaceUploadDropzoneProps = {
  folderId: string;
  disabled?: boolean;
  /**
   * When true, the dropzone fills the available space (used on empty folders).
   * When false, it uses a minimal overlay on the document list.
   */
  expanded?: boolean;
  /**
   * Called when upload completes. Receives the new document ID.
   */
  onUploadComplete?: (documentId: string | null) => void;
  /** Forwarded drag state so the parent can show drag-over styling. */
  onDragStateChange?: (isDragging: boolean) => void;
};

export function WorkspaceUploadDropzone({
  folderId,
  disabled = false,
  expanded = false,
  onUploadComplete,
  onDragStateChange,
}: WorkspaceUploadDropzoneProps) {
  const t = workspaceDE.upload;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setDragging(value: boolean) {
    setIsDragging(value);
    onDragStateChange?.(value);
  }

  async function uploadFile(file: File) {
    if (disabled || isUploading) {
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const result = await uploadWorkspaceFile({ file, folderId });
      const documentId = result.document?.id ?? null;

      setError(null);
      onUploadComplete?.(documentId);
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
      setDragging(true);
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (
      event.currentTarget.contains(
        event.relatedTarget as Node | null,
      )
    ) {
      return;
    }

    setDragging(false);
  }

  async function handleDrop(
    event: DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    setDragging(false);

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

  if (!expanded) {
    return (
      <div
        className={`relative rounded-lg border-2 border-dashed transition-colors ${
          isDragging
            ? "border-[var(--blue)] bg-[var(--blue-light)]"
            : "border-transparent"
        }`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-hidden="true"
      >
        {isDragging ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-[var(--blue-light)]">
            <div className="flex flex-col items-center gap-2 text-[var(--blue)]">
              <UploadCloud className="h-8 w-8" />
              <p className="text-sm font-semibold">
                {t.dragOverTitle}
              </p>
            </div>
          </div>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          aria-hidden="true"
          disabled={disabled || isUploading}
          onChange={handleFileChange}
        />

        {error ? (
          <p
            role="alert"
            className="px-5 pb-3 text-xs leading-5 text-[var(--sce-danger)]"
          >
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || isUploading}
        className={`flex min-h-40 flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
          isDragging
            ? "border-[var(--blue)] bg-[var(--blue-light)]"
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
        <UploadCloud
          className={`h-8 w-8 ${
            isDragging ? "text-[var(--blue)]" : "text-[var(--blue)]"
          }`}
          aria-hidden="true"
        />

        <p className="mt-3 text-sm font-semibold text-[var(--text)]">
          {isUploading ? t.uploadingLabel : t.dropzoneTitle}
        </p>

        <p className="mt-1 text-xs text-[var(--muted)]">
          {t.dropzoneHint}
        </p>

        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          aria-hidden="true"
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
