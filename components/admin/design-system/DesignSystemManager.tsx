"use client";

/**
 * components/admin/design-system/DesignSystemManager.tsx
 *
 * Design System Manager — CMS V4
 *
 * Inspector-style tabbed editor for tenant design tokens.
 * All changes are previewed live before saving.
 */

import { useState, useCallback, useTransition } from "react";
import {
  Palette,
  Type,
  MousePointer2,
  LayoutGrid,
  Move,
  Square,
  Layers,
  PlayCircle,
  RotateCcw,
  Save,
  ChevronRight,
  Check,
  AlertCircle,
} from "lucide-react";
import type {
  ResolvedDesignSystem,
  TenantDesignSystem,
  TypographyToken,
  ButtonTokenStyle,
  CardTokenStyle,
} from "@/lib/website/design-system-types";

// ─────────────────────────────────────────────────────────────────────────────
// Tab definitions
// ─────────────────────────────────────────────────────────────────────────────

type TabKey =
  | "typography"
  | "colors"
  | "buttons"
  | "cards"
  | "spacing"
  | "shadows"
  | "radius"
  | "sectionWidths"
  | "animations";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "typography", label: "Typografie", icon: <Type className="h-3.5 w-3.5" /> },
  { key: "colors", label: "Farben", icon: <Palette className="h-3.5 w-3.5" /> },
  { key: "buttons", label: "Buttons", icon: <MousePointer2 className="h-3.5 w-3.5" /> },
  { key: "cards", label: "Cards", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  { key: "spacing", label: "Abstände", icon: <Move className="h-3.5 w-3.5" /> },
  { key: "shadows", label: "Schatten", icon: <Layers className="h-3.5 w-3.5" /> },
  { key: "radius", label: "Radius", icon: <Square className="h-3.5 w-3.5" /> },
  { key: "sectionWidths", label: "Breiten", icon: <Layers className="h-3.5 w-3.5" /> },
  { key: "animations", label: "Animation", icon: <PlayCircle className="h-3.5 w-3.5" /> },
];

// ─────────────────────────────────────────────────────────────────────────────
// Shared form primitives
// ─────────────────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-medium text-[var(--text-2)] uppercase tracking-wide mb-1">
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--tenant-primary)] ${className}`}
    />
  );
}

function SelectInput({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && <Label>{label}</Label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--tenant-primary)]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab panels
// ─────────────────────────────────────────────────────────────────────────────

// --- Typography ---

type TypographyKey = "h1" | "h2" | "h3" | "body" | "small" | "quote";

const TYPOGRAPHY_KEYS: { key: TypographyKey; label: string }[] = [
  { key: "h1", label: "H1 — Hauptüberschrift" },
  { key: "h2", label: "H2 — Abschnittsüberschrift" },
  { key: "h3", label: "H3 — Unterüberschrift" },
  { key: "body", label: "Body — Fließtext" },
  { key: "small", label: "Small — Kleintext" },
  { key: "quote", label: "Zitat" },
];

function TypographyTokenEditor({
  label,
  token,
  onChange,
}: {
  label: string;
  token: TypographyToken;
  onChange: (v: TypographyToken) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between bg-[var(--surface)] px-4 py-3 text-left text-[13px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors"
      >
        <span className="flex items-center gap-3">
          <span
            style={{
              fontFamily: token.fontFamily,
              fontSize: Math.min(parseFloat(token.fontSize ?? "1") * 14, 20) + "px",
              fontWeight: token.fontWeight,
            }}
          >
            {label.split(" — ")[0]}
          </span>
          <span className="text-[11px] text-[var(--muted)]">{token.fontSize} / {token.fontWeight}</span>
        </span>
        <ChevronRight
          className={`h-3.5 w-3.5 text-[var(--muted)] transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>
      {expanded && (
        <div className="grid grid-cols-2 gap-3 border-t border-[var(--border)] bg-[var(--surface-2)] p-4">
          <FieldRow label="Schriftgröße">
            <TextInput value={token.fontSize ?? ""} onChange={(v) => onChange({ ...token, fontSize: v })} placeholder="1rem" />
          </FieldRow>
          <FieldRow label="Zeilenhöhe">
            <TextInput value={token.lineHeight ?? ""} onChange={(v) => onChange({ ...token, lineHeight: v })} placeholder="1.5" />
          </FieldRow>
          <FieldRow label="Schriftstärke">
            <TextInput value={token.fontWeight ?? ""} onChange={(v) => onChange({ ...token, fontWeight: v })} placeholder="400" />
          </FieldRow>
          <FieldRow label="Buchstabenabstand">
            <TextInput value={token.letterSpacing ?? ""} onChange={(v) => onChange({ ...token, letterSpacing: v })} placeholder="0em" />
          </FieldRow>
          <FieldRow label="Schriftfamilie">
            <TextInput value={token.fontFamily ?? ""} onChange={(v) => onChange({ ...token, fontFamily: v })} placeholder="inherit" />
          </FieldRow>
          <SelectInput
            label="Transformation"
            value={token.textTransform ?? "none"}
            onChange={(v) => onChange({ ...token, textTransform: v as TypographyToken["textTransform"] })}
            options={[
              { value: "none", label: "Keine" },
              { value: "uppercase", label: "GROSSBUCHSTABEN" },
              { value: "lowercase", label: "kleinbuchstaben" },
              { value: "capitalize", label: "Erster Buchstabe Gross" },
            ]}
          />
        </div>
      )}
    </div>
  );
}

