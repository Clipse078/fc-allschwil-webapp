"use client";

/**
 * WebsiteSettingsFormV2 — CMS V4.2
 *
 * 8-tab website settings form:
 *   1. Allgemein (General)
 *   2. SEO
 *   3. Social / OG
 *   4. Analytics
 *   5. Technisch (Technical)
 *   6. PWA
 *   7. Cookie
 *   8. Weiterleitungen (Redirects)
 *
 * Tabs 1–7 save to WebsiteConfig via PATCH /api/website-config.
 * Tab 8 manages WebsiteRedirect via /api/website-redirects.
 * The existing approvedDataOnly toggle (Vier-Augen-Prinzip) is preserved in
 * Tab 1 and saves to /api/website-settings (unchanged endpoint).
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Globe,
  Search,
  Share2,
  BarChart2,
  Settings,
  Smartphone,
  Shield,
  ArrowRightLeft,
  Loader2,
  Plus,
  Trash2,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import type { WebsiteConfigData } from "@/lib/website-config/queries";
import type { WebsiteRedirectItem } from "@/lib/website-redirects/queries";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab =
  | "general"
  | "seo"
  | "social"
  | "analytics"
  | "technical"
  | "pwa"
  | "cookie"
  | "redirects";

type Props = {
  config: WebsiteConfigData;
  approvedDataOnly: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const labelClass =
  "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5";

function SettingsInput({
  label,
  hint,
  ...rest
}: {
  label: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input {...rest} className={"fca-input " + (rest.className ?? "")} />
      {hint && <p className="mt-1 text-[10px] text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

function SettingsTextarea({
  label,
  hint,
  ...rest
}: {
  label: string;
  hint?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <textarea {...rest} className={"fca-input resize-y " + (rest.className ?? "")} />
      {hint && <p className="mt-1 text-[10px] text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          "relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
          checked ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition",
            checked ? "translate-x-4" : "translate-x-0",
          ].join(" ")}
        />
      </button>
      <div>
        <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
        {description && <p className="mt-0.5 text-xs text-[var(--muted)]">{description}</p>}
      </div>
    </div>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "general", label: "Allgemein", icon: <Globe className="h-3.5 w-3.5" /> },
  { id: "seo", label: "SEO", icon: <Search className="h-3.5 w-3.5" /> },
  { id: "social", label: "Social", icon: <Share2 className="h-3.5 w-3.5" /> },
  { id: "analytics", label: "Analytics", icon: <BarChart2 className="h-3.5 w-3.5" /> },
  { id: "technical", label: "Technisch", icon: <Settings className="h-3.5 w-3.5" /> },
  { id: "pwa", label: "PWA", icon: <Smartphone className="h-3.5 w-3.5" /> },
  { id: "cookie", label: "Cookie", icon: <Shield className="h-3.5 w-3.5" /> },
  { id: "redirects", label: "Weiterleitungen", icon: <ArrowRightLeft className="h-3.5 w-3.5" /> },
];

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-[var(--border)] mb-6">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={[
            "flex items-center gap-1.5 border-b-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors",
            active === t.id
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
          ].join(" ")}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Redirects sub-panel ───────────────────────────────────────────────────────

function RedirectsPanel() {
  const [redirects, setRedirects] = useState<WebsiteRedirectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newFrom, setNewFrom] = useState("");
  const [newTo, setNewTo] = useState("");
  const [newPermanent, setNewPermanent] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/website-redirects")
      .then((r) => r.json())
      .then((d) => setRedirects(d.redirects ?? []))
      .catch(() => setRedirects([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd() {
    if (!newFrom || !newTo) { setAddError("Von- und Ziel-Pfad sind erforderlich."); return; }
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/website-redirects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromPath: newFrom, toPath: newTo, isPermanent: newPermanent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setAddError(data?.error ?? "Fehler."); return; }
      setRedirects((r) => [data.redirect, ...r]);
      setNewFrom("");
      setNewTo("");
    } catch {
      setAddError("Netzwerkfehler.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Weiterleitung löschen?")) return;
    const res = await fetch(`/api/website-redirects/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRedirects((r) => r.filter((x) => x.id !== id));
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    const res = await fetch(`/api/website-redirects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    if (res.ok) {
      const data = await res.json();
      setRedirects((r) => r.map((x) => (x.id === id ? data.redirect : x)));
    }
  }

  return (
    <div className="space-y-6">
      {/* Add form */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            Neue Weiterleitung
          </p>
        </div>
        <div className="sce-detail-section-body space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <SettingsInput
              label="Von-Pfad"
              placeholder="/alte-seite"
              value={newFrom}
              onChange={(e) => setNewFrom(e.target.value)}
              hint="Muss mit / beginnen"
            />
            <SettingsInput
              label="Ziel-Pfad oder URL"
              placeholder="/neue-seite"
              value={newTo}
              onChange={(e) => setNewTo(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Toggle
              label="Permanent (301)"
              checked={newPermanent}
              onChange={setNewPermanent}
              description="Temporär (302) wenn deaktiviert"
            />
          </div>
          {addError && <p className="text-xs text-rose-600">{addError}</p>}
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding}
            className="fca-button-primary"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Hinzufügen
          </button>
        </div>
      </div>

      {/* List */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            Aktive Weiterleitungen ({redirects.length})
          </p>
        </div>
        <div className="sce-detail-section-body">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Laden…
            </div>
          ) : redirects.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">Keine Weiterleitungen konfiguriert.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {redirects.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <code className="font-mono text-[var(--foreground)] truncate">{r.fromPath}</code>
                      <ExternalLink className="h-3 w-3 shrink-0 text-[var(--muted)]" />
                      <code className="font-mono text-[var(--text-2)] truncate">{r.toPath}</code>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--muted)]">
                      <span>{r.isPermanent ? "301 Permanent" : "302 Temporär"}</span>
                      <span className={r.isActive ? "text-emerald-600" : "text-rose-600"}>
                        {r.isActive ? "Aktiv" : "Inaktiv"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(r.id, r.isActive)}
                      className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                    >
                      {r.isActive ? "Deaktivieren" : "Aktivieren"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
                      className="flex h-6 w-6 items-center justify-center rounded text-[var(--muted)] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WebsiteSettingsFormV2({ config: initialConfig, approvedDataOnly: initialApprovedDataOnly }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("general");

  // Merge all config fields into one state object
  const [cfg, setCfg] = useState<WebsiteConfigData>(initialConfig);
  const [approvedDataOnly, setApprovedDataOnly] = useState(initialApprovedDataOnly);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const update = (patch: Partial<WebsiteConfigData>) => {
    setCfg((c) => ({ ...c, ...patch }));
    setSaveSuccess(false);
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Save WebsiteConfig
      const cfgRes = await fetch("/api/website-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      if (!cfgRes.ok) {
        const d = await cfgRes.json().catch(() => ({}));
        setSaveError(d?.error ?? "Fehler beim Speichern der Website-Konfiguration.");
        return;
      }

      // Save approvedDataOnly (existing endpoint — unchanged)
      const settingsRes = await fetch("/api/website-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvedDataOnly }),
      });
      if (!settingsRes.ok) {
        const d = await settingsRes.json().catch(() => ({}));
        setSaveError(d?.error ?? "Fehler beim Speichern des Workflows.");
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
    <form onSubmit={handleSave}>
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* ── Tab: Allgemein ───────────────────────────────────────────── */}
      {activeTab === "general" && (
        <div className="space-y-4">
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Website-Identität
              </p>
            </div>
            <div className="sce-detail-section-body space-y-4">
              <SettingsInput
                label="Website-Name"
                placeholder="FC Allschwil"
                value={cfg.siteName ?? ""}
                onChange={(e) => update({ siteName: e.target.value || null })}
              />
              <SettingsTextarea
                label="Website-Beschreibung"
                placeholder="Kurze Beschreibung des Vereins…"
                rows={3}
                value={cfg.siteDescription ?? ""}
                onChange={(e) => update({ siteDescription: e.target.value || null })}
              />
              <SettingsInput
                label="Website-URL"
                type="url"
                placeholder="https://fcallschwil.ch"
                value={cfg.siteUrl ?? ""}
                onChange={(e) => update({ siteUrl: e.target.value || null })}
              />
              <SettingsInput
                label="Kontakt-E-Mail"
                type="email"
                placeholder="info@fcallschwil.ch"
                value={cfg.contactEmail ?? ""}
                onChange={(e) => update({ contactEmail: e.target.value || null })}
              />
            </div>
          </div>

          {/* Vier-Augen-Prinzip — preserved from original settings page */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Redaktioneller Workflow
              </p>
            </div>
            <div className="sce-detail-section-body">
              <Toggle
                label="Vier-Augen-Prinzip (Genehmigungspflicht)"
                checked={approvedDataOnly}
                onChange={setApprovedDataOnly}
                description="Wenn aktiviert, müssen alle Inhalte von einem zweiten Redakteur genehmigt werden, bevor sie veröffentlicht werden."
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: SEO ─────────────────────────────────────────────────── */}
      {activeTab === "seo" && (
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              SEO-Metadaten
            </p>
          </div>
          <div className="sce-detail-section-body space-y-4">
            <SettingsInput
              label="SEO-Titel"
              placeholder="FC Allschwil — Offizieller Klub"
              value={cfg.seoTitle ?? ""}
              onChange={(e) => update({ seoTitle: e.target.value || null })}
              hint="Erscheint im Browser-Tab und Suchergebnis-Titel. Max. 60 Zeichen."
            />
            <SettingsTextarea
              label="Meta-Beschreibung"
              placeholder="Der FC Allschwil ist…"
              rows={3}
              value={cfg.seoDescription ?? ""}
              onChange={(e) => update({ seoDescription: e.target.value || null })}
              hint="120–160 Zeichen empfohlen."
            />
            <SettingsInput
              label="Keywords"
              placeholder="Fussball, Allschwil, FC, Verein…"
              value={cfg.seoKeywords ?? ""}
              onChange={(e) => update({ seoKeywords: e.target.value || null })}
              hint="Komma-getrennte Keywords."
            />
            <SettingsInput
              label="Kanonische URL"
              type="url"
              placeholder="https://fcallschwil.ch"
              value={cfg.canonicalUrl ?? ""}
              onChange={(e) => update({ canonicalUrl: e.target.value || null })}
            />
            <div className="space-y-2">
              <Toggle
                label="Robots: Index"
                checked={cfg.robotsIndex}
                onChange={(v) => update({ robotsIndex: v })}
                description="Erlaubt Suchmaschinen, diese Website zu indexieren."
              />
              <Toggle
                label="Robots: Follow"
                checked={cfg.robotsFollow}
                onChange={(v) => update({ robotsFollow: v })}
                description="Erlaubt Suchmaschinen, Links zu verfolgen."
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Social ──────────────────────────────────────────────── */}
      {activeTab === "social" && (
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Open Graph &amp; Social Media
            </p>
          </div>
          <div className="sce-detail-section-body space-y-4">
            <SettingsInput
              label="OG-Titel"
              placeholder="FC Allschwil"
              value={cfg.ogTitle ?? ""}
              onChange={(e) => update({ ogTitle: e.target.value || null })}
            />
            <SettingsTextarea
              label="OG-Beschreibung"
              rows={2}
              placeholder="Beschreibung für Social-Media-Vorschau…"
              value={cfg.ogDescription ?? ""}
              onChange={(e) => update({ ogDescription: e.target.value || null })}
            />
            <SettingsInput
              label="OG-Bild URL"
              type="url"
              placeholder="https://cdn.example.com/og-image.jpg"
              value={cfg.ogImageUrl ?? ""}
              onChange={(e) => update({ ogImageUrl: e.target.value || null })}
              hint="Empfohlene Größe: 1200×630 px"
            />
            <SettingsInput
              label="Twitter / X Handle"
              placeholder="@fcallschwil"
              value={cfg.twitterHandle ?? ""}
              onChange={(e) => update({ twitterHandle: e.target.value || null })}
            />
            <div>
              <label className={labelClass}>Twitter Card-Typ</label>
              <select
                value={cfg.twitterCard ?? "summary_large_image"}
                onChange={(e) => update({ twitterCard: e.target.value })}
                className="fca-input"
              >
                <option value="summary_large_image">Großes Bild (summary_large_image)</option>
                <option value="summary">Zusammenfassung (summary)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Analytics ───────────────────────────────────────────── */}
      {activeTab === "analytics" && (
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Web-Analytics
            </p>
          </div>
          <div className="sce-detail-section-body space-y-4">
            <SettingsInput
              label="Google Analytics ID"
              placeholder="G-XXXXXXXXXX"
              value={cfg.googleAnalyticsId ?? ""}
              onChange={(e) => update({ googleAnalyticsId: e.target.value || null })}
              hint="Google Analytics 4 Mess-ID"
            />
            <SettingsInput
              label="Google Tag Manager ID"
              placeholder="GTM-XXXXXXX"
              value={cfg.googleTagManagerId ?? ""}
              onChange={(e) => update({ googleTagManagerId: e.target.value || null })}
            />
            <SettingsInput
              label="Facebook Pixel ID"
              placeholder="1234567890"
              value={cfg.facebookPixelId ?? ""}
              onChange={(e) => update({ facebookPixelId: e.target.value || null })}
            />
            <SettingsInput
              label="Plausible Domain"
              placeholder="fcallschwil.ch"
              value={cfg.plausibleDomain ?? ""}
              onChange={(e) => update({ plausibleDomain: e.target.value || null })}
              hint="Domain für datenschutzfreundliches Analytics"
            />
          </div>
        </div>
      )}

      {/* ── Tab: Technisch ───────────────────────────────────────────── */}
      {activeTab === "technical" && (
        <div className="space-y-4">
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Technische Konfiguration
              </p>
            </div>
            <div className="sce-detail-section-body space-y-4">
              <SettingsTextarea
                label="Benutzerdefiniertes Head-HTML"
                rows={5}
                placeholder="<!-- z.B. Custom CSS, Fonts, Tracking-Snippets -->"
                value={cfg.customHeadHtml ?? ""}
                onChange={(e) => update({ customHeadHtml: e.target.value || null })}
                hint="Wird in <head> eingefügt. Mit Vorsicht verwenden."
                className="font-mono text-xs"
              />
              <SettingsTextarea
                label="Benutzerdefiniertes Body-HTML"
                rows={5}
                placeholder="<!-- z.B. Chat-Widget-Script vor </body> -->"
                value={cfg.customBodyHtml ?? ""}
                onChange={(e) => update({ customBodyHtml: e.target.value || null })}
                hint="Wird vor </body> eingefügt."
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Wartungsmodus
              </p>
            </div>
            <div className="sce-detail-section-body space-y-4">
              <Toggle
                label="Wartungsmodus aktivieren"
                checked={cfg.maintenanceMode}
                onChange={(v) => update({ maintenanceMode: v })}
                description="Zeigt eine Wartungsseite für alle Besucher. Admins sind davon ausgenommen."
              />
              {cfg.maintenanceMode && (
                <SettingsInput
                  label="Wartungsnachricht"
                  placeholder="Wir sind gleich zurück. Danke für Ihre Geduld."
                  value={cfg.maintenanceMsg ?? ""}
                  onChange={(e) => update({ maintenanceMsg: e.target.value || null })}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: PWA ─────────────────────────────────────────────────── */}
      {activeTab === "pwa" && (
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Progressive Web App
            </p>
          </div>
          <div className="sce-detail-section-body space-y-4">
            <Toggle
              label="PWA aktivieren"
              checked={cfg.pwaEnabled}
              onChange={(v) => update({ pwaEnabled: v })}
              description="Ermöglicht die Installation der Website als App auf dem Heimbildschirm."
            />
            {cfg.pwaEnabled && (
              <>
                <SettingsInput
                  label="App-Name"
                  placeholder="FC Allschwil"
                  value={cfg.pwaName ?? ""}
                  onChange={(e) => update({ pwaName: e.target.value || null })}
                />
                <SettingsInput
                  label="Kurzname"
                  placeholder="FCA"
                  value={cfg.pwaShortName ?? ""}
                  onChange={(e) => update({ pwaShortName: e.target.value || null })}
                  hint="Max. 12 Zeichen für App-Symbol-Beschriftung"
                />
                <SettingsInput
                  label="Theme-Farbe"
                  type="color"
                  value={cfg.pwaThemeColor ?? "#000000"}
                  onChange={(e) => update({ pwaThemeColor: e.target.value })}
                  hint="Browser-UI-Farbe für die App"
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Cookie ──────────────────────────────────────────────── */}
      {activeTab === "cookie" && (
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Cookie-Einwilligung
            </p>
          </div>
          <div className="sce-detail-section-body space-y-4">
            <Toggle
              label="Cookie-Banner aktivieren"
              checked={cfg.cookieEnabled}
              onChange={(v) => update({ cookieEnabled: v })}
              description="Zeigt einen DSGVO-konformen Cookie-Einwilligungsbanner."
            />
            {cfg.cookieEnabled && (
              <>
                <SettingsTextarea
                  label="Banner-Text"
                  rows={3}
                  placeholder="Wir verwenden Cookies, um Ihnen die bestmögliche Nutzung unserer Website zu ermöglichen…"
                  value={cfg.cookieBannerText ?? ""}
                  onChange={(e) => update({ cookieBannerText: e.target.value || null })}
                />
                <SettingsInput
                  label="Datenschutzrichtlinien-URL"
                  type="url"
                  placeholder="/datenschutz"
                  value={cfg.cookiePolicyUrl ?? ""}
                  onChange={(e) => update({ cookiePolicyUrl: e.target.value || null })}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Weiterleitungen ─────────────────────────────────────── */}
      {activeTab === "redirects" && <RedirectsPanel />}

      {/* ── Save button (not shown on Redirects tab — it manages its own state) */}
      {activeTab !== "redirects" && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {saveError && (
            <p className="text-sm text-rose-600 flex-1">{saveError}</p>
          )}
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Einstellungen gespeichert.
            </span>
          )}
          <button type="submit" disabled={saving} className="fca-button-primary ml-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Speichern…" : "Einstellungen speichern"}
          </button>
        </div>
      )}
    </form>
  );
}
