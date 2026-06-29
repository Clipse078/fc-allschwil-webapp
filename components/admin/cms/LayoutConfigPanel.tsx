"use client";

/**
 * components/admin/cms/LayoutConfigPanel.tsx
 *
 * Flexible Layout System — shared property panel for every CMS block.
 *
 * Provides a consistent "Layout" editing experience regardless of block type.
 * Editors configure:
 *   - Width (container max-width)
 *   - Spacing (vertical padding top/bottom)
 *   - Theme (colour scheme / tenant branding inheritance)
 *   - Alignment (horizontal text alignment)
 *   - Columns (grid preset — shown when features.columns = true)
 *   - Background (none / solid / gradient / DAM image + overlay)
 *   - Responsive (stacking rules — shown when features.responsive = true)
 *
 * Writes to / reads from `SectionLayout` which is stored as `_layout`
 * inside each block's config JSON.
 *
 * Usage:
 *   import LayoutConfigPanel from "@/components/admin/cms/LayoutConfigPanel";
 *   <LayoutConfigPanel layout={cfg._layout} onChange={(l) => update({ _layout: l })} />
 */

import { useState } from "react";
import { Image as ImageIcon, X } from "lucide-react";
import SharedMediaPicker from "@/components/admin/media/SharedMediaPicker";
import type { MediaAssetListItem } from "@/lib/media/types";
import type {
  SectionLayout,
  SectionWidth,
  SectionSpacing,
  SectionTheme,
  SectionHAlign,
  SectionColumns,
  SectionBackground,
  SectionResponsive,
} from "@/lib/cms/layout-types";
import { GRADIENT_PRESETS, DEFAULT_SECTION_LAYOUT } from "@/lib/cms/layout-types";

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

export type LayoutPanelFeatures = {
  /** Show column grid picker. Default: false (single-column blocks). */
  columns?: boolean;
  /** Show responsive rules section. Default: false. */
  responsive?: boolean;
  /** Show vertical alignment picker. Default: false. */
  vAlign?: boolean;
  /** Show horizontal padding picker. Default: false. */
  paddingX?: boolean;
  /**
   * Show background section. Default: true.
   * Set to false when the inspector renders background in a dedicated section.
   */
  background?: boolean;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  layout: SectionLayout | undefined;
  onChange: (layout: SectionLayout) => void;
  features?: LayoutPanelFeatures;
  /**
   * When true, renders ONLY the background section and hides all layout controls.
   * Used by the Inspector Panel's dedicated Background section.
   */
  backgroundOnly?: boolean;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Option button pattern (reused throughout)
// ---------------------------------------------------------------------------

function OptionButton({
  active,
  onClick,
  children,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border py-1.5 text-center text-xs transition ${
        active
          ? "border-[var(--brand-primary,#f97316)] bg-orange-50 font-medium text-orange-700"
          : "border-[var(--border)] text-[var(--text-2)] hover:border-[var(--brand-primary,#f97316)]"
      } ${className}`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Width section
// ---------------------------------------------------------------------------

const WIDTH_OPTIONS: { value: SectionWidth; label: string; hint: string }[] = [
  { value: "narrow", label: "Schmal", hint: "~896 px" },
  { value: "normal", label: "Normal", hint: "~1152 px" },
  { value: "wide", label: "Breit", hint: "~1280 px" },
  { value: "full", label: "Vollbreite", hint: "unbegrenzt" },
];

function WidthSection({
  value,
  onChange,
}: {
  value: SectionWidth;
  onChange: (v: SectionWidth) => void;
}) {
  return (
    <div>
      <SectionHeading>Inhaltsbreite</SectionHeading>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {WIDTH_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-md border px-1.5 py-2 text-center transition ${
              value === opt.value
                ? "border-[var(--brand-primary,#f97316)] bg-orange-50"
                : "border-[var(--border)] hover:border-[var(--brand-primary,#f97316)]"
            }`}
          >
            <p className={`text-xs font-medium ${value === opt.value ? "text-orange-700" : "text-[var(--foreground)]"}`}>
              {opt.label}
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--muted)]">{opt.hint}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spacing section
// ---------------------------------------------------------------------------

const SPACING_OPTIONS: { value: SectionSpacing; label: string }[] = [
  { value: "none", label: "Kein" },
  { value: "sm", label: "Klein" },
  { value: "md", label: "Mittel" },
  { value: "lg", label: "Groß" },
  { value: "xl", label: "Sehr groß" },
];

