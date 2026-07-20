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

type WorkspaceUploadButtonProps = {
  folderId: string;
  disabled?: boolean;
  onUploadComplete?: () => void;
};

export function WorkspaceUploadButton({
  folderId,
  disabled = false,
  onUploadComplete,
}: WorkspaceUploadButtonProps) {
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
      >
        {isUploading ? "Uploading…" : "Upload file"}
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
