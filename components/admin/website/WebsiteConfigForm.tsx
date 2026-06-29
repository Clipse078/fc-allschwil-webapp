"use client";

/**
 * WebsiteConfigForm — CMS V4.2 Website Configuration
 *
 * Full website configuration panel with tabs:
 *   - Allgemein (approvedDataOnly, websiteEnabled indicator)
 *   - SEO (site title, template, description, keywords, canonical)
 *   - Social (OG title, description, image, Twitter/X card)
 *   - Analytics (GA4, GTM)
 *   - Technisch (robots.txt, sitemap, favicon)
 *   - PWA (enabled, name, theme color)
 *   - Cookie Banner (enabled, text, link)
 *   - Weiterleitungen (URL redirect rules)
 */

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Save,
  CheckCircle,
  Globe,
  Search,
  Share2,
  BarChart2,
  Settings,
  Smartphone,
  Cookie,
  ExternalLink,
  Plus,
  Trash2,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";
import type { WebsiteConfigData, WebsiteRedirectItem } from "@/lib/website-config/admin-queries";

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
  approvedDataOnly: boolean;
  config: WebsiteConfigData | null;
  redirects: WebsiteRedirectItem[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const labelClass =
  "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5";

function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="sce-detail-section">
      <div className="sce-detail-section-header">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            {title}
          </p>
          {description && (
            <p className="mt-0.5 text-[11px] text-[var(--text-2)]">{description}</p>
          )}
        </div>
      </div>
      <div className="sce-detail-section-body space-y-4">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
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
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2",
          checked ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]",
        ].join(" ")}
      >
        <span
          aria-hidden="true"
          className={[
            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
            checked ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </button>
      <div>
        <p className="cursor-pointer text-sm font-medium text-[var(--text-1)]">{label}</p>
        {description && (
          <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function WebsiteConfigForm({ approvedDataOnly, config, redirects: initialRedirects }: Props) {
  const router = useRouter();

  // ── Tab state
  const [activeTab, setActiveTab] = useState<Tab>("general");

  // ── General state
  const [approvedOnly, setApprovedOnly] = useState(approvedDataOnly);

  // ── Config state — mirror of WebsiteConfigData
  const [seoSiteTitle, setSeoSiteTitle] = useState(config?.seoSiteTitle ?? "");
  const [seoTitleTemplate, setSeoTitleTemplate] = useState(config?.seoTitleTemplate ?? "%s | %site");
  const [seoDefaultDescription, setSeoDefaultDescription] = useState(config?.seoDefaultDescription ?? "");
  const [seoDefaultKeywords, setSeoDefaultKeywords] = useState(config?.seoDefaultKeywords ?? "");
  const [seoCanonicalBase, setSeoCanonicalBase] = useState(config?.seoCanonicalBase ?? "");
  const [ogTitle, setOgTitle] = useState(config?.ogTitle ?? "");
  const [ogDescription, setOgDescription] = useState(config?.ogDescription ?? "");
  const [ogImageUrl, setOgImageUrl] = useState(config?.ogImageUrl ?? "");
  const [twitterSite, setTwitterSite] = useState(config?.twitterSite ?? "");
  const [twitterCardType, setTwitterCardType] = useState(config?.twitterCardType ?? "summary_large_image");
  const [googleAnalyticsId, setGoogleAnalyticsId] = useState(config?.googleAnalyticsId ?? "");
  const [googleTagManagerId, setGoogleTagManagerId] = useState(config?.googleTagManagerId ?? "");
  const [robotsTxt, setRobotsTxt] = useState(
    config?.robotsTxt ?? "User-agent: *\nAllow: /\n",
  );
  const [sitemapEnabled, setSitemapEnabled] = useState(config?.sitemapEnabled ?? true);
  const [faviconUrl, setFaviconUrl] = useState(config?.faviconUrl ?? "");
  const [pwaEnabled, setPwaEnabled] = useState(config?.pwaEnabled ?? false);
  const [pwaName, setPwaName] = useState(config?.pwaName ?? "");
  const [pwaShortName, setPwaShortName] = useState(config?.pwaShortName ?? "");
  const [pwaThemeColor, setPwaThemeColor] = useState(config?.pwaThemeColor ?? "#ffffff");
  const [pwaBgColor, setPwaBgColor] = useState(config?.pwaBgColor ?? "#ffffff");
  const [cookieBannerEnabled, setCookieBannerEnabled] = useState(config?.cookieBannerEnabled ?? false);
  const [cookieBannerText, setCookieBannerText] = useState(
    config?.cookieBannerText ?? "Wir verwenden Cookies, um Ihre Erfahrung zu verbessern.",
  );
  const [cookieBannerLinkUrl, setCookieBannerLinkUrl] = useState(config?.cookieBannerLinkUrl ?? "/datenschutz");
  const [cookieBannerLinkText, setCookieBannerLinkText] = useState(config?.cookieBannerLinkText ?? "Mehr erfahren");

  // ── Redirects state
  const [redirects, setRedirects] = useState<WebsiteRedirectItem[]>(initialRedirects);
  const [newFrom, setNewFrom] = useState("");
  const [newTo, setNewTo] = useState("");
  const [newCode, setNewCode] = useState<301 | 302>(301);
  const [redirectError, setRedirectError] = useState<string | null>(null);
  const [redirectSaving, setRedirectSaving] = useState(false);

  // ── Save state
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // 1. Save approvedDataOnly (Vier-Augen)
      const generalRes = await fetch("/api/website-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvedDataOnly: approvedOnly }),
      });
      if (!generalRes.ok) {
        const d = await generalRes.json().catch(() => ({}));
        setSaveError(d?.error ?? "Fehler beim Speichern der allgemeinen Einstellungen.");
        return;
      }

      // 2. Save WebsiteConfig
      const configRes = await fetch("/api/website-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seoSiteTitle: seoSiteTitle || null,
          seoTitleTemplate: seoTitleTemplate || null,
          seoDefaultDescription: seoDefaultDescription || null,
          seoDefaultKeywords: seoDefaultKeywords || null,
          seoCanonicalBase: seoCanonicalBase || null,
          ogTitle: ogTitle || null,
          ogDescription: ogDescription || null,
          ogImageUrl: ogImageUrl || null,
          twitterSite: twitterSite || null,
          twitterCardType: twitterCardType || null,
          googleAnalyticsId: googleAnalyticsId || null,
          googleTagManagerId: googleTagManagerId || null,
          robotsTxt: robotsTxt || null,
          sitemapEnabled,
          faviconUrl: faviconUrl || null,
          pwaEnabled,
          pwaName: pwaName || null,
          pwaShortName: pwaShortName || null,
          pwaThemeColor: pwaThemeColor || null,
          pwaBgColor: pwaBgColor || null,
          cookieBannerEnabled,
          cookieBannerText: cookieBannerText || null,
          cookieBannerLinkUrl: cookieBannerLinkUrl || null,
          cookieBannerLinkText: cookieBannerLinkText || null,
        }),
      });
      if (!configRes.ok) {
        const d = await configRes.json().catch(() => ({}));
        setSaveError(d?.error ?? "Fehler beim Speichern der Konfiguration.");
        return;
      }

      setSaveSuccess(true);
      router.refresh();
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch {
      setSaveError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddRedirect() {
    setRedirectError(null);
    if (!newFrom.trim() || !newTo.trim()) {
      setRedirectError("Quell- und Zielpfad sind erforderlich.");
      return;
    }
    setRedirectSaving(true);
    try {
      const res = await fetch("/api/website-redirects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromPath: newFrom.trim(), toPath: newTo.trim(), statusCode: newCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setRedirectError(data?.error ?? "Fehler."); return; }
      setRedirects((prev) => [data.redirect, ...prev]);
      setNewFrom("");
      setNewTo("");
    } catch {
      setRedirectError("Netzwerkfehler.");
    } finally {
      setRedirectSaving(false);
    }
  }

  async function handleDeleteRedirect(id: string) {
    try {
      await fetch(`/api/website-redirects/${id}`, { method: "DELETE" });
      setRedirects((prev) => prev.filter((r) => r.id !== id));
    } catch { /* silent */ }
  }

  async function handleToggleRedirect(redirect: WebsiteRedirectItem) {
    try {
      const res = await fetch(`/api/website-redirects/${redirect.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !redirect.isActive }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setRedirects((prev) => prev.map((r) => r.id === redirect.id ? data.redirect : r));
    } catch { /* silent */ }
  }

  // ── Tabs config
  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: "Allgemein", icon: <Settings className="h-3.5 w-3.5" /> },
    { id: "seo", label: "SEO", icon: <Search className="h-3.5 w-3.5" /> },
    { id: "social", label: "Social", icon: <Share2 className="h-3.5 w-3.5" /> },
    { id: "analytics", label: "Analytics", icon: <BarChart2 className="h-3.5 w-3.5" /> },
    { id: "technical", label: "Technisch", icon: <Globe className="h-3.5 w-3.5" /> },
    { id: "pwa", label: "PWA", icon: <Smartphone className="h-3.5 w-3.5" /> },
    { id: "cookie", label: "Cookie", icon: <Cookie className="h-3.5 w-3.5" /> },
    { id: "redirects", label: "Weiterleitungen", icon: <ArrowRight className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex flex-col gap-0">
      {/* Tabs */}
      <div className="flex flex-wrap gap-0 border-b border-[var(--border)]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              "flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition-colors",
              activeTab === tab.id
                ? "border-b-2 border-[var(--accent)] text-[var(--accent)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]",
            ].join(" ")}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab !== "redirects" ? (
        <form onSubmit={handleSaveConfig} className="space-y-6 p-6">
          {/* General tab */}
          {activeTab === "general" && (
            <SettingsGroup
              title="Redaktioneller Workflow"
              description="Bestimmt wie Inhalte veröffentlicht werden dürfen."
            >
              <Toggle
                checked={approvedOnly}
                onChange={setApprovedOnly}
                label="Vier-Augen-Prinzip aktivieren"
                description="Wenn aktiviert, müssen News und Seiten zur Prüfung eingereicht werden, bevor sie veröffentlicht werden."
              />
            </SettingsGroup>
          )}

          {/* SEO tab */}
          {activeTab === "seo" && (
            <>
              <SettingsGroup
                title="Seitentitel & Meta"
                description="Standardwerte für Suchmaschinen-Indexierung."
              >
                <div>
                  <label className={labelClass}>Website-Name</label>
                  <input type="text" value={seoSiteTitle} onChange={(e) => setSeoSiteTitle(e.target.value)}
                    placeholder="FC Allschwil" className="fca-input" />
                  <p className="mt-1 text-[10px] text-[var(--muted)]">
                    Erscheint als Suffix im Browser-Tab.
                  </p>
                </div>
                <div>
                  <label className={labelClass}>Titel-Template</label>
                  <input type="text" value={seoTitleTemplate} onChange={(e) => setSeoTitleTemplate(e.target.value)}
                    placeholder="%s | FC Allschwil" className="fca-input font-mono text-sm" />
                  <p className="mt-1 text-[10px] text-[var(--muted)]">
                    Verwende %s als Platzhalter für den Seitentitel.
                    Beispiel: <code className="rounded bg-[var(--surface-2)] px-1">News | FC Allschwil</code>
                  </p>
                </div>
                <div>
                  <label className={labelClass}>Standard-Meta-Description</label>
                  <textarea value={seoDefaultDescription} onChange={(e) => setSeoDefaultDescription(e.target.value)}
                    placeholder="Offizielle Website des FC Allschwil…" rows={3}
                    className="fca-input resize-none" maxLength={160} />
                  <p className="mt-1 text-[10px] text-[var(--muted)]">{seoDefaultDescription.length}/160 Zeichen</p>
                </div>
                <div>
                  <label className={labelClass}>Standard-Keywords</label>
                  <input type="text" value={seoDefaultKeywords} onChange={(e) => setSeoDefaultKeywords(e.target.value)}
                    placeholder="Fußball, FC Allschwil, Basel…" className="fca-input" />
                  <p className="mt-1 text-[10px] text-[var(--muted)]">Kommagetrennte Begriffe.</p>
                </div>
                <div>
                  <label className={labelClass}>Kanonische Basis-URL</label>
                  <input type="url" value={seoCanonicalBase} onChange={(e) => setSeoCanonicalBase(e.target.value)}
                    placeholder="https://www.fc-allschwil.ch" className="fca-input font-mono text-sm" />
                  <p className="mt-1 text-[10px] text-[var(--muted)]">
                    Vollständige URL ohne trailing Slash. Wird für canonical-Tags verwendet.
                  </p>
                </div>
              </SettingsGroup>
            </>
          )}

          {/* Social tab */}
          {activeTab === "social" && (
            <>
              <SettingsGroup
                title="Open Graph"
                description="Wie Ihre Website beim Teilen auf Social Media erscheint."
              >
                <div>
                  <label className={labelClass}>OG Titel</label>
                  <input type="text" value={ogTitle} onChange={(e) => setOgTitle(e.target.value)}
                    placeholder="FC Allschwil — Willkommen auf unserer Website"
                    className="fca-input" maxLength={100} />
                </div>
                <div>
                  <label className={labelClass}>OG Beschreibung</label>
                  <textarea value={ogDescription} onChange={(e) => setOgDescription(e.target.value)}
                    placeholder="Alles über unseren Fußballverein…" rows={3}
                    className="fca-input resize-none" maxLength={200} />
                </div>
                <div>
                  <label className={labelClass}>OG Bild-URL</label>
                  <input type="url" value={ogImageUrl} onChange={(e) => setOgImageUrl(e.target.value)}
                    placeholder="https://…/og-image.jpg" className="fca-input font-mono text-sm" />
                  <p className="mt-1 text-[10px] text-[var(--muted)]">
                    Empfohlen: 1200×630 px. Wird angezeigt wenn kein seitenspezifisches Bild vorhanden.
                  </p>
                </div>
              </SettingsGroup>

              <SettingsGroup title="Twitter / X Card">
                <div>
                  <label className={labelClass}>@-Handle</label>
                  <div className="flex items-center gap-0 overflow-hidden rounded-lg border border-[var(--border)]">
                    <span className="bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--muted)]">@</span>
                    <input type="text" value={twitterSite} onChange={(e) => setTwitterSite(e.target.value.replace(/^@/, ""))}
                      placeholder="fcallschwil" className="flex-1 bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Card-Typ</label>
                  <select value={twitterCardType} onChange={(e) => setTwitterCardType(e.target.value)}
                    className="fca-input">
                    <option value="summary">Summary (klein)</option>
                    <option value="summary_large_image">Summary Large Image (groß)</option>
                  </select>
                </div>
              </SettingsGroup>
            </>
          )}

          {/* Analytics tab */}
          {activeTab === "analytics" && (
            <SettingsGroup
              title="Tracking & Analyse"
              description="Externe Analytics-Dienste einbinden."
            >
              <div>
                <label className={labelClass}>Google Analytics 4 ID</label>
                <input type="text" value={googleAnalyticsId} onChange={(e) => setGoogleAnalyticsId(e.target.value)}
                  placeholder="G-XXXXXXXXXX" className="fca-input font-mono" />
                <p className="mt-1 text-[10px] text-[var(--muted)]">
                  Measurement ID im Format G-XXXXXXXXXX. Leer lassen um GA4 zu deaktivieren.
                </p>
              </div>
              <div>
                <label className={labelClass}>Google Tag Manager ID</label>
                <input type="text" value={googleTagManagerId} onChange={(e) => setGoogleTagManagerId(e.target.value)}
                  placeholder="GTM-XXXXXXX" className="fca-input font-mono" />
                <p className="mt-1 text-[10px] text-[var(--muted)]">
                  Container-ID im Format GTM-XXXXXXX. Leer lassen um GTM zu deaktivieren.
                </p>
              </div>
            </SettingsGroup>
          )}

          {/* Technical tab */}
          {activeTab === "technical" && (
            <>
              <SettingsGroup
                title="robots.txt"
                description="Steuert wie Suchmaschinen Ihre Website crawlen."
              >
                <textarea
                  value={robotsTxt}
                  onChange={(e) => setRobotsTxt(e.target.value)}
                  rows={8}
                  className="fca-input resize-y font-mono text-xs"
                  placeholder={"User-agent: *\nAllow: /\n"}
                />
                <p className="text-[10px] text-[var(--muted)]">
                  Standard: <code className="rounded bg-[var(--surface-2)] px-1">User-agent: *{"\n"}Allow: /</code>
                </p>
              </SettingsGroup>

              <SettingsGroup title="Sitemap">
                <Toggle
                  checked={sitemapEnabled}
                  onChange={setSitemapEnabled}
                  label="Sitemap.xml aktivieren"
                  description="Generiert eine automatische /sitemap.xml für Suchmaschinen."
                />
              </SettingsGroup>

              <SettingsGroup title="Favicon">
                <div>
                  <label className={labelClass}>Favicon-URL</label>
                  <input type="url" value={faviconUrl} onChange={(e) => setFaviconUrl(e.target.value)}
                    placeholder="https://…/favicon.ico" className="fca-input font-mono text-sm" />
                  <p className="mt-1 text-[10px] text-[var(--muted)]">
                    Absolute URL zu einer .ico oder .png Datei. Nutzen Sie die Mediathek für Uploads.
                  </p>
                  {faviconUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={faviconUrl} alt="Favicon Vorschau" className="h-8 w-8 rounded object-contain border border-[var(--border)]" />
                      <span className="text-xs text-[var(--muted)]">Vorschau</span>
                    </div>
                  )}
                </div>
              </SettingsGroup>
            </>
          )}

          {/* PWA tab */}
          {activeTab === "pwa" && (
            <SettingsGroup
              title="Progressive Web App"
              description="Erlaubt Nutzern die Website als App zu installieren."
            >
              <Toggle
                checked={pwaEnabled}
                onChange={setPwaEnabled}
                label="PWA aktivieren"
                description="Fügt ein Web-App-Manifest hinzu und ermöglicht Installation als App."
              />
              {pwaEnabled && (
                <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
                  <div>
                    <label className={labelClass}>App-Name</label>
                    <input type="text" value={pwaName} onChange={(e) => setPwaName(e.target.value)}
                      placeholder="FC Allschwil" className="fca-input" />
                  </div>
                  <div>
                    <label className={labelClass}>Kurzname</label>
                    <input type="text" value={pwaShortName} onChange={(e) => setPwaShortName(e.target.value)}
                      placeholder="FCA" className="fca-input" maxLength={12} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Theme-Farbe</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={pwaThemeColor} onChange={(e) => setPwaThemeColor(e.target.value)}
                          className="h-9 w-12 cursor-pointer rounded border border-[var(--border)] p-1" />
                        <input type="text" value={pwaThemeColor} onChange={(e) => setPwaThemeColor(e.target.value)}
                          placeholder="#ffffff" className="fca-input flex-1 font-mono text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Hintergrundfarbe</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={pwaBgColor} onChange={(e) => setPwaBgColor(e.target.value)}
                          className="h-9 w-12 cursor-pointer rounded border border-[var(--border)] p-1" />
                        <input type="text" value={pwaBgColor} onChange={(e) => setPwaBgColor(e.target.value)}
                          placeholder="#ffffff" className="fca-input flex-1 font-mono text-sm" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </SettingsGroup>
          )}

          {/* Cookie Banner tab */}
          {activeTab === "cookie" && (
            <SettingsGroup
              title="Cookie-Banner"
              description="Datenschutz-Hinweis für Websitebesucher."
            >
              <Toggle
                checked={cookieBannerEnabled}
                onChange={setCookieBannerEnabled}
                label="Cookie-Banner aktivieren"
                description="Zeigt einen Hinweis zur Cookie-Nutzung beim ersten Besuch."
              />
              {cookieBannerEnabled && (
                <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
                  <div>
                    <label className={labelClass}>Bannertext</label>
                    <textarea value={cookieBannerText} onChange={(e) => setCookieBannerText(e.target.value)}
                      placeholder="Wir verwenden Cookies…" rows={3} className="fca-input resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Link-Text</label>
                      <input type="text" value={cookieBannerLinkText} onChange={(e) => setCookieBannerLinkText(e.target.value)}
                        placeholder="Mehr erfahren" className="fca-input" />
                    </div>
                    <div>
                      <label className={labelClass}>Link-URL</label>
                      <input type="text" value={cookieBannerLinkUrl} onChange={(e) => setCookieBannerLinkUrl(e.target.value)}
                        placeholder="/datenschutz" className="fca-input font-mono text-sm" />
                    </div>
                  </div>
                  {/* Preview */}
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">Vorschau</p>
                    <div className="rounded-lg border border-[var(--border)] bg-gray-900 p-3 text-white">
                      <p className="text-xs">{cookieBannerText || "Kein Text."}</p>
                      {cookieBannerLinkText && cookieBannerLinkUrl && (
                        <a href="#" className="mt-1.5 inline-block text-xs text-blue-400 underline" onClick={(e) => e.preventDefault()}>
                          {cookieBannerLinkText} →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </SettingsGroup>
          )}

          {/* Errors */}
          {saveError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {saveError}
            </div>
          )}
          {saveSuccess && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 shrink-0" />
              Einstellungen gespeichert.
            </div>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="fca-button-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Speichern…" : "Einstellungen speichern"}
            </button>
          </div>
        </form>
      ) : (
        /* Redirects tab — separate UI, no save button */
        <div className="p-6 space-y-6">
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            <p className="font-semibold">URL-Weiterleitungen (Redirects)</p>
            <p className="mt-0.5 text-xs">
              Weiterleitung von alten URLs auf neue Seiten. Wichtig nach Website-Relaunch oder umbenannten Seiten.
              301 = permanent (Suchmaschinen übernehmen neue URL), 302 = temporär.
            </p>
          </div>

          {/* Add redirect form */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Neue Weiterleitung
            </p>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_auto]">
              <div>
                <label className="mb-1 block text-[10px] text-[var(--muted)]">Von (Quellpfad)</label>
                <input type="text" value={newFrom} onChange={(e) => setNewFrom(e.target.value)}
                  placeholder="/alte-seite" className="fca-input font-mono text-xs" />
              </div>
              <div className="flex items-end pb-2">
                <ArrowRight className="h-4 w-4 text-[var(--muted)]" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-[var(--muted)]">Zu (Zielpfad)</label>
                <input type="text" value={newTo} onChange={(e) => setNewTo(e.target.value)}
                  placeholder="/neue-seite" className="fca-input font-mono text-xs" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-[var(--muted)]">Typ</label>
                <select value={newCode} onChange={(e) => setNewCode(Number(e.target.value) as 301 | 302)}
                  className="fca-input text-xs">
                  <option value={301}>301 Permanent</option>
                  <option value={302}>302 Temporär</option>
                </select>
              </div>
              <div className="flex items-end">
                <button type="button" onClick={handleAddRedirect} disabled={redirectSaving}
                  className="fca-button-primary text-xs">
                  {redirectSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Hinzufügen
                </button>
              </div>
            </div>
            {redirectError && (
              <p className="mt-2 text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-1.5">{redirectError}</p>
            )}
          </div>

          {/* Redirects list */}
          {redirects.length === 0 ? (
            <div className="py-12 text-center">
              <ArrowRight className="mx-auto mb-2 h-8 w-8 text-[var(--muted)]" />
              <p className="text-sm text-[var(--muted)]">Noch keine Weiterleitungen konfiguriert.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">Von</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">Zu</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">Typ</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">Status</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {redirects.map((r) => (
                    <tr key={r.id} className={`hover:bg-[var(--surface-2)] transition-colors ${!r.isActive ? "opacity-50" : ""}`}>
                      <td className="px-4 py-2.5 font-mono text-xs text-[var(--text-2)]">{r.fromPath}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-[var(--text-2)]">{r.toPath}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${r.statusCode === 301 ? "border-blue-200 bg-blue-50 text-blue-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                          {r.statusCode}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${r.isActive ? "text-emerald-600" : "text-[var(--muted)]"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${r.isActive ? "bg-emerald-500" : "bg-gray-300"}`} />
                          {r.isActive ? "Aktiv" : "Inaktiv"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => handleToggleRedirect(r)}
                            className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] transition-colors">
                            {r.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                          <button type="button" onClick={() => handleDeleteRedirect(r.id)}
                            className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
