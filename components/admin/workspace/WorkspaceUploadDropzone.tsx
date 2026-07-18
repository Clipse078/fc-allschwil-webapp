"use client";

import { UploadCloud } from "lucide-react";
import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import { uploadWorkspaceFile } from "@/lib/workspace/upload-client";

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

      onUploadComplete?.();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The file could not be uploaded.",
      );
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
