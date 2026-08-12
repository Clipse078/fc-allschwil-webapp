"use client";

/**
 * components/infoboard/v2/designer/AnnouncementWidgetPanel.tsx
 *
 * Settings panel for the ANNOUNCEMENT widget in the Infoboard Designer.
 * Controls enable/disable, text, and colors.
 * Uses the same AnnouncementTicker rendering for live preview.
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
      <div>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)] mb-3">
          Aktivierung
        </p>
        <Toggle
          label="Hinweisleiste aktivieren"
          checked={enabled}
          onChange={onEnabledChange}
        />
      </div>

      {enabled && (
        <>
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)] mb-2">
              Text <span className="text-red-500 font-normal normal-case tracking-normal">*</span>
            </p>
            <input
              type="text"
              value={text}
              onChange={(e) => updateSettings({ text: e.target.value || null })}
              placeholder="z.B. Platz 2 gesperrt – Ausweich auf Platz 3"
              maxLength={500}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[0.82rem] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--sce-primary)]"
            />
            {!text.trim() && (
              <p className="mt-1 text-[0.7rem] text-amber-600">
                Text ist erforderlich wenn die Hinweisleiste aktiv ist.
              </p>
            )}
          </div>

          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)] mb-3">
              Farben
            </p>
            <div className="grid grid-cols-2 gap-3">
              <ColorField
                label="Hintergrund"
                value={bgColor}
                onChange={(v) => updateSettings({ bgColor: v })}
              />
              <ColorField
                label="Text"
                value={textColor}
                onChange={(v) => updateSettings({ textColor: v })}
              />
            </div>
          </div>

          {text.trim() && (
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)] mb-2">
                Vorschau
              </p>
              <div
                className="flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2.5 overflow-hidden"
                style={{ backgroundColor: bgColor, color: textColor }}
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
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div className="relative shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`h-5 w-9 rounded-full transition-colors ${
            checked ? "bg-[var(--sce-primary)]" : "bg-[var(--surface-3)] border border-[var(--border)]"
          }`}
        >
          <div
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              checked ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </div>
      </div>
      <span className="text-[0.82rem] text-[var(--foreground)]">{label}</span>
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const inputId = `ann-color-${label}`;
  return (
    <div>
      <label className="block text-[0.72rem] font-medium text-[var(--foreground)] mb-1.5">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
            id={inputId}
          />
          <label
            htmlFor={inputId}
            className="block h-7 w-7 cursor-pointer rounded-md border-2 border-[var(--border)] shadow-sm"
            style={{ backgroundColor: value }}
            aria-label={label}
          />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
          className="flex-1 min-w-0 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[0.72rem] font-mono text-[var(--foreground)]"
        />
      </div>
    </div>
  );
}
