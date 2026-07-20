"use client";

import { Upload } from "lucide-react";
import {
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import {
  WorkspaceUploadError,
  uploadWorkspaceFile,
} from "@/lib/workspace/upload-client";

type WorkspaceUploadButtonProps = {
  folderId: string;
  disabled?: boolean;
  onUploadComplete?: (documentId: string | null) => void;
};

export function WorkspaceUploadButton({
  folderId,
  disabled = false,
  onUploadComplete,
}: WorkspaceUploadButtonProps) {
  const t = useTranslations("Workspace.upload");
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resolveErrorMessage(err: unknown): string {
    if (err instanceof WorkspaceUploadError) {
      switch (err.code) {
        case "WORKSPACE_UPLOAD_STORAGE_NOT_CONFIGURED":
          return t("errorStorageNotConfigured");
        case "WORKSPACE_FOLDER_NOT_FOUND":
          return t("errorFolderNotFound");
        case "WORKSPACE_UPLOAD_TOO_LARGE":
          return t("errorTooLarge");
        case "WORKSPACE_UPLOAD_INVALID_FILE":
          return t("errorInvalidFile");
        case "WORKSPACE_UPLOAD_CONFLICT":
          return t("errorConflict");
        case "WORKSPACE_UPLOAD_PERSISTENCE_FAILED":
          return t("errorPersistenceFailed");
        default:
          return err.message;
      }
    }
    if (err instanceof Error) return err.message;
    return t("errorGeneric");
  }

  async function uploadFile(file: File) {
    if (isUploading) return;

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

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  }

  function openFilePicker() {
    if (!isUploading && !disabled) inputRef.current?.click();
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        aria-hidden="true"
        disabled={disabled || isUploading}
        onChange={handleFileChange}
      />

      <Button
        type="button"
        variant="primary"
        loading={isUploading}
        disabled={disabled}
        iconLeft={!isUploading ? <Upload className="h-4 w-4" /> : undefined}
        onClick={openFilePicker}
        aria-label={t("buttonLabelWithIcon")}
      >
        {isUploading ? t("uploadingLabel") : t("buttonLabelWithIcon")}
      </Button>

      {error ? (
        <p
          role="alert"
          className="mt-2 max-w-72 text-xs leading-5 text-[var(--sce-danger)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
