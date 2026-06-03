"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { TenantConfig } from "@/lib/tenants/queries";

type Props = {
  tenantKey: string;
  defaultValues: TenantConfig;
};

const MONTH_OPTIONS = [
  { value: 1, label: "Januar" },
  { value: 2, label: "Februar" },
  { value: 3, label: "März" },
  { value: 4, label: "April" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Juni" },
  { value: 7, label: "Juli" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "Oktober" },
  { value: 11, label: "November" },
  { value: 12, label: "Dezember" },
] as const;

const SPORT_CATEGORY_OPTIONS = [
  { value: "", label: "— Nicht gewählt —" },
  { value: "FOOTBALL", label: "Fussball" },
  { value: "BASKETBALL", label: "Basketball" },
  { value: "VOLLEYBALL", label: "Volleyball" },
  { value: "HOCKEY", label: "Hockey" },
  { value: "HANDBALL", label: "Handball" },
  { value: "TENNIS", label: "Tennis" },
  { value: "OTHER", label: "Andere" },
] as const;

const LOCALE_OPTIONS = [
  { value: "", label: "— Nicht gewählt —" },
  { value: "de-CH", label: "Deutsch (Schweiz)" },
  { value: "de-DE", label: "Deutsch (Deutschland)" },
  { value: "de-AT", label: "Deutsch (Österreich)" },
  { value: "fr-CH", label: "Français (Suisse)" },
  { value: "it-CH", label: "Italiano (Svizzera)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "en-US", label: "English (US)" },
] as const;

const CURRENCY_OPTIONS = [
  { value: "", label: "— Nicht gewählt —" },
  { value: "CHF", label: "CHF — Schweizer Franken" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — Britisches Pfund" },
  { value: "USD", label: "USD — US-Dollar" },
] as const;

const TIMEZONE_OPTIONS = [
  { value: "", label: "— Nicht gewählt —" },
  { value: "Europe/Zurich", label: "Europe/Zurich (CET/CEST)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET/CEST)" },
  { value: "Europe/Vienna", label: "Europe/Vienna (CET/CEST)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET/CEST)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "UTC", label: "UTC" },
] as const;

export default function TenantConfigForm({ tenantKey, defaultValues }: Props) {
  // String fields: null → "" (form shows "not set" option); "" → sent as null to API.
  const [countryCode, setCountryCode] = useState(defaultValues.countryCode ?? "");
  const [sportCategory, setSportCategory] = useState(defaultValues.sportCategory ?? "");
  const [locale, setLocale] = useState(defaultValues.locale ?? "");
  const [timezone, setTimezone] = useState(defaultValues.timezone ?? "");
  const [currency, setCurrency] = useState(defaultValues.currency ?? "");
  // Season ints always present (NOT NULL in DB).
  const [seasonStartMonth, setSeasonStartMonth] = useState(defaultValues.seasonStartMonth);
  const [seasonTransitionDay, setSeasonTransitionDay] = useState(defaultValues.seasonTransitionDay);
  const [seasonTransitionMonth, setSeasonTransitionMonth] = useState(defaultValues.seasonTransitionMonth);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);

    try {
      const res = await fetch(`/api/tenants/${tenantKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Empty string → API treats as null (clear the field).
          countryCode: countryCode || null,
          sportCategory: sportCategory || null,
          locale: locale || null,
          timezone: timezone || null,
          currency: currency || null,
          seasonStartMonth,
          seasonTransitionDay,
          seasonTransitionMonth,
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

  const labelClass = "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5";
  const gridClass = "grid gap-5 sm:grid-cols-2";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="sce-detail-section">
        <div className="sce-detail-section-body space-y-6">

          {/* Region & Identity */}
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              Region & Identität
            </p>
            <div className={gridClass}>
              <div>
                <label htmlFor="cfg-country" className={labelClass}>Land</label>
                <input
                  id="cfg-country"
                  type="text"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="CH"
                  maxLength={2}
                  className="fca-input font-mono uppercase"
                />
                <p className="mt-1 text-[11px] text-[var(--muted)]">ISO 3166-1 alpha-2 (z.B. CH, DE, GB)</p>
              </div>

              <div>
                <label htmlFor="cfg-sport" className={labelClass}>Sportart</label>
                <select
                  id="cfg-sport"
                  value={sportCategory}
                  onChange={(e) => setSportCategory(e.target.value)}
                  className="fca-select"
                >
                  {SPORT_CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="cfg-locale" className={labelClass}>Sprache / Locale</label>
                <select
                  id="cfg-locale"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                  className="fca-select"
                >
                  {LOCALE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="cfg-timezone" className={labelClass}>Zeitzone</label>
                <select
                  id="cfg-timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="fca-select"
                >
                  {TIMEZONE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="cfg-currency" className={labelClass}>Währung</label>
                <select
                  id="cfg-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="fca-select"
                >
                  {CURRENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Season Transition */}
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              Saisonübergang
            </p>
            <div className={gridClass}>
              <div>
                <label htmlFor="cfg-season-start" className={labelClass}>Saisonbeginn (Monat)</label>
                <select
                  id="cfg-season-start"
                  value={seasonStartMonth}
                  onChange={(e) => setSeasonStartMonth(Number(e.target.value))}
                  className="fca-select"
                >
                  {MONTH_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="cfg-transition-month" className={labelClass}>Wechselmonat</label>
                <select
                  id="cfg-transition-month"
                  value={seasonTransitionMonth}
                  onChange={(e) => setSeasonTransitionMonth(Number(e.target.value))}
                  className="fca-select"
                >
                  {MONTH_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="cfg-transition-day" className={labelClass}>Wechseltag</label>
                <input
                  id="cfg-transition-day"
                  type="number"
                  min={1}
                  max={31}
                  value={seasonTransitionDay}
                  onChange={(e) => setSeasonTransitionDay(Number(e.target.value))}
                  className="fca-input"
                />
                <p className="mt-1 text-[11px] text-[var(--muted)]">
                  Tag im Wechselmonat (1–31)
                </p>
              </div>
            </div>
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
          Konfiguration gespeichert.
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="fca-button-primary"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Speichern…" : "Konfiguration speichern"}
        </button>
      </div>
    </form>
  );
}
