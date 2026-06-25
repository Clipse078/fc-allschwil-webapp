"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export type WebsiteSettingsValues = {
  approvedDataOnly: boolean;
  websiteEnabled: boolean;
  websiteBaseUrl: string;
  websitePrimaryLanguage: string;
  websitePublishMode: "DRAFT" | "STAGED" | "LIVE";
  websiteCacheStrategy: string;
};

type WebsiteSettingsFormProps = {
  defaultValues: WebsiteSettingsValues;
};

const PUBLISH_MODES: { value: "DRAFT" | "STAGED" | "LIVE"; label: string; description: string }[] = [
  {
    value: "DRAFT",
    label: "Entwurf",
    description: "Website-Inhalte sind noch nicht öffentlich.",
  },
  {
    value: "STAGED",
    label: "Staged",
    description: "Inhalte sind bereit für Staging-Review, aber noch nicht vollständig live.",
  },
  {
    value: "LIVE",
    label: "Live",
    description: "Website ist vollständig live für alle Besucher.",
  },
];

const CACHE_STRATEGIES: { value: string; label: string }[] = [
  { value: "", label: "Nicht konfiguriert" },
  { value: "ISR", label: "ISR (Incremental Static Regeneration)" },
  { value: "on-demand", label: "On-demand Revalidierung" },
  { value: "disabled", label: "Kein Caching" },
];

