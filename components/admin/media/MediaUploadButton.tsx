"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { validateMediaUploadFile, ALLOWED_MEDIA_MIME_TYPES } from "@/lib/media/types";
import type { MediaAssetListItem } from "@/lib/media/types";

type MediaUploadButtonProps = {
  onUploaded: (asset: MediaAssetListItem) => void;
  label?: string;
  className?: string;
};

export default function MediaUploadButton({
  onUploaded,
  label = "Datei hochladen",
  className,
}: MediaUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateMediaUploadFile(file);
    if (!validation.ok) {
      setError(validation.error);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/media", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error ?? "Upload fehlgeschlagen.");
        return;
      }

      onUploaded(data.asset as MediaAssetListItem);
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const acceptTypes = ALLOWED_MEDIA_MIME_TYPES.join(", ");

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className={className ?? "fca-button-secondary"}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {uploading ? "Hochladen…" : label}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptTypes}
        className="hidden"
        onChange={handleFileSelect}
      />
      {error ? (
        <p className="text-[11px] font-medium text-rose-600">{error}</p>
      ) : null}
    </div>
  );
}