function SpacingSection({
  spacingTop,
  spacingBottom,
  onTopChange,
  onBottomChange,
}: {
  spacingTop: SectionSpacing;
  spacingBottom: SectionSpacing;
  onTopChange: (v: SectionSpacing) => void;
  onBottomChange: (v: SectionSpacing) => void;
}) {
  return (
    <>
      <div>
        <SectionHeading>Abstand oben</SectionHeading>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {SPACING_OPTIONS.map((s) => (
            <OptionButton key={s.value} active={spacingTop === s.value} onClick={() => onTopChange(s.value)}>
              {s.label}
            </OptionButton>
          ))}
        </div>
      </div>
      <div>
        <SectionHeading>Abstand unten</SectionHeading>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {SPACING_OPTIONS.map((s) => (
            <OptionButton key={s.value} active={spacingBottom === s.value} onClick={() => onBottomChange(s.value)}>
              {s.label}
            </OptionButton>
          ))}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Theme section
// ---------------------------------------------------------------------------

const THEME_OPTIONS: {
  value: SectionTheme;
  label: string;
  desc: string;
  preview: string;
}[] = [
  { value: "light", label: "Hell", desc: "Weißer Hintergrund", preview: "bg-white border" },
  { value: "soft", label: "Soft", desc: "Helles Grau", preview: "bg-gray-50 border" },
  { value: "dark", label: "Dunkel", desc: "Dunkler Hintergrund", preview: "bg-gray-900" },
  { value: "club", label: "Vereinsfarbe", desc: "Primärfarbe", preview: "bg-orange-500" },
];

function ThemeSection({
  value,
  onChange,
}: {
  value: SectionTheme;
  onChange: (v: SectionTheme) => void;
}) {
  return (
    <div>
      <SectionHeading>Farbschema</SectionHeading>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {THEME_OPTIONS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition ${
              value === t.value
                ? "border-[var(--brand-primary,#f97316)] ring-1 ring-[var(--brand-primary,#f97316)]"
                : "border-[var(--border)] hover:border-[var(--brand-primary,#f97316)]"
            }`}
          >
            <div className={`h-8 w-8 flex-shrink-0 rounded ${t.preview}`} />
            <div>
              <p className="text-xs font-medium text-[var(--foreground)]">{t.label}</p>
              <p className="text-[10px] text-[var(--muted)]">{t.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alignment section
// ---------------------------------------------------------------------------

const HALIGN_OPTIONS: { value: SectionHAlign; label: string }[] = [
  { value: "left", label: "Links" },
  { value: "center", label: "Zentriert" },
  { value: "right", label: "Rechts" },
];

function AlignmentSection({
  value,
  onChange,
}: {
  value: SectionHAlign;
  onChange: (v: SectionHAlign) => void;
}) {
  return (
    <div>
      <SectionHeading>Textausrichtung</SectionHeading>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {HALIGN_OPTIONS.map((a) => (
          <OptionButton key={a.value} active={value === a.value} onClick={() => onChange(a.value)}>
            {a.label}
          </OptionButton>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Columns section
// ---------------------------------------------------------------------------

const COLUMNS_OPTIONS: {
  value: SectionColumns;
  label: string;
  desc: string;
}[] = [
  { value: "single", label: "Einspaltig", desc: "Volle Breite" },
  { value: "50/50", label: "50 / 50", desc: "Gleichwertig" },
  { value: "33/66", label: "33 / 66", desc: "Schmal links" },
  { value: "66/33", label: "66 / 33", desc: "Breit links" },
  { value: "25/75", label: "25 / 75", desc: "Sidebar links" },
  { value: "75/25", label: "75 / 25", desc: "Sidebar rechts" },
];

function ColumnsSection({
  value,
  onChange,
}: {
  value: SectionColumns;
  onChange: (v: SectionColumns) => void;
}) {
  return (
    <div>
      <SectionHeading>Spalten</SectionHeading>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {COLUMNS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-lg border px-3 py-2 text-left transition ${
              value === opt.value
                ? "border-[var(--brand-primary,#f97316)] bg-orange-50"
                : "border-[var(--border)] hover:border-[var(--brand-primary,#f97316)]"
            }`}
          >
            <p className={`text-xs font-semibold ${value === opt.value ? "text-orange-700" : "text-[var(--foreground)]"}`}>
              {opt.label}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--muted)]">{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Background section
// ---------------------------------------------------------------------------

const BG_TYPES: {
  value: SectionBackground["type"];
  label: string;
  desc: string;
}[] = [
  { value: "none", label: "Kein Hintergrund", desc: "Standard-Seitenhintergrund." },
  { value: "solid", label: "Vollton", desc: "Einfarbige Hintergrundfläche." },
  { value: "gradient", label: "Verlauf", desc: "Vordefinierter Farbverlauf." },
  { value: "image", label: "Hintergrundbild", desc: "DAM-Bild mit optionalem Overlay." },
];

function BackgroundSection({
  value,
  onChange,
}: {
  value: SectionBackground;
  onChange: (bg: SectionBackground) => void;
}) {
  const [bgMediaPicker, setBgMediaPicker] = useState(false);

  function setBgType(type: SectionBackground["type"]) {
    switch (type) {
      case "none":
        onChange({ type: "none" });
        break;
      case "solid":
        onChange({ type: "solid", color: "#f3f4f6" });
        break;
      case "gradient":
        onChange({ type: "gradient", gradientPreset: "club-warm" });
        break;
      case "image":
        onChange({ type: "image", mediaAssetId: "", overlay: "dark" });
        break;
    }
  }

  return (
    <>
      <div>
        <SectionHeading>Hintergrundtyp</SectionHeading>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {BG_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setBgType(t.value)}
              className={`rounded-lg border p-2.5 text-left transition ${
                value.type === t.value
                  ? "border-[var(--brand-primary,#f97316)] bg-orange-50"
                  : "border-[var(--border)] hover:border-[var(--brand-primary,#f97316)]"
              }`}
            >
              <p className={`text-xs font-semibold ${value.type === t.value ? "text-orange-700" : "text-[var(--foreground)]"}`}>
                {t.label}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--muted)]">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {value.type === "solid" && (
        <div>
          <SectionHeading>Hintergrundfarbe</SectionHeading>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="color"
              value={value.color ?? "#f3f4f6"}
              onChange={(e) =>
                onChange({ type: "solid", color: e.target.value })
              }
              className="h-9 w-12 cursor-pointer rounded border border-[var(--border)] p-0.5"
            />
            <input
              type="text"
              value={value.color ?? "#f3f4f6"}
              onChange={(e) =>
                onChange({ type: "solid", color: e.target.value })
              }
              placeholder="#f3f4f6"
              className="fca-input flex-1 font-mono text-xs"
            />
          </div>
        </div>
      )}

      {value.type === "gradient" && (
        <div>
          <SectionHeading>Verlauf-Preset</SectionHeading>
          <div className="mt-2 space-y-1.5">
            {GRADIENT_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() =>
                  onChange({ type: "gradient", gradientPreset: p.value })
                }
                className={`w-full rounded-md border px-3 py-2 text-left text-xs transition ${
                  value.type === "gradient" && value.gradientPreset === p.value
                    ? "border-[var(--brand-primary,#f97316)] bg-orange-50 font-medium text-orange-700"
                    : "border-[var(--border)] hover:border-[var(--brand-primary,#f97316)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-4 w-4 flex-shrink-0 rounded"
                    style={{ backgroundImage: p.style }}
                  />
                  {p.label}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {value.type === "image" && (
        <>
          <div>
            <SectionHeading>Hintergrundbild</SectionHeading>
            <div className="mt-2 flex items-center gap-2">
              {value.mediaAssetId ? (
                <>
                  <span className="flex-1 truncate text-[11px] font-mono text-[var(--muted)]">
                    {value.mediaAssetId}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({ type: "image", mediaAssetId: "", overlay: value.overlay })
                    }
                    className="sce-icon-button text-rose-500"
                    title="Bild entfernen"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <p className="flex-1 text-[11px] text-[var(--muted)]">Kein Bild ausgewählt.</p>
              )}
              <button
                type="button"
                onClick={() => setBgMediaPicker(true)}
                className="flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs hover:bg-[var(--surface-2)] transition"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Auswählen
              </button>
            </div>
          </div>

          <div>
            <SectionHeading>Overlay</SectionHeading>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {(["none", "light", "dark"] as const).map((o) => (
                <OptionButton
                  key={o}
                  active={value.type === "image" && value.overlay === o}
                  onClick={() =>
                    onChange({ type: "image", mediaAssetId: value.mediaAssetId, overlay: o })
                  }
                >
                  {o === "none" ? "Kein" : o === "light" ? "Hell" : "Dunkel"}
                </OptionButton>
              ))}
            </div>
          </div>

          <SharedMediaPicker
            open={bgMediaPicker}
            onClose={() => setBgMediaPicker(false)}
            onSelect={(asset: MediaAssetListItem) => {
              onChange({
                type: "image",
                mediaAssetId: asset.id,
                overlay: value.type === "image" ? value.overlay : "dark",
              });
              setBgMediaPicker(false);
            }}
            filterType="IMAGE"
            title="Hintergrundbild auswählen"
          />
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Responsive section
// ---------------------------------------------------------------------------

function ResponsiveSection({
  value,
  onChange,
}: {
  value: SectionResponsive;
  onChange: (r: SectionResponsive) => void;
}) {
  const rules: {
    key: keyof SectionResponsive;
    label: string;
    hint: string;
  }[] = [
    {
      key: "stackOnMobile",
      label: "Stapeln auf Mobil",
      hint: "Spalten werden auf kleinen Bildschirmen untereinander angezeigt.",
    },
    {
      key: "reverseStackOnMobile",
      label: "Gestapelte Reihenfolge umkehren",
      hint: "Die zweite Spalte erscheint zuerst beim Stapeln.",
    },
    {
      key: "hideImageOnMobile",
      label: "Bild auf Mobil ausblenden",
      hint: "Das Bild wird auf kleinen Bildschirmen nicht angezeigt.",
    },
    {
      key: "equalHeights",
      label: "Gleiche Spaltenhöhen",
      hint: "Beide Spalten erhalten dieselbe Höhe.",
    },
  ];

  return (
    <div>
      <SectionHeading>Responsiv</SectionHeading>
      <div className="mt-2 space-y-2">
        {rules.map((rule) => (
          <label
            key={rule.key}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] p-3 hover:border-[var(--brand-primary,#f97316)] transition"
          >
            <input
              type="checkbox"
              checked={value[rule.key] ?? false}
              onChange={(e) => onChange({ ...value, [rule.key]: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-[var(--border)] accent-orange-500"
            />
            <div>
              <p className="text-xs font-medium text-[var(--foreground)]">{rule.label}</p>
              <p className="text-[11px] text-[var(--muted)]">{rule.hint}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main LayoutConfigPanel
// ---------------------------------------------------------------------------

export default function LayoutConfigPanel({
  layout,
  onChange,
  features = {},
  backgroundOnly = false,
}: Props) {
  const l: SectionLayout = layout ?? {};

  function patch(updates: Partial<SectionLayout>) {
    onChange({ ...l, ...updates });
  }

  const width = l.width ?? DEFAULT_SECTION_LAYOUT.width!;
  const spacingTop = l.spacingTop ?? DEFAULT_SECTION_LAYOUT.spacingTop!;
  const spacingBottom = l.spacingBottom ?? DEFAULT_SECTION_LAYOUT.spacingBottom!;
  const theme = l.theme ?? DEFAULT_SECTION_LAYOUT.theme!;
  const hAlign = l.hAlign ?? DEFAULT_SECTION_LAYOUT.hAlign!;
  const columns = l.columns ?? DEFAULT_SECTION_LAYOUT.columns!;
  const background = l.background ?? DEFAULT_SECTION_LAYOUT.background!;
  const responsive: SectionResponsive = l.responsive ?? DEFAULT_SECTION_LAYOUT.responsive ?? {};

  // Background-only mode: render only the background section (for Inspector Panel)
  if (backgroundOnly) {
    return (
      <div className="space-y-5">
        <BackgroundSection
          value={background}
          onChange={(bg) => patch({ background: bg })}
        />
      </div>
    );
  }

  // Default: whether to show background section (default true)
  const showBackground = features.background !== false;

  return (
    <div className="space-y-5">
      <WidthSection value={width} onChange={(v) => patch({ width: v })} />

      <SpacingSection
        spacingTop={spacingTop}
        spacingBottom={spacingBottom}
        onTopChange={(v) => patch({ spacingTop: v })}
        onBottomChange={(v) => patch({ spacingBottom: v })}
      />

      <ThemeSection value={theme} onChange={(v) => patch({ theme: v })} />

      <AlignmentSection value={hAlign} onChange={(v) => patch({ hAlign: v })} />

      {features.columns && (
        <ColumnsSection value={columns} onChange={(v) => patch({ columns: v })} />
      )}

      {showBackground && (
        <BackgroundSection
          value={background}
          onChange={(bg) => patch({ background: bg })}
        />
      )}

      {features.responsive && (
        <ResponsiveSection
          value={responsive}
          onChange={(r) => patch({ responsive: r })}
        />
      )}
    </div>
  );
}