function TypographyPanel({
  ds,
  onChange,
}: {
  ds: ResolvedDesignSystem;
  onChange: (update: Partial<TenantDesignSystem>) => void;
}) {
  return (
    <div className="space-y-2">
      <div
        className="rounded-xl border border-[var(--border)] bg-white p-5 mb-4"
      >
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-3">
          Vorschau
        </p>
        <h1
          style={{
            fontSize: ds.typography.h1.fontSize,
            lineHeight: ds.typography.h1.lineHeight,
            fontWeight: ds.typography.h1.fontWeight,
            letterSpacing: ds.typography.h1.letterSpacing,
            color: ds.colors.primary,
          }}
          className="mb-1"
        >
          FC Allschwil
        </h1>
        <h2
          style={{
            fontSize: ds.typography.h2.fontSize,
            lineHeight: ds.typography.h2.lineHeight,
            fontWeight: ds.typography.h2.fontWeight,
          }}
          className="mb-1 text-gray-800"
        >
          Gemeinsam stark
        </h2>
        <h3
          style={{
            fontSize: ds.typography.h3.fontSize,
            lineHeight: ds.typography.h3.lineHeight,
            fontWeight: ds.typography.h3.fontWeight,
          }}
          className="mb-2 text-gray-700"
        >
          Die beste Mannschaft im Kanton
        </h3>
        <p
          style={{
            fontSize: ds.typography.body.fontSize,
            lineHeight: ds.typography.body.lineHeight,
          }}
          className="mb-1 text-gray-600 max-w-lg"
        >
          Wir sind ein Verein mit Leidenschaft für den Fussball und für unsere Gemeinschaft.
        </p>
        <blockquote
          style={{
            fontSize: ds.typography.quote.fontSize,
            lineHeight: ds.typography.quote.lineHeight,
            fontWeight: ds.typography.quote.fontWeight,
            borderLeftColor: ds.colors.primary,
          }}
          className="border-l-4 pl-4 italic text-gray-500 mt-3"
        >
          &bdquo;Sport verbindet Menschen.&ldquo;
        </blockquote>
      </div>

      {TYPOGRAPHY_KEYS.map(({ key, label }) => (
        <TypographyTokenEditor
          key={key}
          label={label}
          token={ds.typography[key]}
          onChange={(v) =>
            onChange({ typography: { ...ds.typography, [key]: v } })
          }
        />
      ))}
    </div>
  );
}

