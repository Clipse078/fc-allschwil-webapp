"use client";

/**
 * components/infoboard/v2/InboardDetailClient.tsx
 *
 * Client-side configuration panel for a single Infoboard.
 * Tabs: Übersicht | Anzeige | Gerät
 *
 * Persists changes via PATCH /api/infoboards/[id].
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ExternalLink,
  Save,
  Monitor,
  Wifi,
  Copy,
  Check,
  Megaphone,
} from "lucide-react";
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
  const [copying, setCopying] = useState(false);

  // Editable fields state
  const [name, setName] = useState(board.name);
  const [templateType, setTemplateType] = useState(board.templateType);
  const [displayTheme, setDisplayTheme] = useState<string | null>(board.displayTheme);
  const [headerSubtitleEnabled, setHeaderSubtitleEnabled] = useState(board.headerSubtitleEnabled);
  const [headerSubtitleText, setHeaderSubtitleText] = useState(board.headerSubtitleText ?? "");
  const [headerShowTime, setHeaderShowTime] = useState(board.headerShowTime);
  const [headerShowDate, setHeaderShowDate] = useState(board.headerShowDate);
  const [announcementEnabled, setAnnouncementEnabled] = useState(board.announcementEnabled);
  const [announcementText, setAnnouncementText] = useState(board.announcementText ?? "");
  const [announcementBgColor, setAnnouncementBgColor] = useState(board.announcementBgColor ?? "#1e3a5f");
  const [announcementTextColor, setAnnouncementTextColor] = useState(board.announcementTextColor ?? "#ffffff");

  const kioskUrl = infoboardKioskUrl(board.slug);
  const statusMeta = STATUS_META[board.status] ?? { label: board.status, color: "gray" };
  const templateLabel = TEMPLATE_LABELS[board.templateType] ?? board.templateType;

  const statusBadgeClass =
    statusMeta.color === "green"
      ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/25"
      : statusMeta.color === "amber"
        ? "bg-amber-400/10 text-amber-700 border border-amber-400/25"
        : "bg-[var(--surface-3)] text-[var(--muted)] border border-[var(--border)]";

  const statusDotClass =
    statusMeta.color === "green"
      ? "bg-emerald-500"
      : statusMeta.color === "amber"
        ? "bg-amber-400"
        : "bg-[var(--muted)]";

  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    const payload: Record<string, unknown> = {};
    if (activeTab === "uebersicht") {
      payload.name = name;
    }
    if (activeTab === "anzeige") {
      payload.name = name;
      payload.templateType = templateType;
      payload.displayTheme = displayTheme;
      payload.headerSubtitleEnabled = headerSubtitleEnabled;
      payload.headerSubtitleText = headerSubtitleEnabled ? (headerSubtitleText || null) : null;
      payload.headerShowTime = headerShowTime;
      payload.headerShowDate = headerShowDate;
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

  async function handleCopyKioskUrl() {
    setCopying(true);
    try {
      const fullUrl = `${window.location.origin}${kioskUrl}`;
      await navigator.clipboard.writeText(fullUrl);
    } finally {
      setTimeout(() => setCopying(false), 1800);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "uebersicht", label: "Übersicht" },
    { id: "anzeige", label: "Anzeige" },
    { id: "geraet", label: "Gerät" },
  ];

  const canSave =
    activeTab !== "anzeige" || !announcementEnabled || announcementText.trim().length > 0;

  return (
    <div className="space-y-5 max-w-[900px]">
      {/* ── Board header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 py-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-[var(--foreground)] truncate">
              {board.name}
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold shrink-0 ${statusBadgeClass}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${statusDotClass}`} />
              {statusMeta.label}
            </span>
          </div>
          <p className="mt-0.5 text-[0.75rem] text-[var(--muted)] font-mono truncate">
            {kioskUrl}
          </p>
        </div>
        <Link
          href={kioskUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="fca-button-secondary inline-flex items-center gap-1.5 text-[0.78rem] shrink-0"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          Display öffnen
        </Link>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-[var(--border)]">
        <nav className="-mb-px flex gap-5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 pb-2.5 text-[0.82rem] font-medium transition-colors ${
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

      {/* ── Tab: Übersicht ────────────────────────────────────────────────── */}
      {activeTab === "uebersicht" && (
        <div className="space-y-5">
          {/* Basisinformationen + Kiosk URL — two-column compact layout */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Basisinformationen */}
            <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                Basisinformationen
              </p>
              <div className="space-y-2.5">
                <InfoRow label="Status">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ${statusBadgeClass}`}>
                    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${statusDotClass}`} />
                    {statusMeta.label}
                  </span>
                </InfoRow>
                <InfoRow label="Vorlage">
                  <span className="text-[0.8rem] text-[var(--foreground)]">{templateLabel}</span>
                </InfoRow>
                <InfoRow label="Theme">
                  <span className="text-[0.8rem] text-[var(--foreground)]">
                    {displayTheme === "LIGHT" ? "Hell" : "Dunkel"}
                  </span>
                </InfoRow>
                <InfoRow label="Hinweisleiste">
                  <span className={`text-[0.8rem] ${board.announcementEnabled ? "text-blue-600" : "text-[var(--muted)]"}`}>
                    {board.announcementEnabled ? "Aktiv" : "Deaktiviert"}
                  </span>
                </InfoRow>
              </div>
            </div>

            {/* Kiosk-URL */}
            <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                Kiosk-URL
              </p>
              <code className="block text-[0.78rem] font-mono text-[var(--foreground)] bg-[var(--surface-3)] rounded-[var(--radius-lg)] px-3 py-2 break-all">
                {typeof window !== "undefined" ? window.location.origin : ""}{kioskUrl}
              </code>
              <div className="flex gap-2">
                <button
                  onClick={() => void handleCopyKioskUrl()}
                  className="fca-button-secondary inline-flex items-center gap-1.5 text-[0.76rem] px-3 py-1.5"
                >
                  {copying ? (
                    <Check className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3 w-3" aria-hidden="true" />
                  )}
                  {copying ? "Kopiert" : "Kopieren"}
                </button>
                <Link
                  href={kioskUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="fca-button-secondary inline-flex items-center gap-1.5 text-[0.76rem] px-3 py-1.5"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  Öffnen
                </Link>
              </div>
            </div>
          </div>

          {/* Editable name */}
          <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
              Name
            </p>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                className="flex-1 max-w-sm rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--sce-primary)]"
              />
              <button
                onClick={() => void handleSave()}
                disabled={saving || !name.trim()}
                className="fca-button-primary inline-flex items-center gap-2 disabled:opacity-50 shrink-0"
              >
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                {saving ? "Speichert…" : saved ? "Gespeichert ✓" : "Speichern"}
              </button>
            </div>
            <p className="text-[0.7rem] text-[var(--muted)]">
              Ändert nur den Anzeigenamen — die Kiosk-URL bleibt stabil.
            </p>
            {saveError && <p className="text-[0.78rem] text-red-600">{saveError}</p>}
          </div>
        </div>
      )}

      {/* ── Tab: Anzeige ─────────────────────────────────────────────────── */}
      {activeTab === "anzeige" && (
        <div className="space-y-4">
          {/* Darstellung */}
          <SettingsSection title="Darstellung" icon={<Monitor className="h-3.5 w-3.5" />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[0.75rem] font-medium text-[var(--foreground)] mb-1.5">
                  Theme
                </label>
                <select
                  value={displayTheme ?? ""}
                  onChange={(e) => setDisplayTheme(e.target.value || null)}
                  className="w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                >
                  <option value="">Standard (Mandanten-Einstellung)</option>
                  <option value="DARK">Dunkel</option>
                  <option value="LIGHT">Hell</option>
                </select>
              </div>
              <div>
                <label className="block text-[0.75rem] font-medium text-[var(--foreground)] mb-1.5">
                  Vorlage
                </label>
                <select
                  value={templateType}
                  onChange={(e) => setTemplateType(e.target.value)}
                  className="w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                >
                  <option value="TAGESUEBERSICHT">Tagesübersicht</option>
                </select>
              </div>
            </div>
          </SettingsSection>

          {/* Kopfzeile */}
          <SettingsSection title="Kopfzeile">
            <div className="space-y-3">
              <Toggle
                label="Untertitel anzeigen"
                checked={headerSubtitleEnabled}
                onChange={setHeaderSubtitleEnabled}
              />
              {headerSubtitleEnabled && (
                <div className="pl-12">
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
            </div>
          </SettingsSection>

          {/* Hinweisleiste */}
          <SettingsSection
            title="Hinweisleiste"
            icon={<Megaphone className="h-3.5 w-3.5" />}
          >
            <div className="space-y-4">
              <Toggle
                label="Hinweisleiste aktivieren"
                checked={announcementEnabled}
                onChange={setAnnouncementEnabled}
              />

              {announcementEnabled && (
                <div className="space-y-4 pl-12">
                  {/* Text input */}
                  <div>
                    <label className="block text-[0.75rem] font-medium text-[var(--foreground)] mb-1.5">
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
                    {!announcementText.trim() && (
                      <p className="mt-1 text-[0.72rem] text-amber-600">
                        Text ist erforderlich wenn die Hinweisleiste aktiv ist.
                      </p>
                    )}
                  </div>

                  {/* Color pickers */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ColorField
                      label="Hintergrundfarbe"
                      value={announcementBgColor}
                      onChange={setAnnouncementBgColor}
                    />
                    <ColorField
                      label="Textfarbe"
                      value={announcementTextColor}
                      onChange={setAnnouncementTextColor}
                    />
                  </div>

                  {/* Live preview */}
                  {announcementText.trim() && (
                    <div>
                      <p className="text-[0.72rem] font-medium text-[var(--muted)] mb-1.5 uppercase tracking-wide">
                        Vorschau
                      </p>
                      <div
                        className="flex items-center gap-2.5 rounded-lg px-4 py-2.5 overflow-hidden"
                        style={{
                          backgroundColor: announcementBgColor,
                          color: announcementTextColor,
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          style={{ flexShrink: 0 }}
                        >
                          <path d="M11 5L6 9H2v6h4l5 4V5z" />
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        </svg>
                        <p
                          className="text-[0.8rem] font-semibold uppercase tracking-wider truncate"
                          style={{ fontFamily: "var(--font-display, 'Barlow Condensed', sans-serif)", letterSpacing: "0.10em" }}
                        >
                          {announcementText}
                        </p>
                      </div>
                      <p className="mt-1 text-[0.68rem] text-[var(--muted)]">
                        Lange Texte scrollen automatisch auf dem Display.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </SettingsSection>

          {/* Save */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => void handleSave()}
              disabled={saving || !canSave}
              className="fca-button-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              {saving ? "Speichert…" : saved ? "Gespeichert ✓" : "Speichern"}
            </button>
            {saveError && <p className="text-[0.78rem] text-red-600">{saveError}</p>}
          </div>
        </div>
      )}

      {/* ── Tab: Gerät ───────────────────────────────────────────────────── */}
      {activeTab === "geraet" && (
        <div className="space-y-4 max-w-lg">
          {/* Kiosk-URL */}
          <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Wifi className="h-3.5 w-3.5 text-[var(--muted)]" aria-hidden="true" />
              <p className="text-[0.82rem] font-semibold text-[var(--foreground)]">Kiosk-URL</p>
            </div>
            <code className="block text-[0.82rem] font-mono text-[var(--foreground)] bg-[var(--surface-3)] rounded-[var(--radius-lg)] px-3 py-2 break-all">
              {typeof window !== "undefined" ? window.location.origin : ""}{kioskUrl}
            </code>
            <div className="flex gap-2">
              <button
                onClick={() => void handleCopyKioskUrl()}
                className="fca-button-secondary inline-flex items-center gap-1.5 text-[0.78rem]"
              >
                {copying ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {copying ? "Kopiert" : "Kopieren"}
              </button>
              <Link
                href={kioskUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="fca-button-secondary inline-flex items-center gap-1.5 text-[0.78rem]"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Kiosk öffnen
              </Link>
            </div>
          </div>

          {/* Guidance */}
          <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-3)] p-4">
            <p className="text-[0.78rem] font-semibold text-[var(--foreground)] mb-1.5">
              Verwendung im Kiosk-Modus
            </p>
            <p className="text-[0.78rem] text-[var(--text-2)] leading-relaxed">
              Öffne diese URL einmalig in einem Vollbild-Browser (z.&nbsp;B. Fully Kiosk Browser oder
              TV-Kiosk-Modus) und speichere sie als Startseite. Das Display aktualisiert sich
              automatisch — kein weiteres Pairing notwendig.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[0.72rem] text-[var(--muted)] shrink-0">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function SettingsSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3 bg-[var(--surface-3)]">
        {icon && <span className="text-[var(--muted)]">{icon}</span>}
        <p className="text-[0.78rem] font-semibold text-[var(--foreground)]">{title}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[0.75rem] font-medium text-[var(--foreground)] mb-1.5">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
            id={`color-${label}`}
          />
          <label
            htmlFor={`color-${label}`}
            className="block h-8 w-8 cursor-pointer rounded-md border-2 border-[var(--border)] shadow-sm"
            style={{ backgroundColor: value }}
            aria-label={label}
          />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
          className="w-24 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[0.75rem] font-mono text-[var(--foreground)]"
        />
      </div>
    </div>
  );
}

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
      <div className="relative shrink-0">
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
      <span className="text-[0.85rem] text-[var(--foreground)]">{label}</span>
    </label>
  );
}
