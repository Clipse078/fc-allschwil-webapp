"use client";

/**
 * components/admin/homepage-builder/block-editors/HeroBlockEditor.tsx
 *
 * Inspector-based rich editor for the `hero` section type.
 *
 * Supports: headline, subtitle, CTA label + URL, alignment, theme,
 * plus background media (image / gradient) wired to _layout.background.
 *
 * Slice G: background image and gradient are now functional via HomepageMediaField
 * and the existing SharedMediaPicker + _layout.background schema.
 * Video background is prepared (no schema support yet).
 *
 * Does NOT add new config schema — operates exclusively on the existing
 * HeroSectionConfig + SectionLayout._layout fields.
 */

import { AlignLeft, AlignCenter, AlignRight, ExternalLink } from "lucide-react";
import type { HeroSectionConfig } from "@/lib/homepage/section-types";
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
  MediaPreparedState,
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

// ---------------------------------------------------------------------------
// Alignment + theme options
// ---------------------------------------------------------------------------

const ALIGN_OPTIONS: { value: SectionHAlign; label: string; icon: React.ReactNode }[] = [
  { value: "left",   label: "Links",  icon: <AlignLeft  className="h-3.5 w-3.5" /> },
  { value: "center", label: "Mitte",  icon: <AlignCenter className="h-3.5 w-3.5" /> },
  { value: "right",  label: "Rechts", icon: <AlignRight  className="h-3.5 w-3.5" /> },
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
// HeroBlockEditor
// ---------------------------------------------------------------------------

export function HeroBlockEditor({ config, onChange }: Props) {
  const hero = config as HeroSectionConfig;
  const layout = (hero._layout ?? {}) as SectionLayout;
  const background: SectionBackground = layout.background ?? { type: "none" };

  // ── Text/CTA helpers ──────────────────────────────────────────────────────

  function set(key: keyof HeroSectionConfig, value: string) {
    const trimmed = value.trim();
    const next = { ...config };
    if (trimmed) {
      next[key] = trimmed;
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

  const hAlign = layout.hAlign ?? "left";
  const theme  = layout.theme  ?? "light";
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
        <InspectorField
          label="Hauptüberschrift"
          help="Leer lassen → Vereinsname als Fallback"
        >
          <input
            type="text"
            className="fca-input text-sm"
            placeholder="FC Allschwil · Leidenschaft für Fussball"
            value={(hero.title as string) ?? ""}
            onChange={(e) => set("title", e.target.value)}
          />
        </InspectorField>

        <InspectorField label="Untertitel">
          <input
            type="text"
            className="fca-input text-sm"
            placeholder="Ergänzender Text unter der Überschrift"
            value={(hero.subtitle as string) ?? ""}
            onChange={(e) => set("subtitle", e.target.value)}
          />
        </InspectorField>
      </CollapsibleSection>

      {/* ── Call to action ────────────────────────────────────────── */}
      <CollapsibleSection title="Handlungsaufruf">
        <InspectorField label="Schaltflächentext">
          <input
            type="text"
            className="fca-input text-sm"
            placeholder="z. B. Mehr erfahren"
            value={(hero.ctaLabel as string) ?? ""}
            onChange={(e) => set("ctaLabel", e.target.value)}
          />
        </InspectorField>

        <InspectorField label="Ziel-URL">
          <div className="relative">
            <input
              type="url"
              className="fca-input text-sm pr-8"
              placeholder="https://…"
              value={(hero.ctaUrl as string) ?? ""}
              onChange={(e) => set("ctaUrl", e.target.value)}
            />
            <ExternalLink className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-[var(--muted)] pointer-events-none" />
          </div>
        </InspectorField>

        {/* Live button preview */}
        {hero.ctaLabel && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
            <p className="text-[10px] text-[var(--muted)] mb-2 font-medium uppercase tracking-wide">
              Vorschau
            </p>
            <button type="button" className="fca-button-primary text-xs" disabled>
              {hero.ctaLabel as string}
            </button>
          </div>
        )}
      </CollapsibleSection>

      {/* ── Appearance ────────────────────────────────────────────── */}
      <CollapsibleSection title="Darstellung" defaultOpen={false}>
        <InspectorField label="Textausrichtung">
          <SegmentedControl
            options={ALIGN_OPTIONS}
            value={hAlign}
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

        {/* Video background — no schema support yet */}
        <MediaPreparedState
          label="Video-Hintergrund"
          hint="Video-Hintergründe werden in einem späteren Slice unterstützt."
          type="video"
        />
      </CollapsibleSection>
    </div>
  );
}
