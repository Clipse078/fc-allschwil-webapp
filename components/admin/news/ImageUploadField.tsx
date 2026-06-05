"use client";

import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { validateMediaUploadFile } from "@/lib/media/validation";

type Props = {
  value: string;
  onChange: (url: string) => void;
  label?: string;
};

export default function ImageUploadField({
  value,
  onChange,
  label = "Hero-Bild",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const validation = validateMediaUploadFile(file);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/media/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Upload fehlgeschlagen.");
        return;
      }
      onChange(json.asset.url);
    } catch {
      setError("Netzwerkfehler beim Upload.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleClear() {
    onChange("");
    setError(null);
  }

  return (
    <div className="space-y-2">
      <label className="fca-label">{label}</label>

      {value ? (
        <div className="relative w-full max-w-sm overflow-hidden rounded-lg border border-zinc-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Hero-Bild Vorschau"
            className="h-40 w-full object-cover"
          />
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-2 rounded-full bg-white/90 p-1 shadow hover:bg-white"
            aria-label="Bild entfernen"
          >
            <X className="h-4 w-4 text-zinc-600" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-32 w-full max-w-sm cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-500 transition hover:border-zinc-400 hover:bg-zinc-100 disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Upload className="h-5 w-5" />
          )}
          <span>{uploading ? "Wird hochgeladen…" : "Bild hochladen"}</span>
          <span className="text-xs text-zinc-400">JPEG, PNG, WebP, GIF · max. 8 MB</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Manual URL input as fallback */}
      <div className="flex items-center gap-2">
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Oder Bild-URL direkt eingeben…"
          className="fca-input flex-1 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
