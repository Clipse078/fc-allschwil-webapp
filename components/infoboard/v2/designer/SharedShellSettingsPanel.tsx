"use client";

/**
 * components/infoboard/v2/designer/SharedShellSettingsPanel.tsx
 *
 * Reusable panel for the shared per-board shell configuration.
 *
 * Covers KOPFZEILE (header) and HINWEISLEISTE (announcement) settings.
 * Used by both the TAGESUEBERSICHT designer (InboardDesignerClient) and the
 * ANLAGENUEBERSICHT designer (AnlageplanDesignerClient), and any future
 * board type that adds new screen variants.
 *
 * The same Toggle component pattern matches HeaderWidgetPanel and
 * AnnouncementWidgetPanel so the visual language is identical across all
 * designer surfaces.
 *
 * Design invariants:
 *   - Pure controlled component: all values passed as props, all changes
 *     reported via onChange.
 *   - No direct DB access, no fetch calls.
 *   - Canonical SwitchToggle for all boolean settings.
 */

import { AnnouncementTicker } from "@/components/infoboard/screen1/AnnouncementTicker";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SharedShellSettingsValues = {
  headerSubtitleEnabled: boolean;
  headerSubtitleText: string | null;
  headerShowTime: boolean;
  headerShowDate: boolean;
  headerShowWeather: boolean;
  announcementEnabled: boolean;
  announcementText: string | null;
  announcementBgColor: string | null;
  announcementTextColor: string | null;
};

type SharedShellSettingsPanelProps = {
  values: SharedShellSettingsValues;
  tenantName: string;
  onChange: (values: SharedShellSettingsValues) => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function SharedShellSettingsPanel({
  values,
  tenantName,
  onChange,
}: SharedShellSettingsPanelProps) {
  function update(partial: Partial<SharedShellSettingsValues>) {
    onChange({ ...values, ...partial });
  }

  const announcementText = values.announcementText ?? "";
  const bgColor = values.announcementBgColor ?? "#1e3a5f";
  const textColor = values.announcementTextColor ?? "#ffffff";

  return (
    <div className="space-y-5">

      {/* ── KOPFZEILE ─────────────────────────────────────────────────────── */}
      <section aria-labelledby="shell-section-header">
        <p
          id="shell-section-header"
          className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)] mb-2.5"
        >
          Kopfzeile
        </p>

        {/* Vereinsidentität: read-only summary */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2.5 mb-3">
          <p className="text-[0.82rem] font-semibold text-[var(--foreground)]">{tenantName}</p>
          <p className="mt-0.5 text-[0.72rem] text-[var(--muted)] leading-snug">
            Vereinsname und Logo aus den Mandanteneinstellungen.
          </p>
        </div>

        <div className="space-y-2.5">

          {/* Subtitle toggle + text */}
          <Toggle
            id="shell-subtitle-toggle"
            label="Untertitel anzeigen"
            checked={values.headerSubtitleEnabled}
            onChange={(v) => update({ headerSubtitleEnabled: v })}
          />
          {values.headerSubtitleEnabled && (
            <div className="pl-11">
              <label
                htmlFor="shell-subtitle-text"
                className="block text-[0.72rem] text-[var(--muted)] mb-1"
              >
                Untertitel-Text
              </label>
              <input
                id="shell-subtitle-text"
                type="text"
                value={values.headerSubtitleText ?? ""}
                onChange={(e) =>
                  update({ headerSubtitleText: e.target.value || null })
                }
                placeholder="z.B. SPORTANLAGE IM BRÜEL"
                maxLength={200}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[0.82rem] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--sce-primary)]"
                data-testid="shell-subtitle-text-input"
              />
              <p className="mt-1 text-[0.68rem] text-[var(--muted)]">
                Leer lassen für Standardtext.
              </p>
            </div>
          )}

          {/* Time / Date toggles */}
          <Toggle
            id="shell-show-time"
            label="Uhrzeit anzeigen"
            checked={values.headerShowTime}
            onChange={(v) => update({ headerShowTime: v })}
          />
          <Toggle
            id="shell-show-date"
            label="Datum anzeigen"
            checked={values.headerShowDate}
            onChange={(v) => update({ headerShowDate: v })}
          />
        </div>
      </section>

      {/* ── HINWEISLEISTE ─────────────────────────────────────────────────── */}
      <section aria-labelledby="shell-section-announcement">
        <p
          id="shell-section-announcement"
          className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)] mb-2.5"
        >
          Hinweisleiste
        </p>
        <div className="space-y-2.5">
          <Toggle
            id="shell-announcement-toggle"
            label="Hinweisleiste aktivieren"
            checked={values.announcementEnabled}
            onChange={(v) => update({ announcementEnabled: v })}
          />

          {values.announcementEnabled && (
            <div className="space-y-4">
              {/* Text */}
              <div>
                <label
                  htmlFor="shell-announcement-text"
                  className="block text-[0.72rem] text-[var(--muted)] mb-1"
                >
                  Text{" "}
                  <span className="text-red-500 font-normal">*</span>
                </label>
                <input
                  id="shell-announcement-text"
                  type="text"
                  value={announcementText}
                  onChange={(e) =>
                    update({ announcementText: e.target.value || null })
                  }
                  placeholder="z.B. Herzlich willkommen auf der Sportanlage"
                  maxLength={500}
                  aria-required="true"
                  className={`w-full rounded-[var(--radius-md)] border bg-[var(--surface)] px-3 py-2 text-[0.82rem] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--sce-primary)] ${
                    !announcementText.trim()
                      ? "border-amber-400"
                      : "border-[var(--border)]"
                  }`}
                  data-testid="shell-announcement-text-input"
                />
                {!announcementText.trim() && (
                  <p role="alert" className="mt-1 text-[0.7rem] text-amber-600">
                    Text ist erforderlich wenn die Hinweisleiste aktiv ist.
                  </p>
                )}
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-3">
                <ColorField
                  id="shell-ann-bg-color"
                  label="Hintergrund"
                  value={bgColor}
                  onChange={(v) => update({ announcementBgColor: v })}
                />
                <ColorField
                  id="shell-ann-text-color"
                  label="Textfarbe"
                  value={textColor}
                  onChange={(v) => update({ announcementTextColor: v })}
                />
              </div>

              {/* Live preview */}
              {announcementText.trim() && (
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)] mb-1.5">
                    Vorschau
                  </p>
                  <div
                    className="flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2.5 overflow-hidden"
                    style={{ backgroundColor: bgColor, color: textColor }}
                    aria-label="Vorschau der Hinweisleiste"
                    data-testid="shell-announcement-preview"
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
                      <AnnouncementTicker text={announcementText} />
                    </div>
                  </div>
                  <p className="mt-1 text-[0.68rem] text-[var(--muted)]">
                    Lange Texte scrollen automatisch auf dem Display.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ── Toggle ─────────────────────────────────────────────────────────────────────

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
