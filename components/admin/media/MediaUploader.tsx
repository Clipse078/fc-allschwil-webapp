"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";
import { ALLOWED_MEDIA_MIME_TYPES } from "@/lib/media/validation";

type UploadState =
  | { type: "idle" }
  | { type: "uploading"; fileName: string }
  | { type: "success"; fileName: string }
  | { type: "error"; message: string };

type Props = {
  onUploaded: () => void;
};

export default function MediaUploader({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ type: "idle" });
  const [, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);

  async function upload(file: File) {
    setState({ type: "uploading", fileName: file.name });

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/media", { method: "POST", body: formData });

    if (res.ok) {
      setState({ type: "success", fileName: file.name });
      onUploaded();
      setTimeout(() => setState({ type: "idle" }), 2000);
    } else {
      const data = await res.json().catch(() => ({}));
      setState({ type: "error", message: data.error ?? "Upload fehlgeschlagen." });
    }
  }

  function handleFile(file: File | null | undefined) {
    if (!file) return;
    startTransition(() => { upload(file); });
  }

  const accept = ALLOWED_MEDIA_MIME_TYPES.join(",");

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-xl)] border-2 border-dashed p-8 text-center transition-colors ${
          dragOver
            ? "border-[var(--blue)] bg-[var(--blue-light)]"
            : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--blue)] hover:bg-[var(--blue-light)]"
        }`}
      >
        {state.type === "idle" || state.type === "error" ? (
          <>
            <Upload className="h-8 w-8 text-[var(--muted)]" />
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                Datei hier ablegen oder klicken
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                JPG, PNG, WebP, PDF — max. 10 MB (Bilder), 20 MB (PDFs)
              </p>
            </div>
            {state.type === "error" && (
              <div className="flex items-center gap-1.5 text-red-600 text-xs">
                <AlertCircle className="h-4 w-4" />
                {state.message}
              </div>
            )}
          </>
        ) : state.type === "uploading" ? (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--blue)] border-t-transparent" />
            <p className="text-sm text-[var(--muted)]">Lade hoch: {state.fileName}</p>
          </>
        ) : (
          <>
            <CheckCircle className="h-8 w-8 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-600">{state.fileName} hochgeladen!</p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
        onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
      />
    </div>
  );
}
