"use client";

/**
 * components/admin/homepage-builder/block-editors/CallToActionBlockEditor.tsx
 *
 * Inspector-based rich editor for the `callToAction` section type.
 *
 * Supports: headline, body text, primary button, secondary button (optional),
 * live button preview, alignment, theme, and background media (image / gradient)
 * wired to _layout.background.
 *
 * Slice G: background image and gradient are now functional via HomepageMediaField
 * and the existing SharedMediaPicker + _layout.background schema.
 *
 * Does NOT add new config schema — operates on existing CallToActionSectionConfig.
 */

import { AlignLeft, AlignCenter, ExternalLink } from "lucide-react";
import type { CallToActionSectionConfig } from "@/lib/homepage/section-types";
import type {
  SectionLayout,
  SectionHAlign,
  SectionTheme,
  SectionBackground,
} from "@/lib/cms/layout-types";
import { GRADIENT_PRESETS } from "@/lib/cms/layout-types";
import {
  CollapsibleSection,
  InspectorField,
  SegmentedControl,
} from "./BlockEditorShell";
import { HomepageMediaField } from "../media";
import type { MediaAssetListItem } from "@/lib/media/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
};

const ALIGN_OPTIONS: { value: SectionHAlign; label: string; icon: React.ReactNode }[] = [
  { value: "left",   label: "Links", icon: <AlignLeft   className="h-3.5 w-3.5" /> },
  { value: "center", label: "Mitte", icon: <AlignCenter className="h-3.5 w-3.5" /> },
];

const THEME_OPTIONS: { value: SectionTheme; label: string }[] = [
  { value: "light", label: "Hell"   },
  { value: "soft",  label: "Soft"   },
  { value: "dark",  label: "Dunkel" },
  { value: "club",  label: "Club"   },
];

const BG_TYPE_OPTIONS: { value: "none" | "image" | "gradient"; label: string }[] = [
  { value: "none",     label: "Kein"    },
  { value: "image",    label: "Bild"    },
  { value: "gradient", label: "Verlauf" },
];

const OVERLAY_OPTIONS: { value: "none" | "light" | "dark"; label: string }[] = [
  { value: "none",  label: "Kein"   },
  { value: "light", label: "Hell"   },
  { value: "dark",  label: "Dunkel" },
];

// ---------------------------------------------------------------------------
// CallToActionBlockEditor
// ---------------------------------------------------------------------------

