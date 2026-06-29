"use client";

/**
 * HeroConfigForm — CMS V4.2 Component Library
 * Hero section component config editor.
 */

import { useState } from "react";
import SharedMediaPicker from "@/components/admin/media/SharedMediaPicker";
import type { MediaAssetListItem } from "@/lib/media/types";
import { ImageIcon } from "lucide-react";

type HeroConfig = {
  headline: string;
  subline: string;
  imageMediaAssetId: string | null;
  imageUrl: string;
  overlayOpacity: number;
  ctaPrimaryLabel: string;
  ctaPrimaryUrl: string;
  ctaSecondaryLabel: string;
  ctaSecondaryUrl: string;
  textAlign: "left" | "center" | "right";
  heightPreset: "small" | "medium" | "large" | "fullscreen";
  showScrollIndicator: boolean;
};

type Props = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
};

const labelClass = "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5";

export default function HeroConfigForm({ config, onChange }: Props) {
  const c = config as HeroConfig;
  const [pickerOpen, setPickerOpen] = useState(false);

  function set<K extends keyof HeroConfig>(key: K, value: HeroConfig[K]) {
    onChange({ ...config, [key]: value });
  }

  function handleMediaSelect(asset: MediaAssetListItem) {
    onChange({
      ...config,
      imageMediaAssetId: asset.id,
      imageUrl: asset.url,
    });
    setPickerOpen(false);
  }

  function clearMedia() {
    onChange({ ...config, imageMediaAssetId: null, imageUrl: "" });
  }

  return (
    <div className="space-y-5">
      <div>
        <label className={labelClass}>Überschrift</label>
        <input type="text" value={c.headline} onChange={(e) => set("headline", e.target.value)}
          placeholder="Willkommen beim FC Allschwil" className="fca-input" />
      </div>

      <div>
        <label className={labelClass}>Unterzeile</label>
        <textarea value={c.subline} onChange={(e) => set("subline", e.target.value)}
          placeholder="Herzlich willkommen auf unserer offiziellen Website…"
          rows={2} className="fca-input resize-none" />
      </div>

      <div>
        <label className={labelClass}>Hintergrundbild</label>
        {c.imageUrl ? (
          <div className="relative overflow-hidden rounded-lg border border-[var(--border)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.imageUrl} alt="Hero" className="h-32 w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
              <button type="button" onClick={() => setPickerOpen(true)}
                className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium">
                Ersetzen
              </button>
              <button type="button" onClick={clearMedia}
                className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-red-600">
                Entfernen
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setPickerOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--border)] py-6 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
            <ImageIcon className="h-4 w-4" />
            Bild aus Mediathek wählen
          </button>
        )}
        <SharedMediaPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={handleMediaSelect}
          filterType="IMAGE"
          title="Hero-Bild auswählen"
        />
      </div>

      <div>
        <label className={labelClass}>Overlay-Transparenz ({Math.round((c.overlayOpacity ?? 0.4) * 100)}%)</label>
        <input type="range" min={0} max={1} step={0.05}
          value={c.overlayOpacity ?? 0.4}
          onChange={(e) => set("overlayOpacity", parseFloat(e.target.value))}
          className="w-full" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Höhe</label>
          <select value={c.heightPreset} onChange={(e) => set("heightPreset", e.target.value as HeroConfig["heightPreset"])}
            className="fca-input">
            <option value="small">Klein (300px)</option>
            <option value="medium">Mittel (500px)</option>
            <option value="large">Groß (700px)</option>
            <option value="fullscreen">Vollbild</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Textausrichtung</label>
          <select value={c.textAlign} onChange={(e) => set("textAlign", e.target.value as HeroConfig["textAlign"])}
            className="fca-input">
            <option value="left">Links</option>
            <option value="center">Zentriert</option>
            <option value="right">Rechts</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>CTA 1 — Label</label>
          <input type="text" value={c.ctaPrimaryLabel} onChange={(e) => set("ctaPrimaryLabel", e.target.value)}
            placeholder="Mehr erfahren" className="fca-input" />
        </div>
        <div>
          <label className={labelClass}>CTA 1 — URL</label>
          <input type="text" value={c.ctaPrimaryUrl} onChange={(e) => set("ctaPrimaryUrl", e.target.value)}
            placeholder="/ueber-uns" className="fca-input font-mono text-xs" />
        </div>
        <div>
          <label className={labelClass}>CTA 2 — Label</label>
          <input type="text" value={c.ctaSecondaryLabel} onChange={(e) => set("ctaSecondaryLabel", e.target.value)}
            placeholder="Mitglied werden" className="fca-input" />
        </div>
        <div>
          <label className={labelClass}>CTA 2 — URL</label>
          <input type="text" value={c.ctaSecondaryUrl} onChange={(e) => set("ctaSecondaryUrl", e.target.value)}
            placeholder="/mitgliedschaft" className="fca-input font-mono text-xs" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" role="switch" aria-checked={c.showScrollIndicator}
          onClick={() => set("showScrollIndicator", !c.showScrollIndicator)}
          className={`relative h-5 w-9 rounded-full transition-colors ${c.showScrollIndicator ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}>
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${c.showScrollIndicator ? "translate-x-4.5" : "translate-x-0.5"}`} />
        </button>
        <span className="text-sm text-[var(--text-2)]">Scroll-Indikator anzeigen</span>
      </div>
    </div>
  );
}
