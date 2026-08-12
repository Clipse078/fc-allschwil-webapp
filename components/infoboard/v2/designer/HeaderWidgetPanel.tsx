"use client";

/**
 * components/infoboard/v2/designer/HeaderWidgetPanel.tsx
 *
 * Settings panel for the HEADER widget in the Infoboard Designer.
 *
 * Sections:
 *   Vereinsidentität — club name / logo summary (read-only, from tenant)
 *   Untertitel       — enable toggle + text input
 *   Zeit & Datum     — Uhrzeit / Datum toggles
 *   Wetter           — placeholder (deferred)
 */

import type { HeaderWidgetSettings } from "@/lib/infoboard/widget-types";

type HeaderWidgetPanelProps = {
  settings: HeaderWidgetSettings;
  tenantName: string;
  onChange: (settings: HeaderWidgetSettings) => void;
};

export function HeaderWidgetPanel({
  settings,
  tenantName,
  onChange,
}: HeaderWidgetPanelProps) {
  function update(partial: Partial<HeaderWidgetSettings>) {
    onChange({ ...settings, ...partial });
  }

  return (
    <div className="space-y-5">

      {/* ── Vereinsidentität ─────────────────────────────────────────────── */}
      <section aria-labelledby="header-section-identity">
        <p
          id="header-section-identity"
          className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)] mb-2.5"
        >
          Vereinsidentität
        </p>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2.5">
          <p className="text-[0.82rem] font-semibold text-[var(--foreground)]">{tenantName}</p>
          <p className="mt-0.5 text-[0.72rem] text-[var(--muted)] leading-snug">
            Vereinsname und Logo aus den Mandanteneinstellungen.
          </p>
        </div>
      </section>

      {/* ── Untertitel ───────────────────────────────────────────────────── */}
      <section aria-labelledby="header-section-subtitle">
        <p
          id="header-section-subtitle"
          className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)] mb-2.5"
        >
          Untertitel
        </p>
        <div className="space-y-2.5">
          <Toggle
            id="header-subtitle-toggle"
            label="Untertitel anzeigen"
            checked={settings.subtitleEnabled}
            onChange={(v) => update({ subtitleEnabled: v })}
          />
          {settings.subtitleEnabled && (
            <div className="pl-11">
              <label
                htmlFor="header-subtitle-text"
                className="block text-[0.72rem] text-[var(--muted)] mb-1"
              >
                Text
              </label>
              <input
                id="header-subtitle-text"
                type="text"
                value={settings.subtitleText ?? ""}
                onChange={(e) =>
                  update({ subtitleText: e.target.value || null })
                }
                placeholder="HEUTE AUF DER SPORTANLAGE"
                maxLength={200}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[0.82rem] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--sce-primary)]"
                aria-describedby="header-subtitle-hint"
              />
              <p id="header-subtitle-hint" className="mt-1 text-[0.68rem] text-[var(--muted)]">
                Leer lassen für Standardtext.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Zeit & Datum ─────────────────────────────────────────────────── */}
      <section aria-labelledby="header-section-time">
        <p
          id="header-section-time"
          className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)] mb-2.5"
        >
          Zeit &amp; Datum
        </p>
        <div className="space-y-2.5">
          <Toggle
            id="header-show-time"
            label="Uhrzeit anzeigen"
            checked={settings.showTime}
            onChange={(v) => update({ showTime: v })}
          />
          <Toggle
            id="header-show-date"
            label="Datum anzeigen"
            checked={settings.showDate}
            onChange={(v) => update({ showDate: v })}
          />
        </div>
      </section>

      {/* ── Wetter (deferred) ────────────────────────────────────────────── */}
      <section aria-labelledby="header-section-weather">
        <p
          id="header-section-weather"
          className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)] mb-2.5"
        >
          Wetter
        </p>
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface-3)] px-3 py-2">
          <p className="text-[0.74rem] text-[var(--muted)]">
            Wetter-Widget folgt in einer späteren Version.
          </p>
        </div>
      </section>

    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

/**
 * Accessible toggle switch.
 * Uses a visually-hidden <input type="checkbox"> for keyboard/screen-reader
 * support, wrapped in a <label> for click targeting.
 */
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
