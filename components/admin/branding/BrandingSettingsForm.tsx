"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, X } from "lucide-react";
import { PLATFORM_BRANDING, resolveTenantBranding } from "@/lib/tenant-runtime/branding";
import { isValidHexColor } from "@/lib/tenant-runtime/branding-validation";
import {
  ALLOWED_LOGO_UPLOAD_MIME_TYPES,
  MAX_LOGO_FILE_SIZE_BYTES,
  validateLogoUploadFile,
} from "@/lib/assets/validation";
import BrandingPreviewCard from "@/components/admin/branding/BrandingPreviewCard";

type BrandingSettingsFormProps = {
  tenantName: string;
  defaultValues: {
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
  };
};

const labelClass =
  "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5";

export default function BrandingSettingsForm({
  tenantName,
  defaultValues,
}: BrandingSettingsFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resolved = resolveTenantBranding(defaultValues);
  const [logoUrl, setLogoUrl] = useState(resolved.logoUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(resolved.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(resolved.secondaryColor);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  async function handleLogoFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateLogoUploadFile(file);
    if (!validation.ok) {
      setUploadError(validation.error);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/branding/logo", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadError(data?.error ?? "Logo-Upload fehlgeschlagen.");
        return;
      }
      if (typeof data.logoUrl === "string") {
        setLogoUrl(data.logoUrl);
      }
    } catch {
      setUploadError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);

    if (primaryColor && !isValidHexColor(primaryColor)) {
      setSaveError("Primärfarbe muss ein gültiger Hex-Wert sein (z.B. #0b4aa2).");
      return;
    }
    if (secondaryColor && !isValidHexColor(secondaryColor)) {
      setSaveError("Sekundärfarbe muss ein gültiger Hex-Wert sein (z.B. #c7332c).");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logoUrl: logoUrl || null,
          primaryColor: primaryColor || null,
          secondaryColor: secondaryColor || null,
        }),
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

  const allowedTypes = ALLOWED_LOGO_UPLOAD_MIME_TYPES.join(", ");
  const maxMb = Math.round(MAX_LOGO_FILE_SIZE_BYTES / (1024 * 1024));

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      {/* Left — form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Logo section */}
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Logo
            </p>
          </div>
          <div className="sce-detail-section-body space-y-4">
            <div>
              <label className={labelClass}>Logo-URL</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://... (oder über Upload setzen)"
                  className="fca-input flex-1"
                />
                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => setLogoUrl("")}
                    title="Logo entfernen"
                    className="fca-button-secondary px-2"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className={labelClass}>Logo hochladen</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="fca-button-secondary"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploading ? "Hochladen…" : "Datei auswählen"}
                </button>
                <p className="text-[11px] text-[var(--muted)]">
                  {allowedTypes.replace("image/", "").toUpperCase()} · max. {maxMb} MB
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={allowedTypes}
                className="hidden"
                onChange={handleLogoFileSelect}
              />
              {uploadError ? (
                <p className="mt-2 text-[11px] font-medium text-rose-600">{uploadError}</p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Colors section */}
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Vereinsfarben
            </p>
          </div>
          <div className="sce-detail-section-body space-y-5">
            {/* Primary */}
            <div>
              <label htmlFor="primary-color" className={labelClass}>
                Primärfarbe
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="primary-color-picker"
                  type="color"
                  value={isValidHexColor(primaryColor) ? primaryColor : PLATFORM_BRANDING.primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-9 w-9 cursor-pointer rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] p-0.5"
                />
                <input
                  id="primary-color"
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder={PLATFORM_BRANDING.primaryColor}
                  maxLength={7}
                  className="fca-input w-36 font-mono uppercase"
                />
                <span
                  className="inline-flex h-7 w-7 rounded-full border border-[var(--border)]"
                  style={{ background: isValidHexColor(primaryColor) ? primaryColor : "transparent" }}
                />
              </div>
              {primaryColor && !isValidHexColor(primaryColor) ? (
                <p className="mt-1 text-[11px] text-rose-600">
                  Ungültiger Hex-Wert (erwartet: #rrggbb)
                </p>
              ) : null}
            </div>

            {/* Secondary */}
            <div>
              <label htmlFor="secondary-color" className={labelClass}>
                Sekundärfarbe
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="secondary-color-picker"
                  type="color"
                  value={isValidHexColor(secondaryColor) ? secondaryColor : PLATFORM_BRANDING.secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="h-9 w-9 cursor-pointer rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] p-0.5"
                />
                <input
                  id="secondary-color"
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  placeholder={PLATFORM_BRANDING.secondaryColor}
                  maxLength={7}
                  className="fca-input w-36 font-mono uppercase"
                />
                <span
                  className="inline-flex h-7 w-7 rounded-full border border-[var(--border)]"
                  style={{ background: isValidHexColor(secondaryColor) ? secondaryColor : "transparent" }}
                />
              </div>
              {secondaryColor && !isValidHexColor(secondaryColor) ? (
                <p className="mt-1 text-[11px] text-rose-600">
                  Ungültiger Hex-Wert (erwartet: #rrggbb)
                </p>
              ) : null}
            </div>

            {/* Reset to platform defaults */}
            <button
              type="button"
              onClick={() => {
                setPrimaryColor(PLATFORM_BRANDING.primaryColor);
                setSecondaryColor(PLATFORM_BRANDING.secondaryColor);
              }}
              className="text-[11px] text-[var(--muted)] underline underline-offset-2 transition hover:text-[var(--text-2)]"
            >
              Auf Plattform-Standardfarben zurücksetzen
            </button>
          </div>
        </div>

        {/* Status + submit */}
        {saveError ? (
          <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {saveError}
          </div>
        ) : null}
        {saveSuccess ? (
          <div className="rounded-[var(--radius-xl)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            Branding gespeichert.
          </div>
        ) : null}
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="fca-button-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Speichern…" : "Branding speichern"}
          </button>
        </div>
      </form>

      {/* Right — live preview */}
      <div className="space-y-4">
        <BrandingPreviewCard
          tenantName={tenantName}
          logoUrl={logoUrl || null}
          primaryColor={primaryColor || null}
          secondaryColor={secondaryColor || null}
        />
      </div>
    </div>
  );
}
