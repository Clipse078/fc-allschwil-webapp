"use client";

import { Upload } from "lucide-react";
import {
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import { Button } from "@/components/ui/Button";
import { uploadWorkspaceFile } from "@/lib/workspace/upload-client";

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
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Die Datei konnte nicht hochgeladen werden.",
      );
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
