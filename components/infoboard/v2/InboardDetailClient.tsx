"use client";

/**
 * components/infoboard/v2/InboardDetailClient.tsx
 *
 * Client-side configuration panel for a single Infoboard.
 * Tabs: Übersicht | Anzeige | Gerät
 *
 * Persists changes via PATCH /api/infoboards/[id].
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Save, Monitor, Info, Wifi } from "lucide-react";
import type { InboardRow } from "@/lib/infoboard/types";
import { STATUS_META, TEMPLATE_LABELS, infoboardKioskUrl } from "@/lib/infoboard/types";

type Tab = "uebersicht" | "anzeige" | "geraet";

type InboardDetailClientProps = {
  board: InboardRow;
  tenantName: string;
};

export function InboardDetailClient({ board: initialBoard, tenantName }: InboardDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("uebersicht");
  const [board, setBoard] = useState(initialBoard);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Editable fields state
  const [name, setName] = useState(board.name);
  const [templateType, setTemplateType] = useState(board.templateType);
  const [displayTheme, setDisplayTheme] = useState<string | null>(board.displayTheme);
  const [headerSubtitleEnabled, setHeaderSubtitleEnabled] = useState(board.headerSubtitleEnabled);
  const [headerSubtitleText, setHeaderSubtitleText] = useState(board.headerSubtitleText ?? "");
  const [headerShowTime, setHeaderShowTime] = useState(board.headerShowTime);
  const [headerShowDate, setHeaderShowDate] = useState(board.headerShowDate);
  // headerShowWeather is stored in the DB but the weather widget is not yet rendered.
  // The toggle is intentionally hidden from the UI until the widget is implemented.
  const [announcementEnabled, setAnnouncementEnabled] = useState(board.announcementEnabled);
  const [announcementText, setAnnouncementText] = useState(board.announcementText ?? "");
  const [announcementBgColor, setAnnouncementBgColor] = useState(board.announcementBgColor ?? "#1e3a5f");
  const [announcementTextColor, setAnnouncementTextColor] = useState(board.announcementTextColor ?? "#ffffff");

  const kioskUrl = infoboardKioskUrl(board.slug);
  const statusMeta = STATUS_META[board.status] ?? { label: board.status, color: "gray" };
  const templateLabel = TEMPLATE_LABELS[board.templateType] ?? board.templateType;

  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    const payload: Record<string, unknown> = {};
    if (activeTab === "uebersicht" || activeTab === "anzeige") {
      payload.name = name;
      payload.templateType = templateType;
    }
    if (activeTab === "anzeige") {
      payload.displayTheme = displayTheme;
      payload.headerSubtitleEnabled = headerSubtitleEnabled;
      payload.headerSubtitleText = headerSubtitleEnabled ? (headerSubtitleText || null) : null;
      payload.headerShowTime = headerShowTime;
      payload.headerShowDate = headerShowDate;
      // headerShowWeather not sent — widget not yet implemented
      payload.announcementEnabled = announcementEnabled;
      payload.announcementText = announcementEnabled ? announcementText : null;
      payload.announcementBgColor = announcementEnabled ? announcementBgColor : null;
      payload.announcementTextColor = announcementEnabled ? announcementTextColor : null;
    }

    try {
      const res = await fetch(`/api/infoboards/${board.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error ?? "Fehler beim Speichern.");
        return;
      }

      const { board: updated } = await res.json();
      setBoard(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } catch {
      setSaveError("Netzwerkfehler.");
    } finally {
      setSaving(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "uebersicht", label: "Übersicht" },
    { id: "anzeige", label: "Anzeige" },
    { id: "geraet", label: "Gerät" },
  ];

  return (
    <div className="space-y-6 max-w-[1000px]">
      {/* Board header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
            {templateLabel}
          </p>
          <h2 className="mt-0.5 text-xl font-semibold text-[var(--foreground)]">
            {board.name}
          </h2>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                statusMeta.color === "green"
                  ? "bg-emerald-500"
                  : statusMeta.color === "amber"
                    ? "bg-amber-400"
                    : "bg-[var(--muted)]"
              }`}
            />
            <span className="text-[0.78rem] text-[var(--text-2)]">{statusMeta.label}</span>
          </div>
        </div>
        <Link
          href={kioskUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="fca-button-secondary inline-flex items-center gap-1.5 shrink-0"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Display öffnen
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--border)]">
        <nav className="-mb-px flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 pb-3 text-[0.82rem] font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-[var(--sce-primary)] text-[var(--sce-primary)]"
                  : "border-transparent text-[var(--text-2)] hover:text-[var(--foreground)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "uebersicht" && (
        <div className="space-y-6">
          {/* Status */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-sm font-semibold text-[var(--foreground)]">Status</p>
              </div>
            </div>
            <div className="sce-detail-section-body">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[0.72rem] text-[var(--muted)] uppercase tracking-wide">Status</p>
                  <p className="mt-0.5 text-sm font-medium text-[var(--foreground)]">{statusMeta.label}</p>
                </div>
                <div>
                  <p className="text-[0.72rem] text-[var(--muted)] uppercase tracking-wide">Vorlage</p>
                  <p className="mt-0.5 text-sm font-medium text-[var(--foreground)]">{templateLabel}</p>
                </div>
                <div>
                  <p className="text-[0.72rem] text-[var(--muted)] uppercase tracking-wide">Kiosk-URL</p>
                  <code className="mt-0.5 block text-[0.78rem] font-mono text-[var(--foreground)]">
                    {kioskUrl}
                  </code>
                </div>
                <div>
                  <p className="text-[0.72rem] text-[var(--muted)] uppercase tracking-wide">Hinweisleiste</p>
                  <p className="mt-0.5 text-sm text-[var(--foreground)]">
                    {board.announcementEnabled ? "Aktiv" : "Deaktiviert"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-sm font-semibold text-[var(--foreground)]">Name</p>
            </div>
            <div className="sce-detail-section-body">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                className="w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--sce-primary)]"
              />
              <p className="mt-2 text-[0.72rem] text-[var(--muted)]">
                Ändert nur den Anzeigenamen. Die Kiosk-URL bleibt stabil.
              </p>
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="fca-button-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Speichert…" : saved ? "Gespeichert ✓" : "Speichern"}
            </button>
            {saveError && <p className="text-[0.78rem] text-red-600">{saveError}</p>}
          </div>
        </div>
      )}

      {activeTab === "anzeige" && (
        <div className="space-y-6">
          {/* Theme */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-sm font-semibold text-[var(--foreground)]">Darstellung</p>
              </div>
            </div>
            <div className="sce-detail-section-body space-y-4">
              <div>
                <label className="block text-[0.78rem] font-medium text-[var(--foreground)] mb-1.5">
                  Theme
                </label>
                <select
                  value={displayTheme ?? ""}
                  onChange={(e) => setDisplayTheme(e.target.value || null)}
                  className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                >
                  <option value="">Standard (Mandanten-Einstellung)</option>
                  <option value="DARK">Dunkel</option>
                  <option value="LIGHT">Hell</option>
                </select>
              </div>

              <div>
                <label className="block text-[0.78rem] font-medium text-[var(--foreground)] mb-1.5">
                  Vorlage
                </label>
                <select
                  value={templateType}
                  onChange={(e) => setTemplateType(e.target.value)}
                  className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                >
                  <option value="TAGESUEBERSICHT">Tagesübersicht</option>
                </select>
              </div>
            </div>
          </div>

          {/* Header config */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-sm font-semibold text-[var(--foreground)]">Kopfzeile</p>
            </div>
            <div className="sce-detail-section-body space-y-4">
              <Toggle
                label="Untertitel anzeigen"
                checked={headerSubtitleEnabled}
                onChange={setHeaderSubtitleEnabled}
              />
              {headerSubtitleEnabled && (
                <div>
                  <label className="block text-[0.78rem] text-[var(--muted)] mb-1">
                    Untertitel-Text
                  </label>
                  <input
                    type="text"
                    value={headerSubtitleText}
                    onChange={(e) => setHeaderSubtitleText(e.target.value)}
                    placeholder="Heute auf der Sportanlage"
                    maxLength={200}
                    className="w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                  />
                </div>
              )}
              <Toggle
                label="Uhrzeit anzeigen"
                checked={headerShowTime}
                onChange={setHeaderShowTime}
              />
              <Toggle
                label="Datum anzeigen"
                checked={headerShowDate}
                onChange={setHeaderShowDate}
              />
              {/* Weather toggle deferred — widget not yet implemented */}
            </div>
          </div>

          {/* Announcement */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <p className="text-sm font-semibold text-[var(--foreground)]">Hinweisleiste</p>
            </div>
            <div className="sce-detail-section-body space-y-4">
              <Toggle
                label="Hinweisleiste aktivieren"
                checked={announcementEnabled}
                onChange={setAnnouncementEnabled}
              />
              {announcementEnabled && (
                <>
                  <div>
                    <label className="block text-[0.78rem] text-[var(--muted)] mb-1">
                      Ankündigungstext <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={announcementText}
                      onChange={(e) => setAnnouncementText(e.target.value)}
                      placeholder="z.B. Platz 2 gesperrt – Ausweich auf Platz 3"
                      maxLength={500}
                      className="w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                    />
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <label className="block text-[0.78rem] text-[var(--muted)] mb-1">
                        Hintergrundfarbe
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={announcementBgColor}
                          onChange={(e) => setAnnouncementBgColor(e.target.value)}
                          className="h-8 w-12 cursor-pointer rounded border border-[var(--border)]"
                        />
                        <input
                          type="text"
                          value={announcementBgColor}
                          onChange={(e) => setAnnouncementBgColor(e.target.value)}
                          maxLength={7}
                          className="w-24 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[0.75rem] font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[0.78rem] text-[var(--muted)] mb-1">
                        Textfarbe
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={announcementTextColor}
                          onChange={(e) => setAnnouncementTextColor(e.target.value)}
                          className="h-8 w-12 cursor-pointer rounded border border-[var(--border)]"
                        />
                        <input
                          type="text"
                          value={announcementTextColor}
                          onChange={(e) => setAnnouncementTextColor(e.target.value)}
                          maxLength={7}
                          className="w-24 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[0.75rem] font-mono"
                        />
                      </div>
                    </div>
                  </div>
                  {/* Preview */}
                  {announcementText && (
                    <div
                      className="flex items-center gap-3 rounded-lg px-4 py-3"
                      style={{ backgroundColor: announcementBgColor, color: announcementTextColor }}
                    >
                      <span className="text-lg">📢</span>
                      <p className="text-sm font-medium">{announcementText}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || (announcementEnabled && !announcementText.trim())}
              className="fca-button-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Speichert…" : saved ? "Gespeichert ✓" : "Speichern"}
            </button>
            {announcementEnabled && !announcementText.trim() && (
              <p className="text-[0.78rem] text-amber-600">Ankündigungstext ist erforderlich.</p>
            )}
            {saveError && <p className="text-[0.78rem] text-red-600">{saveError}</p>}
          </div>
        </div>
      )}

      {activeTab === "geraet" && (
        <div className="space-y-6">
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-sm font-semibold text-[var(--foreground)]">Kiosk-URL</p>
              </div>
            </div>
            <div className="sce-detail-section-body space-y-4">
              <div>
                <p className="text-[0.72rem] text-[var(--muted)] uppercase tracking-wide mb-2">
                  Öffentliche Kiosk-Adresse
                </p>
                <code className="block text-sm font-mono text-[var(--foreground)] bg-[var(--surface-3)] rounded-[var(--radius-lg)] px-3 py-2">
                  {typeof window !== "undefined" ? window.location.origin : ""}
                  {kioskUrl}
                </code>
                <p className="mt-2 text-[0.72rem] text-[var(--muted)]">
                  Diese URL ist stabil. Sie ändert sich nicht, auch wenn du den Namen des
                  Infoboards änderst. Konfiguriere sie einmalig in deinem Fully Kiosk Browser oder
                  TV-Gerät.
                </p>
              </div>

              <div className="flex gap-2">
                <Link
                  href={kioskUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="fca-button-secondary inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Kiosk öffnen
                </Link>
              </div>

              <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-3)] px-4 py-3">
                <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">
                  Hinweis
                </p>
                <p className="text-[0.8rem] text-[var(--text-2)]">
                  Der Slug <code className="font-mono text-[0.75rem] text-[var(--foreground)]">{board.slug}</code> wurde
                  bei der Erstellung des Infoboards automatisch generiert und ist unveränderlich.
                  Kein Gerätepairing notwendig — die URL ist öffentlich zugänglich.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Toggle helper ─────────────────────────────────────────────────────────────

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`h-5 w-9 rounded-full transition-colors ${
            checked ? "bg-[var(--sce-primary)]" : "bg-[var(--surface-3)]"
          }`}
        >
          <div
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              checked ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </div>
      </div>
      <span className="text-sm text-[var(--foreground)]">{label}</span>
    </label>
  );
}
