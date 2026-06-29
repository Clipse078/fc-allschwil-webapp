"use client";

/**
 * RegistrationCtaConfigForm — CMS V4.2 Component Library
 * Registration CTA component config editor.
 */

type RegistrationCtaConfig = {
  headline: string;
  description: string;
  registrationType: string;
  buttonLabel: string;
  buttonUrl: string;
  targetAudience: string;
  deadline: string | null;
  spotsLeft: number | null;
  backgroundColor: "default" | "primary" | "accent" | "dark";
};

type Props = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
};

const labelClass = "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5";

export default function RegistrationCtaConfigForm({ config, onChange }: Props) {
  const c = config as RegistrationCtaConfig;

  function set<K extends keyof RegistrationCtaConfig>(key: K, value: RegistrationCtaConfig[K]) {
    onChange({ ...config, [key]: value });
  }

  return (
    <div className="space-y-5">
      <div>
        <label className={labelClass}>Überschrift</label>
        <input type="text" value={c.headline} onChange={(e) => set("headline", e.target.value)}
          placeholder="Jetzt Mitglied werden!" className="fca-input" />
      </div>
      <div>
        <label className={labelClass}>Beschreibung</label>
        <textarea value={c.description} onChange={(e) => set("description", e.target.value)}
          placeholder="Werden Sie Teil unseres Vereins und profitieren Sie von…" rows={3}
          className="fca-input resize-none" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Button-Text</label>
          <input type="text" value={c.buttonLabel} onChange={(e) => set("buttonLabel", e.target.value)}
            placeholder="Jetzt anmelden" className="fca-input" />
        </div>
        <div>
          <label className={labelClass}>Button-URL</label>
          <input type="text" value={c.buttonUrl} onChange={(e) => set("buttonUrl", e.target.value)}
            placeholder="/anmeldung" className="fca-input font-mono text-xs" />
        </div>
      </div>

      <div>
        <label className={labelClass}>Anmeldungstyp</label>
        <select value={c.registrationType} onChange={(e) => set("registrationType", e.target.value)}
          className="fca-input">
          <option value="">— Wählen —</option>
          <option value="MEMBERSHIP">Mitgliedschaft</option>
          <option value="CAMP">Fussballcamp</option>
          <option value="TRIAL">Schnuppertraining</option>
          <option value="EVENT">Veranstaltung</option>
          <option value="CUSTOM">Eigener Typ</option>
        </select>
      </div>

      <div>
        <label className={labelClass}>Zielgruppe</label>
        <input type="text" value={c.targetAudience} onChange={(e) => set("targetAudience", e.target.value)}
          placeholder="z.B. Kinder 6–10 Jahre, Erwachsene…" className="fca-input" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Anmeldefrist</label>
          <input type="date" value={c.deadline ?? ""} onChange={(e) => set("deadline", e.target.value || null)}
            className="fca-input text-xs" />
        </div>
        <div>
          <label className={labelClass}>Freie Plätze</label>
          <input type="number" value={c.spotsLeft ?? ""} min={0}
            onChange={(e) => set("spotsLeft", e.target.value ? parseInt(e.target.value) : null)}
            placeholder="unbegrenzt" className="fca-input text-xs" />
        </div>
      </div>

      <div>
        <label className={labelClass}>Hintergrund</label>
        <select value={c.backgroundColor} onChange={(e) => set("backgroundColor", e.target.value as RegistrationCtaConfig["backgroundColor"])}
          className="fca-input">
          <option value="default">Standard (weiß)</option>
          <option value="primary">Primärfarbe</option>
          <option value="accent">Akzentfarbe</option>
          <option value="dark">Dunkel</option>
        </select>
      </div>
    </div>
  );
}
