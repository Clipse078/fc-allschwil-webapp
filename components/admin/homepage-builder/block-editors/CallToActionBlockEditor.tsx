"use client";

/**
 * components/admin/homepage-builder/block-editors/CallToActionBlockEditor.tsx
 *
 * Inspector-based rich editor for the `callToAction` section type.
 *
 * Supports: headline, body text, primary button, secondary button (optional),
 * live button preview, alignment, theme, and Slice G media placeholders.
 *
 * Does NOT add new config schema — operates on existing CallToActionSectionConfig.
 */

import { AlignLeft, AlignCenter, ExternalLink } from "lucide-react";
import type { CallToActionSectionConfig } from "@/lib/homepage/section-types";
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

// ---------------------------------------------------------------------------
// CallToActionBlockEditor
// ---------------------------------------------------------------------------

export function CallToActionBlockEditor({ config, onChange }: Props) {
  const cta = config as CallToActionSectionConfig;
  const layout = (cta._layout ?? {}) as SectionLayout;

  function set(key: keyof CallToActionSectionConfig, value: string) {
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

  const hAlign = (layout.hAlign ?? "center") as SectionHAlign;
  const theme  = (layout.theme  ?? "light")  as SectionTheme;
  const hasPrimary   = Boolean(cta.primaryLabel);
  const hasSecondary = Boolean(cta.secondaryLabel);

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
      </CollapsibleSection>
    </div>
  );
}