export function CallToActionBlockEditor({ config, onChange }: Props) {
  const cta = config as CallToActionSectionConfig;
  const layout = (cta._layout ?? {}) as SectionLayout;
  const background: SectionBackground = layout.background ?? { type: "none" };

  // ── Text/CTA helpers ──────────────────────────────────────────────────────

  function set(key: keyof CallToActionSectionConfig, value: string) {
    // Store the raw value to preserve spaces while typing.
    // Only delete the field when the value is entirely whitespace (empty intent).
    const next = { ...config };
    if (value.trim()) {
      next[key] = value;
    } else {
      delete next[key];
    }
    onChange(next);
  }

  function setLayout(patch: Partial<SectionLayout>) {
    onChange({ ...config, _layout: { ...layout, ...patch } });
  }

  function setBackground(bg: SectionBackground) {
    setLayout({ background: bg });
  }

  // ── Background type switch ────────────────────────────────────────────────

  function handleBgTypeChange(type: "none" | "image" | "gradient") {
    switch (type) {
      case "none":
        setBackground({ type: "none" });
        break;
      case "image":
        setBackground({
          type: "image",
          mediaAssetId:
            background.type === "image" ? background.mediaAssetId : "",
          overlay:
            background.type === "image" ? background.overlay : "dark",
        });
        break;
      case "gradient":
        setBackground({
          type: "gradient",
          gradientPreset:
            background.type === "gradient"
              ? background.gradientPreset
              : "club-warm",
        });
        break;
    }
  }

  // ── Background image helpers ──────────────────────────────────────────────

  function handleBgImageSelect(asset: MediaAssetListItem) {
    setBackground({
      type: "image",
      mediaAssetId: asset.id,
      overlay:
        background.type === "image" ? background.overlay : "dark",
    });
  }

  function handleBgImageRemove() {
    setBackground({ type: "none" });
  }

  function handleOverlayChange(overlay: "none" | "light" | "dark") {
    if (background.type === "image") {
      setBackground({ ...background, overlay });
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const hAlign = (layout.hAlign ?? "center") as SectionHAlign;
  const theme  = (layout.theme  ?? "light")  as SectionTheme;
  const hasPrimary   = Boolean(cta.primaryLabel);
  const hasSecondary = Boolean(cta.secondaryLabel);
  const bgType = background.type === "solid" ? "none" : background.type;
  const bgImageId =
    background.type === "image" ? (background.mediaAssetId || null) : null;
  const bgGradientPreset =
    background.type === "gradient" ? background.gradientPreset : "club-warm";
  const bgOverlay =
    background.type === "image" ? background.overlay : "dark";

  return (
    <div>
      {/* ── Content ───────────────────────────────────────────────── */}
      <CollapsibleSection title="Inhalt" defaultOpen>
        <InspectorField label="Überschrift">
          <input
            type="text"
            className="fca-input text-sm"
            placeholder="Deinen Vereinen beitreten"
            value={(cta.title as string) ?? ""}
            onChange={(e) => set("title", e.target.value)}
          />
        </InspectorField>

        <InspectorField label="Beschreibungstext">
          <textarea
            className="fca-textarea min-h-[72px] resize-y text-sm"
            placeholder="Begleittext zum Handlungsaufruf…"
            value={(cta.body as string) ?? ""}
            onChange={(e) => set("body", e.target.value)}
            rows={3}
          />
        </InspectorField>
      </CollapsibleSection>

      {/* ── Primary button ────────────────────────────────────────── */}
      <CollapsibleSection title="Primärer Button">
        <InspectorField label="Schaltflächentext">
          <input
            type="text"
            className="fca-input text-sm"
            placeholder="z. B. Jetzt beitreten"
            value={(cta.primaryLabel as string) ?? ""}
            onChange={(e) => set("primaryLabel", e.target.value)}
          />
        </InspectorField>
        <InspectorField label="URL">
          <div className="relative">
            <input
              type="url"
              className="fca-input text-sm pr-8"
              placeholder="https://…"
              value={(cta.primaryUrl as string) ?? ""}
              onChange={(e) => set("primaryUrl", e.target.value)}
            />
            <ExternalLink className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-[var(--muted)] pointer-events-none" />
          </div>
        </InspectorField>
      </CollapsibleSection>

      {/* ── Secondary button ──────────────────────────────────────── */}
      <CollapsibleSection title="Sekundärer Button" defaultOpen={false}>
        <InspectorField label="Schaltflächentext">
          <input
            type="text"
            className="fca-input text-sm"
            placeholder="z. B. Mehr erfahren (optional)"
            value={(cta.secondaryLabel as string) ?? ""}
            onChange={(e) => set("secondaryLabel", e.target.value)}
          />
        </InspectorField>
        <InspectorField label="URL">
          <div className="relative">
            <input
              type="url"
              className="fca-input text-sm pr-8"
              placeholder="https://…"
              value={(cta.secondaryUrl as string) ?? ""}
              onChange={(e) => set("secondaryUrl", e.target.value)}
            />
            <ExternalLink className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-[var(--muted)] pointer-events-none" />
          </div>
        </InspectorField>
      </CollapsibleSection>

      {/* ── Button preview ────────────────────────────────────────── */}
      {(hasPrimary || hasSecondary) && (
        <div className="px-4 pb-4 pt-2 border-b border-[var(--border)]">
          <p className="text-[10px] text-[var(--muted)] mb-2 font-medium uppercase tracking-wide">
            Schaltflächen-Vorschau
          </p>
          <div className="flex flex-wrap gap-2">
            {hasPrimary && (
              <button type="button" className="fca-button-primary text-xs" disabled>
                {cta.primaryLabel as string}
              </button>
            )}
            {hasSecondary && (
              <button type="button" className="fca-button-secondary text-xs" disabled>
                {cta.secondaryLabel as string}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Appearance ────────────────────────────────────────────── */}
      <CollapsibleSection title="Darstellung" defaultOpen={false}>
        <InspectorField label="Ausrichtung">
          <SegmentedControl
            options={ALIGN_OPTIONS}
            value={hAlign === "right" ? "center" : hAlign}
            onChange={(v) => setLayout({ hAlign: v })}
          />
        </InspectorField>

        <InspectorField label="Farbschema">
          <SegmentedControl
            options={THEME_OPTIONS}
            value={theme}
            onChange={(v) => setLayout({ theme: v })}
            compact
          />
        </InspectorField>
      </CollapsibleSection>

      {/* ── Media ─────────────────────────────────────────────────── */}
      <CollapsibleSection title="Medien" defaultOpen={false}>
        {/* Background type selector */}
        <InspectorField label="Hintergrundtyp">
          <SegmentedControl
            options={BG_TYPE_OPTIONS}
            value={bgType}
            onChange={handleBgTypeChange}
          />
        </InspectorField>

        {/* Background image */}
        {background.type === "image" && (
          <>
            <HomepageMediaField
              assetId={bgImageId}
              onSelect={handleBgImageSelect}
              onRemove={handleBgImageRemove}
              filterType="IMAGE"
              pickerTitle="Hintergrundbild auswählen"
              emptyLabel="Kein Hintergrundbild"
            />

            {/* Overlay picker — only shown when an image is set */}
            {bgImageId && (
              <InspectorField label="Overlay">
                <SegmentedControl
                  options={OVERLAY_OPTIONS}
                  value={bgOverlay}
                  onChange={handleOverlayChange}
                  compact
                />
              </InspectorField>
            )}
          </>
        )}

        {/* Gradient presets */}
        {background.type === "gradient" && (
          <InspectorField label="Verlauf-Preset">
            <div className="space-y-1.5">
              {GRADIENT_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() =>
                    setBackground({ type: "gradient", gradientPreset: p.value })
                  }
                  className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs transition ${
                    bgGradientPreset === p.value
                      ? "border-[var(--tenant-primary)] bg-orange-50 font-medium text-orange-700"
                      : "border-[var(--border)] text-[var(--foreground)] hover:border-[var(--tenant-primary)]"
                  }`}
                >
                  <span
                    className="h-5 w-5 flex-shrink-0 rounded"
                    style={{ backgroundImage: p.style }}
                  />
                  {p.label}
                </button>
              ))}
            </div>
          </InspectorField>
        )}
      </CollapsibleSection>
    </div>
  );
}
