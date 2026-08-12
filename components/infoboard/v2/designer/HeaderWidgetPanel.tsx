"use client";

/**
 * components/infoboard/v2/designer/HeaderWidgetPanel.tsx
 *
 * Settings panel for the HEADER widget in the Infoboard Designer.
 * Controls club identity display, subtitle, time, and date.
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
      <div>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)] mb-3">
          Vereinsidentität
        </p>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2.5">
          <p className="text-[0.82rem] font-semibold text-[var(--foreground)]">{tenantName}</p>
          <p className="mt-0.5 text-[0.72rem] text-[var(--muted)]">Vereinsname und Logo (aus Mandanteneinstellungen)</p>
        </div>
      </div>

      <div>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)] mb-3">
          Untertitel
        </p>
        <div className="space-y-2.5">
          <Toggle
            label="Untertitel anzeigen"
            checked={settings.subtitleEnabled}
            onChange={(v) => update({ subtitleEnabled: v })}
          />
          {settings.subtitleEnabled && (
            <div className="pl-11">
              <input
                type="text"
                value={settings.subtitleText ?? ""}
                onChange={(e) =>
                  update({ subtitleText: e.target.value || null })
                }
                placeholder="HEUTE AUF DER SPORTANLAGE"
                maxLength={200}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[0.82rem] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--sce-primary)]"
              />
              <p className="mt-1 text-[0.68rem] text-[var(--muted)]">
                Leer lassen für Standardtext.
              </p>
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)] mb-3">
          Zeit und Datum
        </p>
        <div className="space-y-2.5">
          <Toggle
            label="Uhrzeit anzeigen"
            checked={settings.showTime}
            onChange={(v) => update({ showTime: v })}
          />
          <Toggle
            label="Datum anzeigen"
            checked={settings.showDate}
            onChange={(v) => update({ showDate: v })}
          />
        </div>
      </div>

      <div>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)] mb-3">
          Wetter
        </p>
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2">
          <p className="text-[0.75rem] text-[var(--muted)]">Wetter wird in einer späteren Version verfügbar sein.</p>
        </div>
      </div>
    </div>
  );
}

// ── Toggle helper ─────────────────────────────────────────────────────────────

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
