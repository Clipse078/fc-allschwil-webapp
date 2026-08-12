"use client";

/**
 * components/infoboard/v2/designer/AnnouncementWidgetPanel.tsx
 *
 * Settings panel for the ANNOUNCEMENT widget in the Infoboard Designer.
 *
 * Sections:
 *   Aktivierung — enable/disable toggle
 *   Inhalt      — text input (required when enabled)
 *   Darstellung — background + text color pickers
 *   Vorschau    — compact ticker preview (same renderer as kiosk)
 */

import { AnnouncementTicker } from "@/components/infoboard/screen1/AnnouncementTicker";
import type { AnnouncementWidgetSettings } from "@/lib/infoboard/widget-types";

type AnnouncementWidgetPanelProps = {
  enabled: boolean;
  settings: AnnouncementWidgetSettings;
  onEnabledChange: (enabled: boolean) => void;
  onSettingsChange: (settings: AnnouncementWidgetSettings) => void;
};

export function AnnouncementWidgetPanel({
  enabled,
  settings,
  onEnabledChange,
  onSettingsChange,
}: AnnouncementWidgetPanelProps) {
  const text = settings.text ?? "";
  const bgColor = settings.bgColor ?? "#1e3a5f";
  const textColor = settings.textColor ?? "#ffffff";

  function updateSettings(partial: Partial<AnnouncementWidgetSettings>) {
    onSettingsChange({ ...settings, ...partial });
  }

  return (
    <div className="space-y-5">

      {/* ── Aktivierung ──────────────────────────────────────────────────── */}
      <section aria-labelledby="ann-section-activation">
        <p
          id="ann-section-activation"
          className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)] mb-2.5"
        >
          Aktivierung
        </p>
        <Toggle
          id="ann-enabled-toggle"
          label="Hinweisleiste aktivieren"
          checked={enabled}
          onChange={onEnabledChange}
        />
      </section>

      {enabled && (
        <>
          {/* ── Inhalt ─────────────────────────────────────────────────── */}
          <section aria-labelledby="ann-section-content">
            <p
              id="ann-section-content"
              className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)] mb-2.5"
            >
              Inhalt{" "}
              <span className="text-red-500 font-normal normal-case tracking-normal">
                *
              </span>
            </p>
            <label htmlFor="ann-text-input" className="sr-only">
              Hinweistext
            </label>
            <input
              id="ann-text-input"
              type="text"
              value={text}
              onChange={(e) => updateSettings({ text: e.target.value || null })}
              placeholder="z.B. Platz 2 gesperrt – Ausweich auf Platz 3"
              maxLength={500}
              aria-required="true"
              aria-describedby={!text.trim() ? "ann-text-error" : undefined}
              className={`w-full rounded-[var(--radius-md)] border bg-[var(--surface)] px-3 py-2 text-[0.82rem] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--sce-primary)] ${
                !text.trim()
                  ? "border-amber-400"
                  : "border-[var(--border)]"
              }`}
            />
            {!text.trim() && (
              <p id="ann-text-error" role="alert" className="mt-1 text-[0.7rem] text-amber-600">
                Text ist erforderlich wenn die Hinweisleiste aktiv ist.
              </p>
            )}
          </section>

          {/* ── Darstellung ────────────────────────────────────────────── */}
          <section aria-labelledby="ann-section-colors">
            <p
              id="ann-section-colors"
              className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)] mb-2.5"
            >
              Darstellung
            </p>
            <div className="grid grid-cols-2 gap-3">
              <ColorField
                id="ann-bg-color"
                label="Hintergrund"
                value={bgColor}
                onChange={(v) => updateSettings({ bgColor: v })}
              />
              <ColorField
                id="ann-text-color"
                label="Textfarbe"
                value={textColor}
                onChange={(v) => updateSettings({ textColor: v })}
              />
            </div>
          </section>

          {/* ── Vorschau ───────────────────────────────────────────────── */}
          {text.trim() && (
            <section aria-labelledby="ann-section-preview">
              <p
                id="ann-section-preview"
                className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)] mb-2.5"
              >
                Vorschau
              </p>
              <div
                className="flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2.5 overflow-hidden"
                style={{ backgroundColor: bgColor, color: textColor }}
                aria-label="Vorschau der Hinweisleiste"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                >
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <AnnouncementTicker text={text} />
                </div>
              </div>
              <p className="mt-1 text-[0.68rem] text-[var(--muted)]">
                Lange Texte scrollen automatisch auf dem Display.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-3 cursor-pointer group">
      <div className="relative shrink-0">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          aria-hidden="true"
          className={`h-5 w-9 rounded-full transition-colors ${
            checked ? "bg-[var(--sce-primary)]" : "bg-[var(--border)]"
          }`}
        >
          <div
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
              checked ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </div>
      </div>
      <span className="text-[0.82rem] text-[var(--foreground)] select-none group-hover:text-[var(--sce-primary)] transition-colors">
        {label}
      </span>
    </label>
  );
}

// ── ColorField ────────────────────────────────────────────────────────────────

function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const colorPickerId = `${id}-picker`;
  return (
    <div>
      <label
        htmlFor={`${id}-text`}
        className="block text-[0.72rem] font-medium text-[var(--foreground)] mb-1.5"
      >
        {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="relative shrink-0">
          <input
            type="color"
            id={colorPickerId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
            aria-label={`${label} Farbauswahl`}
          />
          <label
            htmlFor={colorPickerId}
            className="block h-7 w-7 cursor-pointer rounded-md border-2 border-[var(--border)] shadow-sm hover:border-[var(--sce-primary)] transition-colors"
            style={{ backgroundColor: value }}
            aria-label={`${label} Farbauswahl öffnen`}
          />
        </div>
        <input
          id={`${id}-text`}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
          aria-label={`${label} Hex-Code`}
          className="flex-1 min-w-0 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[0.72rem] font-mono text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--sce-primary)]"
        />
      </div>
    </div>
  );
}
