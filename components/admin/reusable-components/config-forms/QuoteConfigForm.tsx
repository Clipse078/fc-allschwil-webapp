"use client";

import { useState } from "react";
import { UserCircle, X } from "lucide-react";
import dynamic from "next/dynamic";
import type { MediaAssetListItem } from "@/lib/media/types";

const SharedMediaPicker = dynamic(
  () => import("@/components/admin/media/SharedMediaPicker"),
  { ssr: false },
);

type Props = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
};

export default function QuoteConfigForm({ config, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  function set(key: string, value: unknown) {
    onChange({ ...config, [key]: value });
  }

  function handleImageSelect(asset: MediaAssetListItem) {
    onChange({
      ...config,
      imageMediaAssetId: asset.id,
      imageUrl: asset.url,
    });
    setPickerOpen(false);
  }

  function clearImage() {
    onChange({ ...config, imageMediaAssetId: null, imageUrl: "" });
  }

  const imageUrl = (config.imageUrl as string) ?? "";
  const imageAssetId = (config.imageMediaAssetId as string | null) ?? null;

  return (
    <div className="space-y-4">
      <Field label="Zitat" required>
        <textarea
          value={(config.quote as string) ?? ""}
          onChange={(e) => set("quote", e.target.value)}
          rows={4}
          placeholder="«Der FC Allschwil ist mehr als ein Verein — er ist eine Gemeinschaft.»"
          className="fca-input resize-none"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Autor">
          <input
            type="text"
            value={(config.author as string) ?? ""}
            onChange={(e) => set("author", e.target.value)}
            placeholder="Max Mustermann"
            className="fca-input"
          />
        </Field>
        <Field label="Organisation">
          <input
            type="text"
            value={(config.organisation as string) ?? ""}
            onChange={(e) => set("organisation", e.target.value)}
            placeholder="FC Allschwil"
            className="fca-input"
          />
        </Field>
      </div>

      {/* Author photo — DAM-integrated picker */}
      <Field label="Autoren-Foto">
        {imageUrl ? (
          <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Autoren-Foto" className="h-12 w-12 rounded-full object-cover" />
            <div className="flex-1 min-w-0">
              {imageAssetId && (
                <p className="text-xs text-[var(--muted)] font-mono truncate">DAM: {imageAssetId.slice(0, 12)}…</p>
              )}
              <p className="text-xs text-[var(--muted)] truncate">{imageUrl}</p>
            </div>
            <button
              type="button"
              onClick={clearImage}
              className="flex-shrink-0 rounded-md p-1 text-[var(--muted)] hover:text-red-600 hover:bg-red-50"
              title="Entfernen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 text-sm text-[var(--muted)] hover:border-[var(--tenant-primary)] hover:text-[var(--foreground)] transition-colors"
          >
            <UserCircle className="h-4 w-4" />
            Autoren-Foto aus Mediathek auswählen
          </button>
        )}
        {imageUrl && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="mt-1.5 text-xs text-[var(--tenant-primary)] hover:underline"
          >
            Anderes Bild auswählen
          </button>
        )}
        <p className="mt-1 text-xs text-[var(--muted)]">
          Bild wird aus der DAM-Mediathek referenziert (mediaAssetId).
        </p>
      </Field>

      <Field label="Stil">
        <select
          value={(config.stylePreset as string) ?? "default"}
          onChange={(e) => set("stylePreset", e.target.value)}
          className="fca-input"
        >
          <option value="default">Standard</option>
          <option value="large">Gross</option>
          <option value="minimal">Minimal</option>
          <option value="accent">Akzent (Vereinsfarbe)</option>
        </select>
      </Field>

      <SharedMediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleImageSelect}
        filterType="IMAGE"
        title="Autoren-Foto auswählen"
      />
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[var(--foreground)]">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
