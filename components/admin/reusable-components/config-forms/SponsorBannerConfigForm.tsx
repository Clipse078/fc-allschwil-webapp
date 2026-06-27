"use client";

import { useState } from "react";
import { ImageIcon, X } from "lucide-react";
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

export default function SponsorBannerConfigForm({ config, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  function set(key: string, value: unknown) {
    onChange({ ...config, [key]: value });
  }

  function handleLogoSelect(asset: MediaAssetListItem) {
    onChange({
      ...config,
      logoMediaAssetId: asset.id,
      logoUrl: asset.url,
    });
    setPickerOpen(false);
  }

  function clearLogo() {
    onChange({ ...config, logoMediaAssetId: null, logoUrl: "" });
  }

  const logoUrl = (config.logoUrl as string) ?? "";
  const logoAssetId = (config.logoMediaAssetId as string | null) ?? null;

  return (
    <div className="space-y-4">
      <Field label="Sponsor-Name" required>
        <input
          type="text"
          value={(config.sponsorName as string) ?? ""}
          onChange={(e) => set("sponsorName", e.target.value)}
          placeholder="Musterfirma AG"
          className="fca-input"
        />
      </Field>

      {/* Logo — DAM-integrated picker */}
      <Field label="Sponsor-Logo">
        {logoUrl ? (
          <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="Logo" className="h-12 w-auto max-w-[120px] object-contain rounded" />
            <div className="flex-1 min-w-0">
              {logoAssetId && (
                <p className="text-xs text-[var(--muted)] font-mono truncate">DAM: {logoAssetId.slice(0, 12)}…</p>
              )}
              <p className="text-xs text-[var(--muted)] truncate">{logoUrl}</p>
            </div>
            <button
              type="button"
              onClick={clearLogo}
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
            <ImageIcon className="h-4 w-4" />
            Logo aus Mediathek auswählen
          </button>
        )}
        {logoUrl && (
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

      <Field label="Headline">
        <input
          type="text"
          value={(config.headline as string) ?? ""}
          onChange={(e) => set("headline", e.target.value)}
          placeholder="Unser Hauptsponsor"
          className="fca-input"
        />
      </Field>

      <Field label="Text">
        <textarea
          value={(config.text as string) ?? ""}
          onChange={(e) => set("text", e.target.value)}
          rows={2}
          className="fca-input resize-none"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="CTA-Text">
          <input
            type="text"
            value={(config.ctaLabel as string) ?? ""}
            onChange={(e) => set("ctaLabel", e.target.value)}
            placeholder="Website besuchen"
            className="fca-input"
          />
        </Field>
        <Field label="CTA-URL">
          <input
            type="url"
            value={(config.ctaUrl as string) ?? ""}
            onChange={(e) => set("ctaUrl", e.target.value)}
            placeholder="https://sponsor.ch"
            className="fca-input"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Kampagnenstart">
          <input
            type="date"
            value={(config.campaignStart as string) ?? ""}
            onChange={(e) => set("campaignStart", e.target.value || null)}
            className="fca-input"
          />
        </Field>
        <Field label="Kampagnenende">
          <input
            type="date"
            value={(config.campaignEnd as string) ?? ""}
            onChange={(e) => set("campaignEnd", e.target.value || null)}
            className="fca-input"
          />
        </Field>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="click-tracking"
          checked={(config.clickTrackingEnabled as boolean) ?? false}
          onChange={(e) => set("clickTrackingEnabled", e.target.checked)}
          className="h-4 w-4 rounded border-[var(--border)]"
        />
        <label htmlFor="click-tracking" className="text-xs text-[var(--foreground)]">
          Click-Tracking aktivieren
        </label>
      </div>

      <SharedMediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleLogoSelect}
        filterType="IMAGE"
        title="Sponsor-Logo auswählen"
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
