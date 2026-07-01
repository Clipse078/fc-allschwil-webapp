"use client";

/**
 * components/admin/homepage-builder/block-editors/ColorPalettePicker.tsx
 *
 * Admin-only rich color palette picker for Homepage Builder block editors.
 *
 * Replaces the limited fixed preset list with:
 *   - Tenant colors (CSS variable refs — adapts to any tenant branding)
 *   - Neutral scale (white → black)
 *   - Semantic palette (info, success, warning, danger)
 *   - Extended accent palette
 *   - Recent colors (session-local, up to 8)
 *   - Custom hex input (with basic validation)
 *
 * The component is admin-only. No new config schema fields are added;
 * selections write to the existing SectionBackground.solid.color field.
 *
 * Public API:
 *   value     — currently selected color hex (or CSS variable string)
 *   onChange  — called with the new color string when selection changes
 */

import { useState, useRef } from "react";
import { Check, ChevronDown, ChevronUp, Pipette } from "lucide-react";

// ---------------------------------------------------------------------------
// Palette definitions
// ---------------------------------------------------------------------------

type PaletteColor = {
  label: string;
  value: string;
  /** Inline style background — can be a CSS var for tenant colors. */
  style: string;
};

type PaletteGroup = {
  label: string;
  colors: PaletteColor[];
};

const TENANT_COLORS: PaletteColor[] = [
  { label: "Primär",    value: "var(--tenant-primary)",   style: "var(--tenant-primary)"   },
  { label: "SCE Primary", value: "var(--sce-primary)",    style: "var(--sce-primary)"      },
];

const NEUTRAL_COLORS: PaletteColor[] = [
  { label: "Weiß",      value: "#ffffff", style: "#ffffff" },
  { label: "Gray 50",   value: "#f9fafb", style: "#f9fafb" },
  { label: "Gray 100",  value: "#f3f4f6", style: "#f3f4f6" },
  { label: "Gray 200",  value: "#e5e7eb", style: "#e5e7eb" },
  { label: "Gray 400",  value: "#9ca3af", style: "#9ca3af" },
  { label: "Gray 600",  value: "#4b5563", style: "#4b5563" },
  { label: "Gray 800",  value: "#1f2937", style: "#1f2937" },
  { label: "Gray 900",  value: "#111827", style: "#111827" },
  { label: "Schwarz",   value: "#000000", style: "#000000" },
];

const ACCENT_COLORS: PaletteColor[] = [
  { label: "Orange 500", value: "#f97316", style: "#f97316" },
  { label: "Red 600",    value: "#dc2626", style: "#dc2626" },
  { label: "Blue 600",   value: "#2563eb", style: "#2563eb" },
  { label: "Blue 800",   value: "#1e40af", style: "#1e40af" },
  { label: "Purple 600", value: "#9333ea", style: "#9333ea" },
  { label: "Green 600",  value: "#16a34a", style: "#16a34a" },
  { label: "Emerald 500",value: "#10b981", style: "#10b981" },
  { label: "Amber 500",  value: "#f59e0b", style: "#f59e0b" },
  { label: "Teal 600",   value: "#0d9488", style: "#0d9488" },
  { label: "Rose 600",   value: "#e11d48", style: "#e11d48" },
];

const DARK_COLORS: PaletteColor[] = [
  { label: "Slate 900",  value: "#0f172a", style: "#0f172a" },
  { label: "Slate 800",  value: "#1e293b", style: "#1e293b" },
  { label: "Slate 700",  value: "#334155", style: "#334155" },
  { label: "Zinc 900",   value: "#18181b", style: "#18181b" },
  { label: "Neutral 900",value: "#171717", style: "#171717" },
];

const PALETTE_GROUPS: PaletteGroup[] = [
  { label: "Verein",     colors: TENANT_COLORS   },
  { label: "Neutral",    colors: NEUTRAL_COLORS  },
  { label: "Akzente",    colors: ACCENT_COLORS   },
  { label: "Dunkel",     colors: DARK_COLORS     },
];

