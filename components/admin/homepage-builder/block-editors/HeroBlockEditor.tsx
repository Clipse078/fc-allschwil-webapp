"use client";

/**
 * components/admin/homepage-builder/block-editors/HeroBlockEditor.tsx
 *
 * Inspector-based rich editor for the `hero` section type.
 *
 * Supports: headline, subtitle, CTA label + URL, alignment, theme,
 * plus Slice G media placeholders for background / gradient / video.
 *
 * Does NOT add new config schema — operates exclusively on the existing
 * HeroSectionConfig + SectionLayout._layout fields.
 */

import { AlignLeft, AlignCenter, AlignRight, ExternalLink } from "lucide-react";
import type { HeroSectionConfig } from "@/lib/homepage/section-types";
import type { SectionLayout, SectionHAlign, SectionTheme } from "@/lib/cms/layout-types";
import {
  CollapsibleSection,
  InspectorField,
  SegmentedControl,
  MediaPlaceholder,
} from "./BlockEditorShell";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
};

// ---------------------------------------------------------------------------
// Alignment options
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

// ---------------------------------------------------------------------------
// HeroBlockEditor
// ---------------------------------------------------------------------------

export function HeroBlockEditor({ config, onChange }: Props) {
  const hero = config as HeroSectionConfig;
  const layout = (hero._layout ?? {}) as SectionLayout;

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

  const hAlign = layout.hAlign ?? "left";
  const theme  = layout.theme  ?? "light";

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

      {/* ── Media (Slice G placeholders) ──────────────────────────── */}
      <CollapsibleSection title="Medien" defaultOpen={false}>
        <MediaPlaceholder
          label="Hintergrundbild"
          hint="Bild aus der Mediathek auswählen"
          type="background"
        />
        <MediaPlaceholder
          label="Farbverlauf"
          hint="Gradient-Overlay konfigurieren"
          type="gradient"
        />
        <MediaPlaceholder
          label="Video-Hintergrund"
          hint="Hintergrundvideo aus der Mediathek"
          type="video"
        />
      </CollapsibleSection>
    </div>
  );
}
