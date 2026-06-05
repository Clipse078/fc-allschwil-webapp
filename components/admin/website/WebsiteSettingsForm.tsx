"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { WebsiteConfigSummary } from "@/lib/website/queries";

type Props = {
  defaultValues: WebsiteConfigSummary;
};

export default function WebsiteSettingsForm({ defaultValues }: Props) {
  const [websiteDomain, setWebsiteDomain] = useState(defaultValues.websiteDomain ?? "");
  const [websiteEnabled, setWebsiteEnabled] = useState(defaultValues.websiteEnabled);
  const [approvedDataOnly, setApprovedDataOnly] = useState(defaultValues.approvedDataOnly);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);

    try {
      const res = await fetch("/api/website/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteDomain: websiteDomain.trim() || null,
          websiteEnabled,
          approvedDataOnly,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Unbekannter Fehler.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  const labelClass =
    "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Website-Integration
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">
            Einstellungen für die öffentliche Website-Integration dieses Tenants.
          </p>
        </div>
        <div className="sce-detail-section-body space-y-6">
          {/* Domain */}
          <div>
            <label htmlFor="ws-domain" className={labelClass}>
              Öffentliche Domain
            </label>
            <input
              id="ws-domain"
              type="text"
              value={websiteDomain}
              onChange={(e) => setWebsiteDomain(e.target.value)}
              placeholder="www.fc-allschwil.ch"
              className="fca-input font-mono"
            />
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              Hostname ohne Protokoll (z.B. www.fc-allschwil.ch). Wird für künftige
              Tenant-Auflösung per Domain verwendet.
            </p>
          </div>

          {/* Toggles */}
          <div className="space-y-4">
            {/* Website enabled */}
            <label className="flex cursor-pointer items-start gap-3">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={websiteEnabled}
                  onChange={(e) => setWebsiteEnabled(e.target.checked)}
                  className="sr-only"
                  id="ws-enabled"
                />
                <div
                  className={`h-5 w-9 rounded-full border-2 transition-colors ${
                    websiteEnabled
                      ? "border-emerald-500 bg-emerald-500"
                      : "border-[var(--border-strong)] bg-[var(--surface-2)]"
                  }`}
                >
                  <div
                    className={`h-3.5 w-3.5 translate-y-[1px] rounded-full bg-white shadow transition-transform ${
                      websiteEnabled ? "translate-x-[18px]" : "translate-x-[1px]"
                    }`}
                  />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Website aktiviert
                </p>
                <p className="text-[11px] text-[var(--muted)]">
                  Master-Schalter für öffentliche Website-API-Feeds dieses Tenants. Wenn
                  deaktiviert, liefern alle öffentlichen Endpunkte leere Antworten.
                </p>
              </div>
            </label>

            {/* Approved data only */}
            <label className="flex cursor-pointer items-start gap-3">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={approvedDataOnly}
                  onChange={(e) => setApprovedDataOnly(e.target.checked)}
                  className="sr-only"
                  id="ws-approved-only"
                />
                <div
                  className={`h-5 w-9 rounded-full border-2 transition-colors ${
                    approvedDataOnly
                      ? "border-blue-500 bg-blue-500"
                      : "border-[var(--border-strong)] bg-[var(--surface-2)]"
                  }`}
                >
                  <div
                    className={`h-3.5 w-3.5 translate-y-[1px] rounded-full bg-white shadow transition-transform ${
                      approvedDataOnly ? "translate-x-[18px]" : "translate-x-[1px]"
                    }`}
                  />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Nur freigegebene Daten veröffentlichen
                </p>
                <p className="text-[11px] text-[var(--muted)]">
                  Wenn aktiv, werden über die öffentliche API nur Inhalte mit Status
                  APPROVED oder PUBLISHED ausgeliefert. Empfohlen für Produktions-Tenants.
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {saved && (
        <div className="rounded-[var(--radius-xl)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          Einstellungen gespeichert.
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={loading} className="fca-button-primary">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Speichern…" : "Einstellungen speichern"}
        </button>
      </div>
    </form>
  );
}
