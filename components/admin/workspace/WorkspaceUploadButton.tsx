"use client";

import { Upload } from "lucide-react";
import {
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import { Button } from "@/components/ui/Button";
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

type WorkspaceUploadButtonProps = {
  folderId: string;
  disabled?: boolean;
  /**
   * Called when upload completes successfully. Receives the new document ID
   * so the caller can auto-select it in the document list.
   */
  onUploadComplete?: (documentId: string | null) => void;
};

export function WorkspaceUploadButton({
  folderId,
  disabled = false,
  onUploadComplete,
}: WorkspaceUploadButtonProps) {
  const t = workspaceDE.upload;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadFile(file: File) {
    if (isUploading) {
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
    if (!isUploading && !disabled) {
      inputRef.current?.click();
    }
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
        iconLeft={<Upload className="h-4 w-4" />}
        onClick={openFilePicker}
        aria-label={t.buttonLabel}
      >
        {isUploading ? t.uploadingLabel : t.buttonLabel}
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
