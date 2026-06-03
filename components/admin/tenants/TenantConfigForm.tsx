"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import type { TenantConfig } from "@/lib/tenants/queries";
import { PLATFORM_BRANDING } from "@/lib/tenant-runtime/branding";
import {
  ALLOWED_LOGO_UPLOAD_MIME_TYPES,
  MAX_LOGO_FILE_SIZE_BYTES,
  validateLogoUploadFile,
} from "@/lib/assets/validation";

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
  // Branding v1 — Slice 10.6. Null → show platform default in picker but store null until explicitly changed.
  const [logoUrl, setLogoUrl] = useState(defaultValues.logoUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(
    defaultValues.primaryColor ?? PLATFORM_BRANDING.primaryColor,
  );
  const [secondaryColor, setSecondaryColor] = useState(
    defaultValues.secondaryColor ?? PLATFORM_BRANDING.secondaryColor,
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Logo upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

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
          // Branding — empty string → null (clear / use platform default)
          logoUrl: logoUrl || null,
          primaryColor: primaryColor || null,
          secondaryColor: secondaryColor || null,
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

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be re-selected after an error
    e.target.value = "";

    setUploadError(null);
    setUploadSuccess(false);

    // Client-side first-pass validation (reuses canonical helper)
    const validation = validateLogoUploadFile(file);
    if (!validation.ok) {
      setUploadError(validation.error);
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);

      const res = await fetch(`/api/tenants/${tenantKey}/logo`, {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setUploadError(data?.error ?? "Upload fehlgeschlagen.");
        return;
      }

      // Populate the logoUrl field with the returned CDN URL
      if (typeof data.logoUrl === "string") {
        setLogoUrl(data.logoUrl);
      }
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch {
      setUploadError("Netzwerkfehler beim Upload. Bitte erneut versuchen.");
    } finally {
      setUploading(false);
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

          {/* Branding — Slice 10.6 */}
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              Branding
            </p>
            <div className={gridClass}>
              <div className="sm:col-span-2">
                <label htmlFor="cfg-logo-url" className={labelClass}>Logo-URL</label>

                {/* Hidden file input — triggered by the upload button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_LOGO_UPLOAD_MIME_TYPES.join(",")}
                  className="sr-only"
                  aria-label="Logo hochladen"
                  onChange={handleLogoUpload}
                />

                <div className="flex items-center gap-2">
                  <input
                    id="cfg-logo-url"
                    type="text"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://…/logo.png"
                    className="fca-input flex-1"
                  />
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="fca-button-secondary flex items-center gap-1.5 shrink-0"
                    title={`PNG, JPEG oder WebP, max. ${MAX_LOGO_FILE_SIZE_BYTES / 1024 / 1024} MB`}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {uploading ? "Hochladen…" : "Hochladen"}
                  </button>
                </div>

                {uploadError && (
                  <p className="mt-1.5 text-[11px] font-medium text-rose-600">{uploadError}</p>
                )}
                {uploadSuccess && (
                  <p className="mt-1.5 text-[11px] font-medium text-emerald-600">Logo erfolgreich hochgeladen.</p>
                )}

                <p className="mt-1 text-[11px] text-[var(--muted)]">
                  URL oder Pfad zum Vereinslogo — oder Datei direkt hochladen (PNG, JPEG, WebP, max. {MAX_LOGO_FILE_SIZE_BYTES / 1024 / 1024} MB).
                </p>
              </div>

              <div>
                <label htmlFor="cfg-primary-color" className={labelClass}>Primärfarbe</label>
                <div className="flex items-center gap-2">
                  <input
                    id="cfg-primary-color-picker"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border border-[var(--border)] bg-[var(--surface)] p-0.5"
                    aria-label="Primärfarbe wählen"
                  />
                  <input
                    id="cfg-primary-color"
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder={PLATFORM_BRANDING.primaryColor}
                    maxLength={7}
                    className="fca-input font-mono"
                  />
                </div>
                <p className="mt-1 text-[11px] text-[var(--muted)]">
                  6-stelliger Hex-Wert (z.B. {PLATFORM_BRANDING.primaryColor}).
                </p>
              </div>

              <div>
                <label htmlFor="cfg-secondary-color" className={labelClass}>Sekundärfarbe</label>
                <div className="flex items-center gap-2">
                  <input
                    id="cfg-secondary-color-picker"
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border border-[var(--border)] bg-[var(--surface)] p-0.5"
                    aria-label="Sekundärfarbe wählen"
                  />
                  <input
                    id="cfg-secondary-color"
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    placeholder={PLATFORM_BRANDING.secondaryColor}
                    maxLength={7}
                    className="fca-input font-mono"
                  />
                </div>
                <p className="mt-1 text-[11px] text-[var(--muted)]">
                  6-stelliger Hex-Wert (z.B. {PLATFORM_BRANDING.secondaryColor}).
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
