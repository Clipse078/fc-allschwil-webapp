"use client";

import { useEffect, useMemo, useState } from "react";

type SeasonOption = {
  id: string;
  name: string;
  key: string;
  isActive: boolean;
};

type SeasonTransitionConfig = {
  id: string;
  activeSeasonId: string | null;
  nextSeasonId: string | null;
  websitePublishedSeasonId: string | null;
  seasonTransitionDate: string | null;
  seasonTransitionMode: "MANUAL" | "AUTOMATIC" | "PREVIEW_FIRST";
  seasonAutoSwitchWebsite: boolean;
  seasonManualOverride: boolean;
  seasonTransitionNotes: string | null;
  activeSeason?: SeasonOption | null;
  nextSeason?: SeasonOption | null;
  websitePublishedSeason?: SeasonOption | null;
};

function seasonLabel(season?: SeasonOption | null) {
  return season?.name ?? "Keine Saison gewählt";
}

function modeText(mode: SeasonTransitionConfig["seasonTransitionMode"]) {
  if (mode === "AUTOMATIC") return "Automatischer Wechsel am Übergangsdatum.";
  if (mode === "MANUAL") return "Wechsel erfolgt nur manuell durch Admin.";
  return "Neue Saison wird vorbereitet. Website bleibt unverändert bis Freigabe.";
}