// --- Colors ---

const COLOR_TOKENS: { key: keyof ResolvedDesignSystem["colors"]; label: string; note?: string }[] = [
  { key: "primary", label: "Primärfarbe", note: "Aus Branding" },
  { key: "secondary", label: "Sekundärfarbe", note: "Aus Branding" },
  { key: "accent", label: "Akzentfarbe" },
  { key: "success", label: "Erfolg (Grün)" },
  { key: "warning", label: "Warnung (Gelb)" },
  { key: "danger", label: "Gefahr (Rot)" },
  { key: "neutral", label: "Neutral (Grau)" },
];

function ColorsPanel({
  ds,
  onChange,
}: {
  ds: ResolvedDesignSystem;
  onChange: (update: Partial<TenantDesignSystem>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border)] bg-white p-4 mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-3">
          Palette
        </p>
        <div className="flex flex-wrap gap-2">
          {COLOR_TOKENS.map(({ key, label }) => (
            <div key={key} className="flex flex-col items-center gap-1">
              <div
                className="h-10 w-16 rounded-lg border border-[var(--border)] shadow-sm"
                style={{ backgroundColor: ds.colors[key] }}
                title={ds.colors[key]}
              />
              <span className="text-[10px] text-[var(--muted)]">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
        <strong>Hinweis:</strong> Primär- und Sekundärfarbe werden aus dem bestehenden Branding-System übernommen.
        Sie können unter{" "}
        <a href="/dashboard/admin/branding" className="underline">
          Branding
        </a>{" "}
        geändert werden.
      </div>

      <div className="grid grid-cols-1 gap-3">
        {COLOR_TOKENS.map(({ key, label, note }) => (
          <div key={key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <Label>{label}</Label>
              {note && (
                <span className="text-[10px] text-[var(--muted)] italic">{note}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={ds.colors[key]}
                disabled={key === "primary" || key === "secondary"}
                onChange={(e) =>
                  onChange({ colors: { ...ds.colors, [key]: e.target.value } })
                }
                className="h-8 w-8 cursor-pointer rounded border border-[var(--border)] p-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <input
                type="text"
                value={ds.colors[key]}
                disabled={key === "primary" || key === "secondary"}
                onChange={(e) =>
                  onChange({ colors: { ...ds.colors, [key]: e.target.value } })
                }
                className="flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-[var(--tenant-primary)]"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Buttons ---

type ButtonVariantKey = keyof ResolvedDesignSystem["buttons"];

const BUTTON_VARIANTS: { key: ButtonVariantKey; label: string }[] = [
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "outline", label: "Outline" },
  { key: "ghost", label: "Ghost" },
  { key: "rounded", label: "Rounded" },
  { key: "square", label: "Square" },
];

function ButtonTokenEditor({
  label,
  token,
  onChange,
}: {
  label: string;
  token: ButtonTokenStyle;
  onChange: (v: ButtonTokenStyle) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between bg-[var(--surface)] px-4 py-3 text-left text-[13px] font-medium hover:bg-[var(--surface-2)] transition-colors"
      >
        <span className="flex items-center gap-3">
          <span
            style={{
              background: token.background,
              color: token.color,
              border: token.border,
              borderRadius: token.borderRadius,
              padding: `${token.paddingY} ${token.paddingX}`,
              fontSize: "11px",
              fontWeight: token.fontWeight ?? "600",
              display: "inline-block",
              lineHeight: 1,
            }}
          >
            {label}
          </span>
        </span>
        <ChevronRight
          className={`h-3.5 w-3.5 text-[var(--muted)] transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>
      {expanded && (
        <div className="grid grid-cols-2 gap-3 border-t border-[var(--border)] bg-[var(--surface-2)] p-4">
          <div className="flex flex-col gap-1">
            <Label>Hintergrund</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={token.background} onChange={(e) => onChange({ ...token, background: e.target.value })} className="h-8 w-8 cursor-pointer rounded border border-[var(--border)] p-0.5" />
              <TextInput value={token.background} onChange={(v) => onChange({ ...token, background: v })} className="flex-1" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Textfarbe</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={token.color} onChange={(e) => onChange({ ...token, color: e.target.value })} className="h-8 w-8 cursor-pointer rounded border border-[var(--border)] p-0.5" />
              <TextInput value={token.color} onChange={(v) => onChange({ ...token, color: v })} className="flex-1" />
            </div>
          </div>
          <FieldRow label="Rahmen">
            <TextInput value={token.border} onChange={(v) => onChange({ ...token, border: v })} placeholder="2px solid transparent" />
          </FieldRow>
          <FieldRow label="Radius">
            <TextInput value={token.borderRadius} onChange={(v) => onChange({ ...token, borderRadius: v })} placeholder="0.5rem" />
          </FieldRow>
          <FieldRow label="Padding X">
            <TextInput value={token.paddingX} onChange={(v) => onChange({ ...token, paddingX: v })} placeholder="1.25rem" />
          </FieldRow>
          <FieldRow label="Padding Y">
            <TextInput value={token.paddingY} onChange={(v) => onChange({ ...token, paddingY: v })} placeholder="0.625rem" />
          </FieldRow>
        </div>
      )}
    </div>
  );
}

function ButtonsPanel({
  ds,
  onChange,
}: {
  ds: ResolvedDesignSystem;
  onChange: (update: Partial<TenantDesignSystem>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[var(--border)] bg-white p-4 mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-3">
          Vorschau
        </p>
        <div className="flex flex-wrap gap-3">
          {BUTTON_VARIANTS.map(({ key, label }) => {
            const t = ds.buttons[key];
            return (
              <button
                key={key}
                style={{
                  background: t.background,
                  color: t.color,
                  border: t.border,
                  borderRadius: t.borderRadius,
                  padding: `${t.paddingY} ${t.paddingX}`,
                  fontWeight: t.fontWeight ?? "600",
                  fontSize: "13px",
                  cursor: "default",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      {BUTTON_VARIANTS.map(({ key, label }) => (
        <ButtonTokenEditor
          key={key}
          label={label}
          token={ds.buttons[key]}
          onChange={(v) => onChange({ buttons: { ...ds.buttons, [key]: v } })}
        />
      ))}
    </div>
  );
}

// --- Cards ---

type CardVariantKey = keyof ResolvedDesignSystem["cards"];

const CARD_VARIANTS: { key: CardVariantKey; label: string; description: string }[] = [
  { key: "default", label: "Default", description: "Standard-Card mit Rahmen und leichtem Schatten" },
  { key: "soft", label: "Soft", description: "Helles Hintergrundgrau, kein Schatten" },
  { key: "elevated", label: "Elevated", description: "Starker Schatten, schwebend" },
  { key: "bordered", label: "Bordered", description: "Kräftiger Primärrahmen" },
  { key: "sponsor", label: "Sponsor", description: "Dezenter Sponsor-Stil" },
  { key: "highlight", label: "Highlight", description: "Primärfarbe als Hintergrund" },
];

function CardTokenEditor({
  label,
  description,
  token,
  onChange,
}: {
  label: string;
  description: string;
  token: CardTokenStyle;
  onChange: (v: CardTokenStyle) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between bg-[var(--surface)] px-4 py-3 text-left hover:bg-[var(--surface-2)] transition-colors"
      >
        <span className="flex items-center gap-3">
          <span
            style={{
              background: token.background,
              border: token.border,
              borderRadius: token.borderRadius,
              boxShadow: token.shadow,
              padding: "4px 10px",
              fontSize: "11px",
              color: label === "Highlight" ? "#fff" : "#374151",
              display: "inline-block",
            }}
          >
            {label}
          </span>
          <span className="text-[11px] text-[var(--muted)]">{description}</span>
        </span>
        <ChevronRight
          className={`h-3.5 w-3.5 text-[var(--muted)] transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>
      {expanded && (
        <div className="grid grid-cols-2 gap-3 border-t border-[var(--border)] bg-[var(--surface-2)] p-4">
          <div className="flex flex-col gap-1">
            <Label>Hintergrund</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={token.background} onChange={(e) => onChange({ ...token, background: e.target.value })} className="h-8 w-8 cursor-pointer rounded border border-[var(--border)] p-0.5" />
              <TextInput value={token.background} onChange={(v) => onChange({ ...token, background: v })} className="flex-1" />
            </div>
          </div>
          <FieldRow label="Rahmen">
            <TextInput value={token.border} onChange={(v) => onChange({ ...token, border: v })} />
          </FieldRow>
          <FieldRow label="Radius">
            <TextInput value={token.borderRadius} onChange={(v) => onChange({ ...token, borderRadius: v })} />
          </FieldRow>
          <FieldRow label="Schatten">
            <TextInput value={token.shadow} onChange={(v) => onChange({ ...token, shadow: v })} />
          </FieldRow>
          <FieldRow label="Padding">
            <TextInput value={token.padding} onChange={(v) => onChange({ ...token, padding: v })} />
          </FieldRow>
        </div>
      )}
    </div>
  );
}

function CardsPanel({
  ds,
  onChange,
}: {
  ds: ResolvedDesignSystem;
  onChange: (update: Partial<TenantDesignSystem>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[var(--border)] bg-white p-4 mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-3">
          Vorschau
        </p>
        <div className="grid grid-cols-3 gap-3">
          {CARD_VARIANTS.map(({ key, label }) => {
            const t = ds.cards[key];
            return (
              <div
                key={key}
                style={{
                  background: t.background,
                  border: t.border,
                  borderRadius: t.borderRadius,
                  boxShadow: t.shadow,
                  padding: t.padding,
                }}
              >
                <p
                  className="text-[12px] font-semibold"
                  style={{ color: key === "highlight" ? "#fff" : ds.colors.primary }}
                >
                  {label}
                </p>
                <p
                  className="text-[11px] mt-1"
                  style={{ color: key === "highlight" ? "rgba(255,255,255,0.8)" : "#6b7280" }}
                >
                  Beispiel-Card
                </p>
              </div>
            );
          })}
        </div>
      </div>
      {CARD_VARIANTS.map(({ key, label, description }) => (
        <CardTokenEditor
          key={key}
          label={label}
          description={description}
          token={ds.cards[key]}
          onChange={(v) => onChange({ cards: { ...ds.cards, [key]: v } })}
        />
      ))}
    </div>
  );
}

// --- Spacing ---

const SPACING_KEYS: { key: keyof ResolvedDesignSystem["spacing"]; label: string; desc: string }[] = [
  { key: "xs", label: "XS", desc: "Kleinstabstand" },
  { key: "sm", label: "S", desc: "Kleiner Abstand" },
  { key: "md", label: "M", desc: "Mittelabstand" },
  { key: "lg", label: "L", desc: "Großer Abstand" },
  { key: "xl", label: "XL", desc: "Sehr großer Abstand" },
  { key: "xxl", label: "XXL", desc: "Maximaler Abstand" },
];

function SpacingPanel({
  ds,
  onChange,
}: {
  ds: ResolvedDesignSystem;
  onChange: (update: Partial<TenantDesignSystem>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[var(--border)] bg-white p-4 mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-3">
          Skala
        </p>
        <div className="flex items-end gap-3">
          {SPACING_KEYS.map(({ key, label }) => (
            <div key={key} className="flex flex-col items-center gap-1">
              <div
                style={{
                  width: ds.spacing[key],
                  height: ds.spacing[key],
                  background: ds.colors.primary,
                  opacity: 0.7,
                  borderRadius: "2px",
                  minWidth: "4px",
                  minHeight: "4px",
                  maxWidth: "80px",
                  maxHeight: "80px",
                }}
              />
              <span className="text-[10px] text-[var(--muted)]">{label}</span>
              <span className="text-[9px] text-[var(--muted)]">{ds.spacing[key]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {SPACING_KEYS.map(({ key, label, desc }) => (
          <FieldRow key={key} label={`${label} — ${desc}`}>
            <TextInput
              value={ds.spacing[key]}
              onChange={(v) => onChange({ spacing: { ...ds.spacing, [key]: v } })}
              placeholder="1rem"
            />
          </FieldRow>
        ))}
      </div>
    </div>
  );
}

// --- Shadows ---

const SHADOW_KEYS: { key: keyof ResolvedDesignSystem["shadows"]; label: string }[] = [
  { key: "none", label: "Kein Schatten" },
  { key: "sm", label: "Kleiner Schatten" },
  { key: "md", label: "Mittlerer Schatten" },
  { key: "lg", label: "Großer Schatten" },
];

function ShadowsPanel({
  ds,
  onChange,
}: {
  ds: ResolvedDesignSystem;
  onChange: (update: Partial<TenantDesignSystem>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[var(--border)] bg-white p-4 mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-3">
          Vorschau
        </p>
        <div className="flex gap-6 items-center">
          {SHADOW_KEYS.map(({ key, label }) => (
            <div key={key} className="flex flex-col items-center gap-2">
              <div
                style={{ boxShadow: ds.shadows[key] }}
                className="h-12 w-16 rounded-lg bg-white border border-gray-100"
              />
              <span className="text-[10px] text-[var(--muted)]">{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {SHADOW_KEYS.map(({ key, label }) => (
          <FieldRow key={key} label={label}>
            <TextInput
              value={ds.shadows[key]}
              onChange={(v) => onChange({ shadows: { ...ds.shadows, [key]: v } })}
              placeholder="none"
            />
          </FieldRow>
        ))}
      </div>
    </div>
  );
}

// --- Radius ---

const RADIUS_KEYS: { key: keyof ResolvedDesignSystem["radius"]; label: string }[] = [
  { key: "sm", label: "Klein" },
  { key: "md", label: "Mittel" },
  { key: "lg", label: "Groß" },
  { key: "xl", label: "Extra Groß" },
];

function RadiusPanel({
  ds,
  onChange,
}: {
  ds: ResolvedDesignSystem;
  onChange: (update: Partial<TenantDesignSystem>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[var(--border)] bg-white p-4 mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-3">
          Vorschau
        </p>
        <div className="flex gap-4 items-center">
          {RADIUS_KEYS.map(({ key, label }) => (
            <div key={key} className="flex flex-col items-center gap-2">
              <div
                style={{
                  borderRadius: ds.radius[key],
                  background: ds.colors.primary,
                  opacity: 0.8,
                }}
                className="h-10 w-16"
              />
              <span className="text-[10px] text-[var(--muted)]">{label}</span>
              <span className="text-[9px] text-[var(--muted)]">{ds.radius[key]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {RADIUS_KEYS.map(({ key, label }) => (
          <FieldRow key={key} label={label}>
            <TextInput
              value={ds.radius[key]}
              onChange={(v) => onChange({ radius: { ...ds.radius, [key]: v } })}
              placeholder="0.5rem"
            />
          </FieldRow>
        ))}
      </div>
    </div>
  );
}

// --- Section Widths ---

const WIDTH_KEYS: { key: keyof ResolvedDesignSystem["sectionWidths"]; label: string; desc: string }[] = [
  { key: "narrow", label: "Schmal", desc: "Fokussierter Inhalt" },
  { key: "normal", label: "Normal", desc: "Standard-Sektionsbreite" },
  { key: "wide", label: "Breit", desc: "Erweiterter Inhaltsbereich" },
  { key: "full", label: "Voll", desc: "Volle Bildschirmbreite" },
];

function SectionWidthsPanel({
  ds,
  onChange,
}: {
  ds: ResolvedDesignSystem;
  onChange: (update: Partial<TenantDesignSystem>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[var(--border)] bg-white p-4 mb-2 overflow-hidden">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-3">
          Vorschau
        </p>
        <div className="space-y-2">
          {WIDTH_KEYS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-[10px] text-[var(--muted)] w-14 shrink-0">{label}</span>
              <div
                style={{
                  maxWidth: ds.sectionWidths[key] === "none" ? "100%" : ds.sectionWidths[key],
                  width: "100%",
                  height: "8px",
                  background: ds.colors.primary,
                  opacity: 0.6,
                  borderRadius: "2px",
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {WIDTH_KEYS.map(({ key, label, desc }) => (
          <FieldRow key={key} label={`${label} — ${desc}`}>
            <TextInput
              value={ds.sectionWidths[key]}
              onChange={(v) => onChange({ sectionWidths: { ...ds.sectionWidths, [key]: v } })}
              placeholder="72rem"
            />
          </FieldRow>
        ))}
      </div>
    </div>
  );
}

// --- Animations ---

function AnimationsPanel({
  ds,
  onChange,
}: {
  ds: ResolvedDesignSystem;
  onChange: (update: Partial<TenantDesignSystem>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
        <strong>Future-ready:</strong> Die Animation-Einstellung wird gespeichert und steht für spätere Template-Systeme bereit.
        Die Animation-Runtime ist noch nicht implementiert.
      </div>
      <SelectInput
        label="Standard-Animation"
        value={ds.animations.default}
        onChange={(v) =>
          onChange({
            animations: { ...ds.animations, default: v as ResolvedDesignSystem["animations"]["default"] },
          })
        }
        options={[
          { value: "none", label: "Keine Animation" },
          { value: "fade", label: "Fade — Einblenden" },
          { value: "slide", label: "Slide — Einfahren" },
          { value: "zoom", label: "Zoom — Einzoomen" },
        ]}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Manager component
// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  initialDesignSystem: ResolvedDesignSystem;
  hasCustomConfig: boolean;
};

export default function DesignSystemManager({ initialDesignSystem, hasCustomConfig }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("typography");
  const [ds, setDs] = useState<ResolvedDesignSystem>(initialDesignSystem);
  const [isDirty, setIsDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleChange = useCallback((update: Partial<TenantDesignSystem>) => {
    setDs((prev) => ({
      ...prev,
      ...(update.typography ? { typography: { ...prev.typography, ...update.typography } } : {}),
      ...(update.colors ? { colors: { ...prev.colors, ...update.colors } } : {}),
      ...(update.buttons ? { buttons: { ...prev.buttons, ...update.buttons } } : {}),
      ...(update.cards ? { cards: { ...prev.cards, ...update.cards } } : {}),
      ...(update.spacing ? { spacing: { ...prev.spacing, ...update.spacing } } : {}),
      ...(update.shadows ? { shadows: { ...prev.shadows, ...update.shadows } } : {}),
      ...(update.radius ? { radius: { ...prev.radius, ...update.radius } } : {}),
      ...(update.sectionWidths ? { sectionWidths: { ...prev.sectionWidths, ...update.sectionWidths } } : {}),
      ...(update.animations ? { animations: { ...prev.animations, ...update.animations } } : {}),
    }));
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(() => {
    startTransition(async () => {
      setSaveState("saving");
      setErrorMsg(null);
      try {
        const res = await fetch("/api/website-design-system", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ds),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? "Speichern fehlgeschlagen.");
        }
        setDs(data.designSystem);
        setIsDirty(false);
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2500);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Unbekannter Fehler.");
        setSaveState("error");
      }
    });
  }, [ds]);

  const handleReset = useCallback(() => {
    if (!confirm("Design System auf Plattform-Defaults zurücksetzen? Alle Anpassungen werden verworfen.")) return;
    startTransition(async () => {
      setSaveState("saving");
      try {
        const res = await fetch("/api/website-design-system", { method: "DELETE" });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Reset fehlgeschlagen.");
        setDs(data.designSystem);
        setIsDirty(false);
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2500);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Unbekannter Fehler.");
        setSaveState("error");
      }
    });
  }, []);

  const isSaving = saveState === "saving" || isPending;

  return (
    <div className="flex gap-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden min-h-[600px]">
      {/* ── Left: Tab navigation ──────────────────────────────────────────── */}
      <nav className="w-44 shrink-0 border-r border-[var(--border)] bg-[var(--surface-2)] py-3">
        <p className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">
          Design Token
        </p>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex w-full items-center gap-2.5 px-4 py-2 text-[13px] transition-colors text-left ${
              activeTab === tab.key
                ? "bg-[var(--surface)] font-semibold text-[var(--foreground)] border-r-2"
                : "text-[var(--text-2)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
            }`}
            style={activeTab === tab.key ? { borderRightColor: "var(--tenant-primary)" } : undefined}
          >
            <span className="shrink-0">{tab.icon}</span>
            {tab.label}
          </button>
        ))}

        {/* Spacer + status */}
        <div className="mt-auto pt-6 px-4">
          {hasCustomConfig && (
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 mb-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Angepasst
            </div>
          )}
          {!hasCustomConfig && (
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted)] mb-2">
              <div className="h-1.5 w-1.5 rounded-full bg-gray-300" />
              Standard
            </div>
          )}
        </div>
      </nav>

      {/* ── Right: Active panel ───────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              {TABS.find((t) => t.key === activeTab)?.label}
            </h2>
            {isDirty && (
              <p className="text-[11px] text-amber-600 mt-0.5">Ungespeicherte Änderungen</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {saveState === "saved" && (
              <span className="flex items-center gap-1 text-[12px] text-emerald-600">
                <Check className="h-3.5 w-3.5" />
                Gespeichert
              </span>
            )}
            {saveState === "error" && errorMsg && (
              <span className="flex items-center gap-1 text-[12px] text-red-600">
                <AlertCircle className="h-3.5 w-3.5" />
                {errorMsg}
              </span>
            )}
            <button
              onClick={handleReset}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] disabled:opacity-50 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Zurücksetzen
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50 transition-colors"
              style={{ background: "var(--tenant-primary)" }}
            >
              <Save className="h-3 w-3" />
              {isSaving ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "typography" && (
            <TypographyPanel ds={ds} onChange={handleChange} />
          )}
          {activeTab === "colors" && (
            <ColorsPanel ds={ds} onChange={handleChange} />
          )}
          {activeTab === "buttons" && (
            <ButtonsPanel ds={ds} onChange={handleChange} />
          )}
          {activeTab === "cards" && (
            <CardsPanel ds={ds} onChange={handleChange} />
          )}
          {activeTab === "spacing" && (
            <SpacingPanel ds={ds} onChange={handleChange} />
          )}
          {activeTab === "shadows" && (
            <ShadowsPanel ds={ds} onChange={handleChange} />
          )}
          {activeTab === "radius" && (
            <RadiusPanel ds={ds} onChange={handleChange} />
          )}
          {activeTab === "sectionWidths" && (
            <SectionWidthsPanel ds={ds} onChange={handleChange} />
          )}
          {activeTab === "animations" && (
            <AnimationsPanel ds={ds} onChange={handleChange} />
          )}
        </div>
      </div>
    </div>
  );
}
