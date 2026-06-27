"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, Loader2, X, CheckCircle2, AlertCircle } from "lucide-react";
import { validateMediaUploadFile, ALLOWED_MEDIA_MIME_TYPES } from "@/lib/media/types";
import type { MediaAssetListItem } from "@/lib/media/types";

type UploadItem = {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress?: number;
  error?: string;
  asset?: MediaAssetListItem;
};

type MediaDropZoneProps = {
  folderId?: string | null;
  onUploaded: (asset: MediaAssetListItem) => void;
  onAllDone?: () => void;
};

let _idCounter = 0;
function nextId() { return `upload-${++_idCounter}`; }

export default function MediaDropZone({ folderId, onUploaded, onAllDone }: MediaDropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const uploadFile = useCallback(async (id: string, file: File) => {
    const v = validateMediaUploadFile(file);
    if (!v.ok) {
      updateItem(id, { status: "error", error: v.error });
      return;
    }
    updateItem(id, { status: "uploading" });
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (folderId) fd.append("folderId", folderId);
      const res = await fetch("/api/media", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        updateItem(id, { status: "error", error: data?.error ?? "Upload fehlgeschlagen." });
      } else {
        const asset = data.asset as MediaAssetListItem;
        updateItem(id, { status: "done", asset });
        onUploaded(asset);
      }
    } catch {
      updateItem(id, { status: "error", error: "Netzwerkfehler." });
    }
  }, [folderId, onUploaded, updateItem]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const newItems: UploadItem[] = arr.map((f) => ({
      id: nextId(),
      file: f,
      status: "pending",
    }));
    setItems((prev) => [...prev, ...newItems]);
    for (const item of newItems) {
      uploadFile(item.id, item.file);
    }
  }, [uploadFile]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() { setDragging(false); }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  }

  function dismissItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function dismissAll() {
    setItems([]);
    onAllDone?.();
  }

  const hasActive = items.some((it) => it.status === "uploading" || it.status === "pending");
  const doneCount = items.filter((it) => it.status === "done").length;
  const errorCount = items.filter((it) => it.status === "error").length;

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-xl)] border-2 border-dashed py-10 transition ${
          dragging
            ? "border-[var(--tenant-primary)] bg-[var(--tenant-primary)]/5"
            : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--tenant-primary)] hover:bg-[var(--tenant-primary)]/5"
        }`}
      >
        <div className={`rounded-full p-3 ${dragging ? "bg-[var(--tenant-primary)]/10" : "bg-[var(--surface)]"}`}>
          <Upload className={`h-6 w-6 ${dragging ? "text-[var(--tenant-primary)]" : "text-[var(--muted)]"}`} />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-[var(--foreground)]">
            {dragging ? "Dateien hier ablegen" : "Dateien hochladen"}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            JPEG, PNG, WebP, GIF, MP4, WebM · max. 8 MB / 100 MB Video
          </p>
        </div>
        <button
          type="button"
          className="fca-button-primary pointer-events-none text-sm"
          tabIndex={-1}
        >
          <Upload className="h-4 w-4" />
          Dateien auswählen
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ALLOWED_MEDIA_MIME_TYPES.join(", ")}
        className="hidden"
        onChange={handleFileInput}
      />

      {/* Upload queue */}
      {items.length > 0 && (
        <div className="space-y-1.5 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[var(--foreground)]">
              {hasActive ? "Hochladen…" : `${doneCount} hochgeladen${errorCount > 0 ? `, ${errorCount} Fehler` : ""}`}
            </p>
            {!hasActive && (
              <button
                type="button"
                onClick={dismissAll}
                className="text-[11px] text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Schliessen
              </button>
            )}
          </div>
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-lg bg-[var(--surface-2)] px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="truncate text-[11px] font-medium text-[var(--foreground)]">{item.file.name}</p>
              </div>
              <div className="flex-shrink-0">
                {item.status === "uploading" && (
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--tenant-primary)]" />
                )}
                {item.status === "done" && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
                {item.status === "error" && (
                  <div className="flex items-center gap-1">
                    <AlertCircle className="h-4 w-4 text-rose-500" />
                    <span className="text-[10px] text-rose-600">{item.error}</span>
                  </div>
                )}
                {(item.status === "done" || item.status === "error") && (
                  <button
                    type="button"
                    onClick={() => dismissItem(item.id)}
                    className="ml-1 text-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
