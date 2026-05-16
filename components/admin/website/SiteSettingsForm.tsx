"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Info, Lightbulb, Lock } from "lucide-react";
import { updateSiteSettings } from "@/app/(admin)/dashboard/website/settings/actions";
import { WEBSITE_PRESETS } from "@/lib/website/website-preset-catalog";
import { INFOBOARD_PRESETS, INFOBOARD_MODE_LABELS } from "@/lib/infoboard/infoboard-preset-catalog";

const LOCALE_OPTIONS = [
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "it", label: "Italiano" },
  { value: "en", label: "English" },
];

const SPORT_OPTIONS = [
  { value: "football", label: "Fussball" },
  { value: "basketball", label: "Basketball" },
  { value: "handball", label: "Handball" },
  { value: "volleyball", label: "Volleyball" },
  { value: "futsal", label: "Futsal" },
  { value: "tennis", label: "Tennis" },
  { value: "fitness", label: "Fitness / Athletik" },
  { value: "other", label: "Andere Sportart" },
];

type Props = {
  tenantKey: string;
  initialValues: {
    name: string;
    locale: string;
    sport: string;
    domain: string;
    logoUrl: string;
    primaryColor: string;
    footerText: string;
    websitePresetKey: string;
    infoboardPresetKey: string;
    infoboardMode: string;
  };
};