export function SeasonTransitionSettingsCard() {
  const [config, setConfig] = useState<SeasonTransitionConfig | null>(null);
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setMessage(null);

    const response = await fetch("/api/admin/season-transition", {
      cache: "no-store",
    });

    if (!response.ok) {
      setMessage("Saisonsteuerung konnte nicht geladen werden.");
      setIsLoading(false);
      return;
    }

    const data = await response.json();
    setConfig(data.config);
    setSeasons(data.seasons ?? []);
    setIsLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const transitionDateValue = useMemo(() => {
    if (!config?.seasonTransitionDate) return "";
    return config.seasonTransitionDate.slice(0, 10);
  }, [config?.seasonTransitionDate]);

  const selectedActiveSeason = useMemo(
    () => seasons.find((season) => season.id === config?.activeSeasonId) ?? config?.activeSeason ?? null,
    [config?.activeSeason, config?.activeSeasonId, seasons],
  );

  const selectedNextSeason = useMemo(
    () => seasons.find((season) => season.id === config?.nextSeasonId) ?? config?.nextSeason ?? null,
    [config?.nextSeason, config?.nextSeasonId, seasons],
  );

  const selectedWebsiteSeason = useMemo(
    () =>
      seasons.find((season) => season.id === config?.websitePublishedSeasonId) ??
      config?.websitePublishedSeason ??
      selectedActiveSeason,
    [config?.websitePublishedSeason, config?.websitePublishedSeasonId, selectedActiveSeason, seasons],
  );

  const impactItems = useMemo(() => {
    if (!config) return [];

    const items = [
      `Aktive Saison: ${seasonLabel(selectedActiveSeason)}`,
      `Nächste Saison: ${seasonLabel(selectedNextSeason)}`,
      `Website zeigt: ${seasonLabel(selectedWebsiteSeason)}`,
    ];

    if (config.seasonTransitionMode === "AUTOMATIC" && transitionDateValue) {
      items.push(`Am ${transitionDateValue} wird die neue Saison automatisch aktiviert.`);
    }

    if (config.seasonAutoSwitchWebsite && selectedNextSeason) {
      items.push(`Website wechselt beim Saisonwechsel auf ${selectedNextSeason.name}.`);
    }

    if (!config.seasonAutoSwitchWebsite) {
      items.push("Website bleibt beim Saisonwechsel auf der aktuell gewählten Website-Saison.");
    }

    if (config.seasonManualOverride) {
      items.push("Manuelle Sperre ist aktiv: automatische Umstellung wird blockiert.");
    }

    return items;
  }, [config, selectedActiveSeason, selectedNextSeason, selectedWebsiteSeason, transitionDateValue]);

  async function save() {
    if (!config) return;

    setIsSaving(true);
    setMessage(null);

    const response = await fetch("/api/admin/season-transition", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activeSeasonId: config.activeSeasonId,
        nextSeasonId: config.nextSeasonId,
        websitePublishedSeasonId: config.websitePublishedSeasonId,
        seasonTransitionDate: transitionDateValue,
        seasonTransitionMode: config.seasonTransitionMode,
        seasonAutoSwitchWebsite: config.seasonAutoSwitchWebsite,
        seasonManualOverride: config.seasonManualOverride,
        seasonTransitionNotes: config.seasonTransitionNotes,
      }),
    });

    setIsSaving(false);

    if (!response.ok) {
      setMessage("❌ Speichern fehlgeschlagen.");
      return;
    }

    setMessage("✅ Saisonsteuerung gespeichert.");
    await load();
  }

  async function triggerNow() {
    if (!config || !selectedNextSeason) {
      setMessage("❌ Bitte zuerst eine nächste Saison wählen.");
      return;
    }

    const impact = [
      "⚠️ Saisonwechsel jetzt ausführen?",
      "",
      "Diese Aktion hat sofortige Auswirkungen:",
      "",
      `• Aktive Saison wird: ${selectedNextSeason.name}`,
      `• Bisher aktive Saison bleibt archiviert: ${seasonLabel(selectedActiveSeason)}`,
      config.seasonAutoSwitchWebsite
        ? `• Website wird auf neue Saison umgestellt: ${selectedNextSeason.name}`
        : `• Website bleibt vorerst auf: ${seasonLabel(selectedWebsiteSeason)}`,
      "• Neue Saison-Vorbereitung wird danach geleert",
      "• Diese Aktion wird im Admin Log protokolliert",
      "",
      "Nur bestätigen, wenn du diese Umstellung wirklich jetzt ausführen willst.",
    ].join("\n");

    const confirmed = window.confirm(impact);

    if (!confirmed) {
      setMessage("Saisonwechsel abgebrochen.");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    const response = await fetch("/api/admin/season-transition/trigger", {
      method: "POST",
    });

    setIsSaving(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setMessage(`❌ ${payload?.error ?? "Saisonwechsel fehlgeschlagen."}`);
      return;
    }

    setMessage("🚀 Saison wurde manuell umgestellt.");
    await load();
  }

  if (isLoading) {
    return (
      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">Saisonsteuerung wird geladen...</p>
      </section>
    );
  }

  if (!config) {
    return (
      <section className="rounded-[32px] border border-red-100 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-red-700">Club-Konfiguration fehlt.</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
      <div className="bg-gradient-to-br from-slate-950 via-[#0b4aa2] to-[#123f7a] p-6 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">Saisonverwaltung</p>
            <h2 className="mt-2 text-2xl font-black">Saison Control Center</h2>
          </div>
          <div className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-white">
            {config.seasonTransitionMode === "AUTOMATIC" ? "Auto aktiv" : config.seasonTransitionMode === "MANUAL" ? "Manuell" : "Preview zuerst"}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-[24px] border border-white/15 bg-white/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-100">Aktiv</p>
            <p className="mt-2 text-lg font-black">{seasonLabel(selectedActiveSeason)}</p>
          </div>
          <div className="rounded-[24px] border border-white/15 bg-white/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-100">Vorbereitet</p>
            <p className="mt-2 text-lg font-black">{seasonLabel(selectedNextSeason)}</p>
          </div>
          <div className="rounded-[24px] border border-white/15 bg-white/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-100">Website</p>
            <p className="mt-2 text-lg font-black">{seasonLabel(selectedWebsiteSeason)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5 lg:p-6">
        <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-red-600">Saison Definition</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Aktive Saison</span>
              <select value={config.activeSeasonId ?? ""} onChange={(event) => setConfig({ ...config, activeSeasonId: event.target.value || null })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                <option value="">Keine Saison gewählt</option>
                {seasons.map((season) => <option key={season.id} value={season.id}>{season.name}{season.isActive ? " (aktiv)" : ""}</option>)}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Nächste Saison</span>
              <select value={config.nextSeasonId ?? ""} onChange={(event) => setConfig({ ...config, nextSeasonId: event.target.value || null })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                <option value="">Keine Saison gewählt</option>
                {seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Website-Saison</span>
              <select value={config.websitePublishedSeasonId ?? ""} onChange={(event) => setConfig({ ...config, websitePublishedSeasonId: event.target.value || null })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                <option value="">Wie aktive Saison</option>
                {seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-red-600">Übergangslogik</p>
            <div className="mt-4 grid gap-4">
              <input type="date" value={transitionDateValue} onChange={(event) => setConfig({ ...config, seasonTransitionDate: event.target.value || null })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
              <select value={config.seasonTransitionMode} onChange={(event) => setConfig({ ...config, seasonTransitionMode: event.target.value as SeasonTransitionConfig["seasonTransitionMode"] })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                <option value="PREVIEW_FIRST">Preview zuerst</option>
                <option value="AUTOMATIC">Automatisch</option>
                <option value="MANUAL">Manuell</option>
              </select>
              <p className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-900">{modeText(config.seasonTransitionMode)}</p>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-red-600">System Verhalten</p>
            <div className="mt-4 grid gap-3">
              <button type="button" onClick={() => setConfig({ ...config, seasonAutoSwitchWebsite: !config.seasonAutoSwitchWebsite })} className={`rounded-2xl border px-4 py-3 text-left text-sm font-black transition ${config.seasonAutoSwitchWebsite ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                Website automatisch auf neue Saison umstellen
              </button>
              <button type="button" onClick={() => setConfig({ ...config, seasonManualOverride: !config.seasonManualOverride })} className={`rounded-2xl border px-4 py-3 text-left text-sm font-black transition ${config.seasonManualOverride ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                Manuelle Sperre aktiv
              </button>
              <input value={config.seasonTransitionNotes ?? ""} onChange={(event) => setConfig({ ...config, seasonTransitionNotes: event.target.value })} placeholder="Notiz, z.B. Wechsel per 01.07." className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">Impact Preview</p>
          <ul className="mt-3 space-y-2 text-sm font-bold text-amber-950">
            {impactItems.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </div>

        <div className="flex flex-col gap-3 rounded-[28px] border border-slate-200 bg-white p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-black text-slate-950">Änderungen werden protokolliert.</p>
            <p className="mt-1 text-xs font-bold text-slate-500">Manueller Wechsel ist sofort aktiv.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={save} disabled={isSaving} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
              {isSaving ? "Speichern..." : "Änderungen speichern"}
            </button>
            <button type="button" onClick={triggerNow} disabled={isSaving || !selectedNextSeason} className="rounded-full border border-red-200 bg-white px-5 py-3 text-sm font-black text-red-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40">
              Jetzt Saison wechseln
            </button>
          </div>
        </div>

        {message ? <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">{message}</p> : null}
      </div>
    </section>
  );
}

