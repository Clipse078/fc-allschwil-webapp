"use client";

/**
 * components/infoboard/v2/InboardDetailClient.tsx
 *
 * Premium Infoboard detail shell — INFOBOARD-DESIGNER-01
 *
 * Tabs: Übersicht | Designer | Inhalte | Anzeige | Gerät
 *
 * Design philosophy (Škoda-like):
 *   - Infoboard itself is the hero of the experience
 *   - Strong defaults, controlled customisation
 *   - Changes reflect immediately in live preview
 *   - No giant whitespace; compact, purposeful layout
 *
 * Architecture:
 *   - Server: loads board from DB (InboardDetailPage)
 *   - Client: this component manages tab state + board state
 *   - Designer tab delegates to InboardDesignerClient (3-panel UX)
 *   - Individual tab saves via PATCH /api/infoboards/[id]
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ExternalLink,
  Save,
  ChevronLeft,
  Copy,
  Check,
  MoreHorizontal,
  Monitor,
  Wifi,
} from "lucide-react";
import type { InboardRow } from "@/lib/infoboard/types";
import { STATUS_META, TEMPLATE_LABELS, infoboardKioskUrl } from "@/lib/infoboard/types";
import type { AnlageplanResourceOption } from "@/lib/infoboard/anlageplan-types";
import { InboardDesignerClient } from "./designer/InboardDesignerClient";
import { AnlageplanDesignerClient } from "./designer/anlageplan/AnlageplanDesignerClient";

// ── Tab model ─────────────────────────────────────────────────────────────────

type Tab = "uebersicht" | "designer" | "inhalte" | "anzeige" | "geraet";

const TABS: { id: Tab; label: string }[] = [
  { id: "uebersicht", label: "Übersicht" },
  { id: "designer", label: "Designer" },
  { id: "inhalte", label: "Inhalte" },
  { id: "anzeige", label: "Anzeige" },
  { id: "geraet", label: "Gerät" },
];

// ── Component ─────────────────────────────────────────────────────────────────

type InboardDetailClientProps = {
  board: InboardRow;
  tenantName: string;
  facilityOptions?: AnlageplanResourceOption[];
};

export function InboardDetailClient({
  board: initialBoard,
  tenantName,
  facilityOptions = [],
}: InboardDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("uebersicht");
  const [board, setBoard] = useState(initialBoard);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [copying, setCopying] = useState(false);

  // Anzeige tab state
  const [displayTheme, setDisplayTheme] = useState<string | null>(board.displayTheme);
  const [anzeigeNameValue, setAnzeigeNameValue] = useState(board.name);
  const [anzeigeTemplatetype, setAnzeigeTemplatetype] = useState(board.templateType);
  const [anzeigesaving, setAnzeigeSaving] = useState(false);
  const [anzeigesaved, setAnzeigeSaved] = useState(false);
  const [anzeigeError, setAnzeigeError] = useState<string | null>(null);

  // Übersicht name edit state
  const [name, setName] = useState(board.name);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const kioskUrl = infoboardKioskUrl(board.slug);
  const fullKioskUrl =
    typeof window !== "undefined" ? `${window.location.origin}${kioskUrl}` : kioskUrl;

  const statusMeta = STATUS_META[board.status] ?? { label: board.status, color: "gray" };

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

  async function handleCopyKioskUrl() {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(fullKioskUrl);
    } finally {
      setTimeout(() => setCopying(false), 1800);
    }
  }

  async function handleSaveName() {
    if (!name.trim()) return;
    setNameSaving(true);
    setNameError(null);
    try {
      const res = await fetch(`/api/infoboards/${board.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setNameError(data.error ?? "Fehler beim Speichern.");
        return;
      }
      const { board: updated } = await res.json() as { board: InboardRow };
      setBoard(updated);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
      router.refresh();
    } catch {
      setNameError("Netzwerkfehler.");
    } finally {
      setNameSaving(false);
    }
  }

  async function handleSaveAnzeige() {
    setAnzeigeSaving(true);
    setAnzeigeError(null);
    try {
      const res = await fetch(`/api/infoboards/${board.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayTheme,
          templateType: anzeigeTemplatetype,
          name: anzeigeNameValue.trim() || board.name,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setAnzeigeError(data.error ?? "Fehler beim Speichern.");
        return;
      }
      const { board: updated } = await res.json() as { board: InboardRow };
      setBoard(updated);
      setAnzeigeSaved(true);
      setTimeout(() => setAnzeigeSaved(false), 2000);
      router.refresh();
    } catch {
      setAnzeigeError("Netzwerkfehler.");
    } finally {
      setAnzeigeSaving(false);
    }
  }

  return (
    <div className="space-y-0">
      {/* ── Premium shell header ──────────────────────────────────────────── */}
      <div className="border-b border-[var(--border)] pb-0">

        {/* Back navigation */}
        <div className="mb-3">
          <Link
            href="/dashboard/infoboard"
            className="inline-flex items-center gap-1 text-[0.78rem] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Infoboards
          </Link>
        </div>

        {/* Board identity row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-[var(--foreground)] truncate">
                {board.name}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.72rem] font-semibold shrink-0 ${statusBadgeClass}`}
                data-testid="board-status-badge"
              >
                <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${statusDotClass}`} />
                {statusMeta.label}
              </span>
              <span className="text-[0.72rem] text-[var(--muted)] font-mono hidden sm:inline-block">
                {kioskUrl}
              </span>
            </div>
            <p className="mt-0.5 text-[0.72rem] text-[var(--muted)]">
              {TEMPLATE_LABELS[board.templateType] ?? board.templateType}
              {" · "}
              {board.displayTheme === "LIGHT" ? "Hell" : "Dunkel"}
            </p>
          </div>

          {/* Primary actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={kioskUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="fca-button-secondary inline-flex items-center gap-1.5 text-[0.78rem]"
              data-testid="open-display-button"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Display öffnen
            </Link>

            {/* Overflow menu */}
            <div className="relative">
              <button
                onClick={() => setOverflowOpen((v) => !v)}
                className="inline-flex items-center justify-center h-8 w-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)] transition-colors"
                aria-label="Mehr Aktionen"
                aria-expanded={overflowOpen}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </button>
              {overflowOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOverflowOpen(false)} />
                  <div className="absolute right-0 top-9 z-20 min-w-[180px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-lg py-1">
                    <button
                      onClick={() => { void handleCopyKioskUrl(); setOverflowOpen(false); }}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[0.8rem] text-[var(--foreground)] hover:bg-[var(--surface-3)]"
                    >
                      <Copy className="h-3.5 w-3.5 text-[var(--muted)]" aria-hidden="true" />
                      URL kopieren
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <nav className="-mb-px flex gap-1 sm:gap-4" aria-label="Infoboard-Navigation" data-testid="detail-tab-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 pb-2.5 px-1 text-[0.82rem] font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "border-[var(--sce-primary)] text-[var(--sce-primary)]"
                  : "border-transparent text-[var(--text-2)] hover:text-[var(--foreground)]"
              }`}
              aria-selected={activeTab === tab.id}
              data-testid={`tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      <div className="pt-5">

        {/* ── ÜBERSICHT ──────────────────────────────────────────────────── */}
        {activeTab === "uebersicht" && (
          <div className="space-y-4 max-w-[860px]" data-testid="tab-content-uebersicht">
            {/* Two-column info grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Board info */}
              <InfoCard label="Basisinformationen">
                <InfoRow label="Status">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ${statusBadgeClass}`}>
                    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${statusDotClass}`} />
                    {statusMeta.label}
                  </span>
                </InfoRow>
                <InfoRow label="Vorlage">
                  <span className="text-[0.8rem] text-[var(--foreground)]">
                    {TEMPLATE_LABELS[board.templateType] ?? board.templateType}
                  </span>
                </InfoRow>
                <InfoRow label="Theme">
                  <span className="text-[0.8rem] text-[var(--foreground)]">
                    {board.displayTheme === "LIGHT" ? "Hell" : "Dunkel"}
                  </span>
                </InfoRow>
                <InfoRow label="Hinweisleiste">
                  <span className={`text-[0.8rem] ${board.announcementEnabled ? "text-blue-600" : "text-[var(--muted)]"}`}>
                    {board.announcementEnabled ? "Aktiv" : "Deaktiviert"}
                  </span>
                </InfoRow>
              </InfoCard>

              {/* Kiosk URL */}
              <InfoCard label="Kiosk-URL">
                <code className="block text-[0.75rem] font-mono text-[var(--foreground)] bg-[var(--surface-3)] rounded-[var(--radius-md)] px-3 py-2 break-all">
                  {fullKioskUrl}
                </code>
                <div className="flex gap-2 mt-2">
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
                <p className="text-[0.7rem] text-[var(--muted)]">
                  Slug: <code className="font-mono">{board.slug}</code> — stabile URL, ändert sich nie.
                </p>
              </InfoCard>
            </div>

            {/* Name edit */}
            <InfoCard label="Anzeigename">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  className="flex-1 max-w-sm rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--sce-primary)]"
                />
                <button
                  onClick={() => void handleSaveName()}
                  disabled={nameSaving || !name.trim() || name.trim() === board.name}
                  className="fca-button-primary inline-flex items-center gap-2 disabled:opacity-50 shrink-0"
                >
                  <Save className="h-3.5 w-3.5" aria-hidden="true" />
                  {nameSaving ? "Speichert…" : nameSaved ? "Gespeichert ✓" : "Speichern"}
                </button>
              </div>
              <p className="text-[0.7rem] text-[var(--muted)]">
                Nur der Anzeigename — die Kiosk-URL bleibt stabil.
              </p>
              {nameError && <p className="text-[0.78rem] text-red-600">{nameError}</p>}
            </InfoCard>
          </div>
        )}

        {/* ── DESIGNER ───────────────────────────────────────────────────── */}
        {activeTab === "designer" && (
          <div data-testid="tab-content-designer">
            {board.templateType === "ANLAGENUEBERSICHT" ? (
              <AnlageplanDesignerClient
                board={board}
                facilityOptions={facilityOptions}
                onBoardChange={(updated) => {
                  setBoard(updated);
                  router.refresh();
                }}
              />
            ) : (
              <InboardDesignerClient
                board={board}
                tenantName={tenantName}
                onBoardChange={(updated) => {
                  setBoard(updated);
                  router.refresh();
                }}
              />
            )}
          </div>
        )}

        {/* ── INHALTE ────────────────────────────────────────────────────── */}
        {activeTab === "inhalte" && (
          <div className="space-y-4 max-w-[680px]" data-testid="tab-content-inhalte">
            <InfoCard label="Tagesübersicht — Inhalt">
              <div className="space-y-3">
                <ContentRow
                  dot="bg-blue-500"
                  title="Trainings"
                  description="Alle heutigen Trainingseinheiten im 4-Stunden-Fenster + ausstehende."
                />
                <ContentRow
                  dot="bg-red-500"
                  title="Heimspiele"
                  description="Heutige Meisterschafts- und Freundschaftsspiele."
                />
                <ContentRow
                  dot="bg-orange-500"
                  title="Turniere und Events"
                  description="Heutige Turniere und Events (wenn als sichtbar markiert)."
                />
              </div>
              <p className="text-[0.72rem] text-[var(--muted)] mt-3 leading-relaxed">
                Inhalte werden über den Spielbetrieb verwaltet. Visibilität pro Eintrag
                separat steuerbar. Zukünftige Inhalte erscheinen automatisch.
              </p>
            </InfoCard>

            <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--border)] bg-[var(--surface-3)] p-4">
              <p className="text-[0.78rem] font-medium text-[var(--foreground)] mb-1">
                Weitere Inhaltstypen
              </p>
              <p className="text-[0.75rem] text-[var(--muted)]">
                Sportanlage-Widget mit Platzzuweisung in Vorbereitung. News, Sponsors
                und Media-Widgets folgen in späteren Versionen.
              </p>
            </div>
          </div>
        )}

        {/* ── ANZEIGE ────────────────────────────────────────────────────── */}
        {activeTab === "anzeige" && (
          <div className="space-y-4 max-w-[600px]" data-testid="tab-content-anzeige">
            <InfoCard label="Darstellung" icon={<Monitor className="h-3.5 w-3.5" />}>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[0.75rem] font-medium text-[var(--foreground)] mb-1.5">
                      Theme
                    </label>
                    <select
                      value={displayTheme ?? ""}
                      onChange={(e) => {
                        setDisplayTheme(e.target.value || null);
                        setAnzeigeSaved(false);
                      }}
                      className="w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                    >
                      <option value="">Standard (Mandanten-Einstellung)</option>
                      <option value="DARK">Dunkel</option>
                      <option value="LIGHT">Hell</option>
                    </select>
                    <p className="mt-1 text-[0.7rem] text-[var(--muted)]">
                      Globales Farbschema des Displays.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[0.75rem] font-medium text-[var(--foreground)] mb-1.5">
                      Vorlage
                    </label>
                    <select
                      value={anzeigeTemplatetype}
                      onChange={(e) => {
                        setAnzeigeTemplatetype(e.target.value);
                        setAnzeigeSaved(false);
                      }}
                      className="w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                    >
                      <option value="TAGESUEBERSICHT">Tagesübersicht</option>
                      <option value="ANLAGENUEBERSICHT">Anlagenübersicht (Anlageplan)</option>
                    </select>
                  </div>
                </div>

                <p className="text-[0.72rem] text-[var(--muted)]">
                  Kopfzeile, Hinweisleiste und Widget-Layout werden im Designer konfiguriert.
                </p>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => void handleSaveAnzeige()}
                    disabled={anzeigesaving}
                    className="fca-button-primary inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                    {anzeigesaving ? "Speichert…" : anzeigesaved ? "Gespeichert ✓" : "Speichern"}
                  </button>
                  {anzeigeError && (
                    <p className="text-[0.78rem] text-red-600">{anzeigeError}</p>
                  )}
                </div>
              </div>
            </InfoCard>
          </div>
        )}

        {/* ── GERÄT ──────────────────────────────────────────────────────── */}
        {activeTab === "geraet" && (
          <div className="space-y-4 max-w-[540px]" data-testid="tab-content-geraet">
            <InfoCard label="Kiosk-URL" icon={<Wifi className="h-3.5 w-3.5" />}>
              <code className="block text-[0.82rem] font-mono text-[var(--foreground)] bg-[var(--surface-3)] rounded-[var(--radius-lg)] px-3 py-2 break-all">
                {fullKioskUrl}
              </code>
              <div className="flex gap-2 mt-3">
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
            </InfoCard>

            <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-3)] p-4">
              <p className="text-[0.82rem] font-semibold text-[var(--foreground)] mb-2">
                Kiosk-Modus einrichten
              </p>
              <ol className="space-y-2 list-decimal list-inside">
                <li className="text-[0.78rem] text-[var(--text-2)]">
                  URL oben kopieren.
                </li>
                <li className="text-[0.78rem] text-[var(--text-2)]">
                  Vollbild-Browser öffnen (z.&nbsp;B. <em>Fully Kiosk Browser</em> oder TV-Kiosk-Modus).
                </li>
                <li className="text-[0.78rem] text-[var(--text-2)]">
                  URL als Startseite eintragen und Vollbild aktivieren.
                </li>
              </ol>
              <p className="mt-3 text-[0.72rem] text-[var(--muted)] leading-relaxed">
                Das Display aktualisiert sich automatisch. Kein Pairing oder Registrierung
                notwendig. Die URL ist stabil — auch nach Umbenennungen des Infoboards.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-[0.72rem] text-[var(--muted)] shrink-0">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function InfoCard({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2.5 bg-[var(--surface-3)]">
        {icon && <span className="text-[var(--muted)]">{icon}</span>}
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
          {label}
        </p>
      </div>
      <div className="p-4 space-y-2">{children}</div>
    </div>
  );
}

function ContentRow({
  dot,
  title,
  description,
}: {
  dot: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${dot}`} />
      <div>
        <p className="text-[0.82rem] font-medium text-[var(--foreground)]">{title}</p>
        <p className="text-[0.72rem] text-[var(--muted)]">{description}</p>
      </div>
    </div>
  );
}