export default function SiteSettingsForm({ tenantKey, initialValues }: Props) {
  const [values, setValues] = useState({
    ...initialValues,
    websitePresetKey: initialValues.websitePresetKey ?? "",
    infoboardPresetKey: initialValues.infoboardPresetKey ?? "",
    infoboardMode: initialValues.infoboardMode ?? "",
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function set(key: keyof typeof values, val: string) {
    setSaved(false);
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const fd = new FormData();
      Object.entries(values).forEach(([k, v]) => fd.append(k, v));
      const result = await updateSiteSettings(fd);
      if (result.ok) setSaved(true);
      else setError(result.error);
    });
  }

  const base =
    "w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10";

  return (
    <div className="space-y-5">
      {/* Guidance */}
      <div className="flex items-start gap-3 rounded-[18px] border border-[#0b4aa2]/15 bg-[#0b4aa2]/5 px-4 py-3">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0b4aa2]" />
        <p className="text-[12px] text-slate-600">
          <span className="font-semibold text-[#0b4aa2]">Website-Einstellungen</span>{" "}
          steuern wie die öffentliche Website diesen Tenant identifiziert.
          Änderungen gelten beim nächsten Seitenaufruf.
        </p>
      </div>

      {/* Tenant key (read-only) */}
      <div className="rounded-[20px] border border-slate-200/80 bg-white p-5 shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
        <h2 className="text-[1rem] font-semibold text-slate-900">Tenant-Konfiguration</h2>

        <div className="mt-4 space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <Lock className="h-3 w-3" />
              Tenant-Key (schreibgeschützt)
            </label>
            <div className="mt-1.5 flex h-10 items-center rounded-[14px] border border-slate-200 bg-slate-50 px-3 font-mono text-sm text-slate-500">
              {tenantKey}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Der Tenant-Key wird von öffentlichen APIs verwendet und sollte stabil bleiben.
              Änderungen würden externe Integrationen unterbrechen.
            </p>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500">Vereinsname</label>
            <input
              className={`mt-1.5 h-10 ${base}`}
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="z. B. FC Musterstadt"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-semibold text-slate-500">Standard-Sprache</label>
              <select className={`mt-1.5 h-10 ${base}`} value={values.locale} onChange={(e) => set("locale", e.target.value)}>
                {LOCALE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500">Sportart</label>
              <select className={`mt-1.5 h-10 ${base}`} value={values.sport} onChange={(e) => set("sport", e.target.value)}>
                {SPORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500">Domain / Subdomain (optional)</label>
            <input
              className={`mt-1.5 h-10 ${base}`}
              value={values.domain}
              onChange={(e) => set("domain", e.target.value)}
              placeholder="z. B. www.fcmusterstadt.ch"
            />
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="rounded-[20px] border border-slate-200/80 bg-white p-5 shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
        <h2 className="text-[1rem] font-semibold text-slate-900">Darstellung</h2>
        <p className="mt-0.5 text-[11px] text-slate-400">
          Grundeinstellungen für die Darstellung der öffentlichen Website.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-slate-500">Logo-URL (optional)</label>
            <input
              className={`mt-1.5 h-10 ${base}`}
              value={values.logoUrl}
              onChange={(e) => set("logoUrl", e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500">Primärfarbe (optional, Hex)</label>
            <input
              className={`mt-1.5 h-10 ${base}`}
              value={values.primaryColor}
              onChange={(e) => set("primaryColor", e.target.value)}
              placeholder="#0b4aa2"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500">Footer-Text (optional)</label>
            <input
              className={`mt-1.5 h-10 ${base}`}
              value={values.footerText}
              onChange={(e) => set("footerText", e.target.value)}
              placeholder="© 2025 FC Musterstadt"
            />
          </div>
        </div>
      </div>

      {/* Website Presets */}
      <div className="rounded-[20px] border border-slate-200/80 bg-white p-5 shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
        <h2 className="text-[1rem] font-semibold text-slate-900">Website Preset</h2>
        <div className="mt-1 flex items-start gap-2 rounded-[12px] border border-[#0b4aa2]/10 bg-[#0b4aa2]/5 px-3 py-2">
          <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-[#0b4aa2]" />
          <p className="text-[11px] text-slate-600">
            Presets definieren Struktur und visuellen Rhythmus. Dein Club-Branding
            (Logo, Farbe, Domain) wird immer angewandt.
          </p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {WEBSITE_PRESETS.map((p) => (
            <label
              key={p.key}
              className={`flex cursor-pointer items-start gap-2.5 rounded-[14px] border p-3 transition ${
                values.websitePresetKey === p.key
                  ? "border-[#0b4aa2] bg-[#0b4aa2]/5 ring-1 ring-[#0b4aa2]/20"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="websitePresetKey"
                value={p.key}
                checked={values.websitePresetKey === p.key}
                onChange={() => { set("websitePresetKey", p.key); setSaved(false); }}
                className="mt-0.5 shrink-0 accent-[#0b4aa2]"
              />
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-slate-900">{p.name}</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
                  {p.description}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {p.visualTone}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Infoboard Presets */}
      <div className="rounded-[20px] border border-slate-200/80 bg-white p-5 shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
        <h2 className="text-[1rem] font-semibold text-slate-900">Infoboard Preset</h2>
        <div className="mt-1 flex items-start gap-2 rounded-[12px] border border-amber-100 bg-amber-50/70 px-3 py-2">
          <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
          <p className="text-[11px] text-amber-800">
            Infoboard-Presets können später für Spielplan-, Sponsoren- und Spieltag-Screens
            verwendet werden.
          </p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {INFOBOARD_PRESETS.map((p) => (
            <label
              key={p.key}
              className={`flex cursor-pointer items-start gap-2.5 rounded-[14px] border p-3 transition ${
                values.infoboardPresetKey === p.key
                  ? "border-[#0b4aa2] bg-[#0b4aa2]/5 ring-1 ring-[#0b4aa2]/20"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="infoboardPresetKey"
                value={p.key}
                checked={values.infoboardPresetKey === p.key}
                onChange={() => { set("infoboardPresetKey", p.key); set("infoboardMode", p.mode); setSaved(false); }}
                className="mt-0.5 shrink-0 accent-[#0b4aa2]"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[12px] font-semibold text-slate-900">{p.name}</p>
                  <span className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                    {INFOBOARD_MODE_LABELS[p.mode]}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
                  {p.description}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Save */}
      {saved && (
        <div className="flex items-center gap-2 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-2.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <p className="text-[12px] text-emerald-800">Einstellungen gespeichert.</p>
        </div>
      )}
      {error && (
        <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-2.5 text-[12px] text-rose-800">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={handleSave}
        disabled={isPending || !values.name.trim()}
        className="rounded-full bg-[#0b4aa2] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#08357a] disabled:opacity-50"
      >
        {isPending ? "Speichern …" : "Einstellungen speichern"}
      </button>
    </div>
  );
}