export default function WebsiteSettingsForm({ defaultValues }: WebsiteSettingsFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<WebsiteSettingsValues>(defaultValues);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  function updateField<K extends keyof WebsiteSettingsValues>(
    field: K,
    value: WebsiteSettingsValues[K],
  ) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setSaveSuccess(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);
    setSaving(true);

    try {
      const body: Record<string, unknown> = {
        approvedDataOnly: values.approvedDataOnly,
        websiteEnabled: values.websiteEnabled,
        websitePublishMode: values.websitePublishMode,
        websiteBaseUrl: values.websiteBaseUrl.trim() || null,
        websitePrimaryLanguage: values.websitePrimaryLanguage.trim() || null,
        websiteCacheStrategy: values.websiteCacheStrategy || null,
      };

      const res = await fetch("/api/website-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data?.error ?? "Fehler beim Speichern.");
        return;
      }
      setSaveSuccess(true);
      router.refresh();
    } catch {
      setSaveError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-8">

      {/* ── Website activation ───────────────────────────────────────────── */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            Website-Status
          </p>
        </div>
        <div className="sce-detail-section-body space-y-4">
          <div className="flex items-start gap-4">
            <button
              id="websiteEnabled"
              type="button"
              role="switch"
              aria-checked={values.websiteEnabled}
              onClick={() => updateField("websiteEnabled", !values.websiteEnabled)}
              className={[
                "relative mt-0.5 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2",
                values.websiteEnabled ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]",
              ].join(" ")}
            >
              <span
                aria-hidden="true"
                className={[
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                  values.websiteEnabled ? "translate-x-5" : "translate-x-0",
                ].join(" ")}
              />
            </button>
            <div>
              <label
                htmlFor="websiteEnabled"
                className="cursor-pointer text-sm font-medium text-[var(--text-1)]"
              >
                Website aktiviert
              </label>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Wenn deaktiviert, sind alle öffentlichen API-Endpunkte für diesen Mandanten gesperrt.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Publish mode ─────────────────────────────────────────────────── */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            Publish-Modus
          </p>
        </div>
        <div className="sce-detail-section-body">
          <div className="space-y-2">
            {PUBLISH_MODES.map((mode) => (
              <label
                key={mode.value}
                className={[
                  "flex cursor-pointer items-start gap-3 rounded-[var(--radius-lg)] border p-3 transition",
                  values.websitePublishMode === mode.value
                    ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                    : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-strong)]",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="websitePublishMode"
                  value={mode.value}
                  checked={values.websitePublishMode === mode.value}
                  onChange={() => updateField("websitePublishMode", mode.value)}
                  className="mt-0.5 shrink-0 accent-[var(--accent)]"
                />
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">{mode.label}</p>
                  <p className="text-xs text-[var(--muted)]">{mode.description}</p>
                </div>
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">
            TODO: Vollständiger Vier-Augen-Freigabe-Workflow (Phase 4) — aktuell manuelles Umschalten.
          </p>
        </div>
      </div>

      {/* ── Website URL & language ────────────────────────────────────────── */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            Basis-Konfiguration
          </p>
        </div>
        <div className="sce-detail-section-body space-y-4">
          <div>
            <label
              htmlFor="websiteBaseUrl"
              className="block text-sm font-medium text-[var(--text-1)] mb-1"
            >
              Basis-URL
            </label>
            <input
              id="websiteBaseUrl"
              type="url"
              value={values.websiteBaseUrl}
              onChange={(e) => updateField("websiteBaseUrl", e.target.value)}
              placeholder="https://fc-meinverein.ch"
              className="w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              Die öffentliche URL der Club-Website (ohne abschließenden Schrägstrich).
            </p>
          </div>
          <div>
            <label
              htmlFor="websitePrimaryLanguage"
              className="block text-sm font-medium text-[var(--text-1)] mb-1"
            >
              Primärsprache
            </label>
            <input
              id="websitePrimaryLanguage"
              type="text"
              value={values.websitePrimaryLanguage}
              onChange={(e) => updateField("websitePrimaryLanguage", e.target.value)}
              placeholder="de"
              maxLength={10}
              className="w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              BCP 47 Sprach-Tag (z. B. de, fr, de-CH).
            </p>
          </div>
        </div>
      </div>

      {/* ── Cache strategy ────────────────────────────────────────────────── */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            Cache-Strategie
          </p>
        </div>
        <div className="sce-detail-section-body">
          <div>
            <label
              htmlFor="websiteCacheStrategy"
              className="block text-sm font-medium text-[var(--text-1)] mb-1"
            >
              Strategie
            </label>
            <select
              id="websiteCacheStrategy"
              value={values.websiteCacheStrategy}
              onChange={(e) => updateField("websiteCacheStrategy", e.target.value)}
              className="w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            >
              {CACHE_STRATEGIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Platzhalter — Cache-Integration wird in Phase 4 aktiviert.
              Die Auswahl wird für die Konfiguration der Website verwendet.
            </p>
          </div>
        </div>
      </div>

      {/* ── Editorial workflow ────────────────────────────────────────────── */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            Redaktioneller Workflow
          </p>
        </div>
        <div className="sce-detail-section-body space-y-4">
          <div className="flex items-start gap-4">
            <button
              id="approvedDataOnly"
              type="button"
              role="switch"
              aria-checked={values.approvedDataOnly}
              onClick={() => updateField("approvedDataOnly", !values.approvedDataOnly)}
              className={[
                "relative mt-0.5 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2",
                values.approvedDataOnly ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]",
              ].join(" ")}
            >
              <span
                aria-hidden="true"
                className={[
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                  values.approvedDataOnly ? "translate-x-5" : "translate-x-0",
                ].join(" ")}
              />
            </button>
            <div>
              <label
                htmlFor="approvedDataOnly"
                className="cursor-pointer text-sm font-medium text-[var(--text-1)]"
              >
                Vier-Augen-Prinzip aktivieren
              </label>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Wenn aktiviert, müssen News und Seiten zur Prüfung eingereicht werden,
                bevor sie veröffentlicht werden.
              </p>
            </div>
          </div>
        </div>
      </div>

      {saveError ? (
        <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {saveError}
        </div>
      ) : null}
      {saveSuccess ? (
        <div className="rounded-[var(--radius-xl)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          Einstellungen gespeichert.
        </div>
      ) : null}

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="fca-button-primary">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? "Speichern…" : "Einstellungen speichern"}
        </button>
      </div>
    </form>
  );
}
