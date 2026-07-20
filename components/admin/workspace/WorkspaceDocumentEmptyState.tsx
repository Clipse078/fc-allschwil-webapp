"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { UploadCloud } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  WorkspaceUploadError,
  uploadWorkspaceFile,
} from "@/lib/workspace/upload-client";

type WorkspaceEmptyStateProps = {
  isDragging?: boolean;
  canManage?: boolean;
  /** When provided, this component handles file upload directly. */
  folderId?: string;
  onUploadComplete?: (documentId: string | null) => void;
};

export function WorkspaceDocumentEmptyState({
  isDragging = false,
  canManage = false,
  folderId,
  onUploadComplete,
}: WorkspaceEmptyStateProps) {
  const t = useTranslations("Workspace");
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localDragging, setLocalDragging] = useState(false);

  const isDrag = isDragging || localDragging;

  function resolveErrorMessage(err: unknown): string {
    const tu = t;
    if (err instanceof WorkspaceUploadError) {
      switch (err.code) {
        case "WORKSPACE_UPLOAD_STORAGE_NOT_CONFIGURED":
          return tu("upload.errorStorageNotConfigured");
        case "WORKSPACE_FOLDER_NOT_FOUND":
          return tu("upload.errorFolderNotFound");
        case "WORKSPACE_UPLOAD_TOO_LARGE":
          return tu("upload.errorTooLarge");
        case "WORKSPACE_UPLOAD_INVALID_FILE":
          return tu("upload.errorInvalidFile");
        case "WORKSPACE_UPLOAD_CONFLICT":
          return tu("upload.errorConflict");
        case "WORKSPACE_UPLOAD_PERSISTENCE_FAILED":
          return tu("upload.errorPersistenceFailed");
        default:
          return err.message;
      }
    }
    if (err instanceof Error) return err.message;
    return t("upload.errorGeneric");
  }

  async function uploadFile(file: File) {
    if (!folderId || isUploading) return;

    setIsUploading(true);
    setError(null);

    try {
      const result = await uploadWorkspaceFile({ file, folderId });
      setError(null);
      onUploadComplete?.(result.document?.id ?? null);
    } catch (uploadError) {
      setError(resolveErrorMessage(uploadError));
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (canManage && folderId && !isUploading) setLocalDragging(true);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setLocalDragging(false);
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setLocalDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await uploadFile(file);
  }

  function openFilePicker() {
    if (!isUploading) inputRef.current?.click();
  }

  return (
    <div
      className={[
        "flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center transition-colors duration-150",
        isDrag ? "bg-[var(--blue-light)]" : "",
      ].join(" ")}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={canManage && folderId ? handleDrop : undefined}
      aria-live="polite"
    >
      <div
        className={[
          "flex h-16 w-16 items-center justify-center rounded-2xl transition-colors duration-150",
          isDrag ? "bg-[var(--blue)] text-white" : "bg-[var(--surface-2)] text-[var(--blue)]",
        ].join(" ")}
      >
        {isUploading ? (
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        ) : (
          <UploadCloud className="h-8 w-8" aria-hidden="true" />
        )}
      </div>

      <h2 className="mt-5 text-base font-semibold text-[var(--text)]">
        {isUploading ? t("upload.uploadingLabel") : t("emptyState.title")}
      </h2>

      {canManage && !isUploading ? (
        <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--text-2)]">
          {t("emptyState.description")}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-xs text-[var(--sce-danger)]">
          {error}
        </p>
      ) : null}

      {canManage && folderId && !isUploading ? (
        <>
          <button
            type="button"
            onClick={openFilePicker}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--blue)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[var(--blue-hover)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)]"
          >
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            {t("emptyState.uploadButton")}
          </button>

          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            aria-hidden="true"
            disabled={isUploading}
            onChange={async (e: ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0];
              if (file) await uploadFile(file);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