// ---------------------------------------------------------------------------
// Session-local recent colors store
// ---------------------------------------------------------------------------

const recentStore: string[] = [];

function addRecent(color: string) {
  if (recentStore.includes(color)) return;
  recentStore.unshift(color);
  if (recentStore.length > 8) recentStore.pop();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidHex(v: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
}

function swatch(style: string, selected: boolean, label: string, onClick: () => void) {
  return (
    <button
      key={style}
      type="button"
      title={label}
      onClick={onClick}
      className={`relative h-6 w-6 rounded-md border transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] ${
        selected
          ? "border-[var(--sce-primary)] ring-2 ring-[var(--sce-primary)] ring-offset-1 scale-110"
          : style === "#ffffff" || style === "#f9fafb"
          ? "border-gray-300"
          : "border-transparent"
      }`}
      style={{ background: style }}
      aria-pressed={selected}
    >
      {selected && (
        <Check
          className="absolute inset-0 m-auto h-3 w-3"
          style={{ color: style === "#ffffff" || style === "#f9fafb" ? "#374151" : "white" }}
        />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type ColorPalettePickerProps = {
  value: string;
  onChange: (color: string) => void;
};

// ---------------------------------------------------------------------------
// ColorPalettePicker
// ---------------------------------------------------------------------------

export function ColorPalettePicker({ value, onChange }: ColorPalettePickerProps) {
  const [inputHex, setInputHex] = useState("");
  const [hexError, setHexError] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const hexRef = useRef<HTMLInputElement>(null);

  function select(color: string) {
    addRecent(color);
    setInputHex(""); // clear custom hex input on swatch selection
    setHexError(false);
    onChange(color);
  }

  function handleHexChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setInputHex(v);
    if (isValidHex(v)) {
      setHexError(false);
      addRecent(v);
      onChange(v);
    } else {
      setHexError(v.length > 0 && v !== "#");
    }
  }

  const recentColors = [...recentStore];
  // Derive display value for the swatch preview next to the hex input
  const previewColor = isValidHex(inputHex) ? inputHex : (isValidHex(value) ? value : null);

  return (
    <div className="space-y-3">
      {/* Palette groups */}
      {PALETTE_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1.5">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {group.colors.map((c) =>
              swatch(c.style, value === c.value, c.label, () => select(c.value)),
            )}
          </div>
        </div>
      ))}

      {/* Recent colors */}
      {recentColors.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowRecent((s) => !s)}
            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] hover:text-[var(--foreground)] transition mb-1.5"
          >
            {showRecent ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            Zuletzt verwendet ({recentColors.length})
          </button>
          {showRecent && (
            <div className="flex flex-wrap gap-1.5">
              {recentColors.map((c) =>
                swatch(c, value === c, c, () => select(c)),
              )}
            </div>
          )}
        </div>
      )}

      {/* Custom hex input */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1.5 flex items-center gap-1">
          <Pipette className="h-2.5 w-2.5" />
          Benutzerdefiniert
        </p>
        <div className="flex items-center gap-2">
          <div
            className="h-7 w-7 shrink-0 rounded-md border border-[var(--border)]"
            style={{ background: previewColor ?? "var(--surface-2)" }}
          />
          <input
            ref={hexRef}
            type="text"
            className={`fca-input text-xs font-mono flex-1 ${hexError ? "border-rose-400 focus:ring-rose-400" : ""}`}
            placeholder="#f97316"
            value={inputHex}
            onChange={handleHexChange}
            maxLength={7}
            spellCheck={false}
          />
        </div>
        {hexError && (
          <p className="mt-1 text-[11px] text-rose-600">
            Ungültiger Hex-Wert (z. B. #f97316 oder #fff)
          </p>
        )}
      </div>
    </div>
  );
}
