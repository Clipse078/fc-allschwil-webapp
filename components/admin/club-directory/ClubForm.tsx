"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import {
  LOGO_CONTRAST_MODES,
  type LogoContrastMode,
} from "@/lib/club-directory/logo-contrast-mode";

type ClubFormProps = {
  mode: "create" | "edit";
  clubId?: string;
  defaultValues?: {
    name?: string;
    shortName?: string;
    alternativeName?: string;
    website?: string;
    location?: string;
    notes?: string;
    logoContrastMode?: LogoContrastMode;
  };
};

const fieldClass =
  "w-full rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0b4aa2]/30";
const labelClass = "block text-[12px] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-1.5";

const LOGO_CONTRAST_MODE_OPTIONS: { value: LogoContrastMode; label: string }[] = [
  { value: LOGO_CONTRAST_MODES.NORMAL, label: "Normal" },
  { value: LOGO_CONTRAST_MODES.INVERT_ON_DARK, label: "Invertieren" },
];

export default function ClubForm({ mode, clubId, defaultValues }: ClubFormProps) {
  const router = useRouter();
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [shortName, setShortName] = useState(defaultValues?.shortName ?? "");
  const [alternativeName, setAlternativeName] = useState(defaultValues?.alternativeName ?? "");
  const [website, setWebsite] = useState(defaultValues?.website ?? "");
  const [location, setLocation] = useState(defaultValues?.location ?? "");
  const [notes, setNotes] = useState(defaultValues?.notes ?? "");
  const [logoContrastMode, setLogoContrastMode] = useState<LogoContrastMode>(
    defaultValues?.logoContrastMode ?? LOGO_CONTRAST_MODES.NORMAL,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name ist erforderlich.");
      return;
    }
    setLoading(true);
    try {
      const url = mode === "edit" ? `/api/club-directory/clubs/${clubId}` : "/api/club-directory/clubs";
      const method = mode === "edit" ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          shortName: shortName || null,
          alternativeName: alternativeName || null,
          website: website || null,
          location: location || null,
          notes: notes || null,
          logoContrastMode,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error ?? "Fehler beim Speichern.");
        return;
      }

      const targetId = mode === "edit" ? clubId : data?.club?.id;
      router.push(targetId ? `/dashboard/vereine/${targetId}` : "/dashboard/vereine");
      router.refresh();
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <h3 className="mb-5 text-[1.05rem] font-semibold text-slate-900">Vereinsdaten</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelClass}>Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. SV Muttenz"
              className={fieldClass}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Kurzname</label>
            <input
              type="text"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="z.B. Muttenz"
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Alternativname</label>
            <input
              type="text"
              value={alternativeName}
              onChange={(e) => setAlternativeName(e.target.value)}
              placeholder="Optional"
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Website</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://…"
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Ort / Adresse</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Optional"
              className={fieldClass}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Notizen</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optionale interne Notiz…"
              className={fieldClass}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="logo-contrast-mode" className={labelClass}>
              Logo auf dunklem Hintergrund
            </label>
            <select
              id="logo-contrast-mode"
              value={logoContrastMode}
              onChange={(e) => setLogoContrastMode(e.target.value as LogoContrastMode)}
              className={fieldClass}
            >
              {LOGO_CONTRAST_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              Für sehr dunkle Logos auf dunklen Flächen.
            </p>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-6 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60 hover:bg-[#08357a]"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === "create" ? "Verein erstellen" : "Änderungen speichern"}
        </button>
      </div>
    </form>
  );
}
