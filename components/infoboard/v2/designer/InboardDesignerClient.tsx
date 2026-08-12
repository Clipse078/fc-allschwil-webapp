"use client";

/**
 * components/infoboard/v2/designer/InboardDesignerClient.tsx
 *
 * Infoboard Designer — 3-panel layout:
 *   LEFT   Widget palette (~210px) — widget types + enable/disable
 *   CENTER Live 16:9 preview (1fr) — same renderer as kiosk, visual focus
 *   RIGHT  Contextual settings (~300px) for the selected widget
 *
 * Design principles (Škoda-like, controlled customisation):
 *   - Preview is the dominant workspace; panels serve it
 *   - Changes reflect immediately in the live preview
 *   - Settings are compact, contextual, grouped
 *   - Selected widget state is unmistakable
 *   - Save state is always visible and accurate
 *
 * Save states:
 *   Unsaved  → amber "Ungespeichert" badge + disabled save button highlighted
 *   Saving   → button text "Speichert…" + spinner, button disabled
 *   Saved    → button text "Gespeichert ✓" + CheckCircle, badge cleared
 *   Failed   → error banner, button re-enabled
 */

import { useState, useCallback } from "react";
import {
  Layers,
  Monitor,
  Megaphone,
  Calendar,
  Save,
  CheckCircle,
  Circle,
  AlertCircle,
  Loader2,
} from "lucide-react";

import { InboardLivePreview } from "../InboardLivePreview";
import { HeaderWidgetPanel } from "./HeaderWidgetPanel";
import { ActivitiesWidgetPanel } from "./ActivitiesWidgetPanel";
import { AnnouncementWidgetPanel } from "./AnnouncementWidgetPanel";

import {
  parseLayoutJson,
  updateWidget,
  findWidget,
  validateLayout,
  WIDGET_LABELS,
  WIDGET_DESCRIPTIONS,
  type WidgetType,
  type InboardLayout,
  type HeaderWidgetSettings,
  type AnnouncementWidgetSettings,
} from "@/lib/infoboard/widget-types";
import type { InboardRow } from "@/lib/infoboard/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type InboardDesignerClientProps = {
  board: InboardRow;
  tenantName: string;
  onBoardChange: (updated: InboardRow) => void;
};

const WIDGET_ICON: Record<WidgetType, React.ReactNode> = {
  HEADER: <Monitor className="h-4 w-4" aria-hidden="true" />,
  ACTIVITIES: <Calendar className="h-4 w-4" aria-hidden="true" />,
  ANNOUNCEMENT: <Megaphone className="h-4 w-4" aria-hidden="true" />,
};

const WIDGET_ORDER: WidgetType[] = ["HEADER", "ACTIVITIES", "ANNOUNCEMENT"];

// ── Component ─────────────────────────────────────────────────────────────────

export function InboardDesignerClient({
  board,
  tenantName,
  onBoardChange,
}: InboardDesignerClientProps) {
  const [layout, setLayout] = useState<InboardLayout>(() =>
    parseLayoutJson(board.layoutJson, board),
  );
  const [selectedWidget, setSelectedWidget] = useState<WidgetType>("HEADER");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // ── Layout mutations ──────────────────────────────────────────────────────

  const setWidgetEnabled = useCallback(
    (type: WidgetType, enabled: boolean) => {
      setLayout((prev) => updateWidget(prev, type, { enabled }));
      setDirty(true);
      setSaved(false);
    },
    [],
  );

  const setWidgetSettings = useCallback(
    (type: WidgetType, settings: Record<string, unknown>) => {
      setLayout((prev) => updateWidget(prev, type, { settings }));
      setDirty(true);
      setSaved(false);
    },
    [],
  );

  // ── Derived preview props ─────────────────────────────────────────────────

  const headerWidget = findWidget(layout, "HEADER");
  const announcementWidget = findWidget(layout, "ANNOUNCEMENT");

  const headerSettings = headerWidget?.settings as HeaderWidgetSettings | undefined;
  const announcementSettings = announcementWidget?.settings as AnnouncementWidgetSettings | undefined;

  const previewHeaderConfig = {
    subtitleEnabled: headerSettings?.subtitleEnabled,
    subtitleText: headerSettings?.subtitleText,
    showTime: headerSettings?.showTime,
    showDate: headerSettings?.showDate,
  };

  const previewAnnouncement =
    announcementWidget?.enabled
      ? {
          enabled: true,
          text: announcementSettings?.text ?? null,
          bgColor: announcementSettings?.bgColor ?? null,
          textColor: announcementSettings?.textColor ?? null,
        }
      : null;

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    const validationError = validateLayout(layout);
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setSaving(true);
    setSaveError(null);

    // Derive flat fields from widget settings (keeps kiosk compat)
    const hSettings = findWidget(layout, "HEADER")
      ?.settings as HeaderWidgetSettings | undefined;
    const annWidget = findWidget(layout, "ANNOUNCEMENT");
    const aSettings = annWidget?.settings as AnnouncementWidgetSettings | undefined;
    const announcementEnabled = annWidget?.enabled ?? false;

    const payload = {
      layoutJson: JSON.stringify(layout),
      // Sync flat fields so kiosk renderer always has current values
      headerSubtitleEnabled: hSettings?.subtitleEnabled ?? true,
      headerSubtitleText: hSettings?.subtitleText ?? null,
      headerShowTime: hSettings?.showTime ?? true,
      headerShowDate: hSettings?.showDate ?? true,
      announcementEnabled,
      announcementText: announcementEnabled ? (aSettings?.text ?? null) : null,
      announcementBgColor: announcementEnabled ? (aSettings?.bgColor ?? null) : null,
      announcementTextColor: announcementEnabled ? (aSettings?.textColor ?? null) : null,
    };

    try {
      const res = await fetch(`/api/infoboards/${board.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setSaveError(data.error ?? "Fehler beim Speichern.");
        return;
      }

      const { board: updated } = await res.json() as { board: InboardRow };
      onBoardChange(updated);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaveError("Netzwerkfehler.");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between gap-3 min-h-[36px]"
        role="toolbar"
        aria-label="Designer-Steuerung"
      >
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />
          <span className="text-[0.8rem] font-medium text-[var(--text-2)]">Designer</span>
          {dirty && !saving && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 border border-amber-400/25 px-2 py-0.5 text-[0.68rem] font-semibold text-amber-600"
              aria-live="polite"
              aria-label="Ungespeicherte Änderungen vorhanden"
            >
              Ungespeichert
            </span>
          )}
          {saving && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-400/20 px-2 py-0.5 text-[0.68rem] font-medium text-blue-600">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              Speichert…
            </span>
          )}
          {saved && !dirty && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-400/20 px-2 py-0.5 text-[0.68rem] font-medium text-emerald-600">
              <CheckCircle className="h-3 w-3" aria-hidden="true" />
              Gespeichert
            </span>
          )}
        </div>
        <button
          onClick={() => void handleSave()}
          disabled={saving || !dirty}
          aria-label="Änderungen speichern"
          className={`inline-flex items-center gap-1.5 text-[0.78rem] rounded-[var(--radius-md)] px-3 py-1.5 font-medium transition-colors disabled:opacity-40 ${
            dirty && !saving
              ? "fca-button-primary ring-2 ring-[var(--sce-primary)]/30 ring-offset-1"
              : "fca-button-primary"
          }`}
          data-testid="designer-save-button"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : saved ? (
            <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {saving ? "Speichert…" : saved ? "Gespeichert" : "Speichern"}
        </button>
      </div>

      {/* Save error banner */}
      {saveError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-3 py-2"
        >
          <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0" aria-hidden="true" />
          <p className="text-[0.78rem] text-red-700">{saveError}</p>
        </div>
      )}

      {/* ── 3-panel Designer workspace ─────────────────────────────────── */}
      {/*
        LEFT  ~210px  — widget palette (compact control surface)
        CENTER 1fr    — 16:9 live preview (visual focus / dominant)
        RIGHT ~300px  — contextual settings panel
      */}
      <div className="grid grid-cols-[210px_1fr_300px] gap-4 items-start">

        {/* ── LEFT: Widget palette ──────────────────────────────────────── */}
        <aside
          className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden"
          aria-label="Widget-Auswahl"
          data-testid="widget-palette"
        >
          <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-3)]">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Widgets
            </p>
          </div>

          <ul className="py-1" role="list">
            {WIDGET_ORDER.map((type) => {
              const widget = findWidget(layout, type);
              const isEnabled = widget?.enabled ?? true;
              const isSelected = selectedWidget === type;

              return (
                <li key={type}>
                  <button
                    onClick={() => setSelectedWidget(type)}
                    className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-all ${
                      isSelected
                        ? "bg-[var(--sce-primary)]/10 border-l-[3px] border-[var(--sce-primary)] shadow-[inset_0_0_0_1px_var(--sce-primary-light,rgba(var(--sce-primary-rgb,59,130,246),0.15))]"
                        : "border-l-[3px] border-transparent hover:bg-[var(--surface-3)] hover:border-[var(--border)]"
                    }`}
                    aria-pressed={isSelected}
                    aria-current={isSelected ? "true" : undefined}
                    data-testid={`widget-palette-item-${type.toLowerCase()}`}
                  >
                    <div className={`mt-0.5 shrink-0 transition-colors ${
                      isSelected ? "text-[var(--sce-primary)]" : "text-[var(--muted)]"
                    }`}>
                      {WIDGET_ICON[type]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[0.8rem] font-semibold truncate transition-colors ${
                          isSelected ? "text-[var(--sce-primary)]" : "text-[var(--foreground)]"
                        }`}>
                          {WIDGET_LABELS[type]}
                        </span>
                        {!isEnabled && (
                          <span className="shrink-0 text-[0.6rem] font-semibold tracking-wide text-[var(--muted)] bg-[var(--surface-3)] border border-[var(--border)] rounded px-1 py-0.5 leading-none uppercase">
                            AUS
                          </span>
                        )}
                      </div>
                      <p className="text-[0.67rem] text-[var(--muted)] mt-0.5 leading-snug line-clamp-2">
                        {WIDGET_DESCRIPTIONS[type]}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Widget enable/disable toggle for selected widget */}
          {selectedWidget && (
            <div className="px-3 py-2.5 border-t border-[var(--border)] bg-[var(--surface-3)]">
              {(() => {
                const widget = findWidget(layout, selectedWidget);
                const isEnabled = widget?.enabled ?? true;
                const isLocked = selectedWidget === "ACTIVITIES";
                const toggleId = `widget-toggle-${selectedWidget.toLowerCase()}`;
                return (
                  <div className={`flex items-center gap-2 ${isLocked ? "opacity-50" : ""}`}>
                    <button
                      role="switch"
                      id={toggleId}
                      aria-checked={isEnabled}
                      aria-label={`${WIDGET_LABELS[selectedWidget]} ${isEnabled ? "deaktivieren" : "aktivieren"}`}
                      disabled={isLocked}
                      onClick={() => !isLocked && setWidgetEnabled(selectedWidget, !isEnabled)}
                      className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] ${
                        isLocked ? "cursor-not-allowed" : "cursor-pointer"
                      } ${
                        isEnabled ? "bg-[var(--sce-primary)]" : "bg-[var(--border)] border border-[var(--border)]"
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
                          isEnabled ? "translate-x-3.5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <label
                      htmlFor={toggleId}
                      className={`text-[0.72rem] select-none ${
                        isLocked ? "cursor-not-allowed text-[var(--muted)]" : "cursor-pointer text-[var(--foreground)]"
                      }`}
                    >
                      {isLocked
                        ? "Immer aktiv"
                        : isEnabled
                          ? "Aktiv"
                          : "Deaktiviert"}
                    </label>
                    {isLocked && (
                      <Circle className="h-3 w-3 text-[var(--muted)]" aria-hidden="true" />
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </aside>

        {/* ── CENTER: Live preview (dominant) ───────────────────────────── */}
        <div className="space-y-1.5 min-w-0">
          <InboardLivePreview
            theme={board.displayTheme as "DARK" | "LIGHT" | null}
            headerConfig={previewHeaderConfig}
            announcement={previewAnnouncement}
            className="border border-[var(--border)] shadow-sm"
          />
          <p className="text-center text-[0.66rem] text-[var(--muted)]">
            Vorschau · Beispieldaten — Kiosk-Anzeige verwendet Echtdaten
          </p>
        </div>

        {/* ── RIGHT: Widget settings ────────────────────────────────────── */}
        <aside
          className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden"
          aria-label="Widget-Einstellungen"
          data-testid="widget-settings-panel"
        >
          <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface-3)] flex items-center gap-2">
            <span className={`transition-colors ${
              selectedWidget ? "text-[var(--sce-primary)]" : "text-[var(--muted)]"
            }`}>
              {WIDGET_ICON[selectedWidget]}
            </span>
            <p className="text-[0.78rem] font-semibold text-[var(--foreground)]">
              {WIDGET_LABELS[selectedWidget]}
            </p>
          </div>

          <div className="p-4 overflow-y-auto max-h-[calc(100vh-320px)]">
            {selectedWidget === "HEADER" && (
              <HeaderWidgetPanel
                settings={
                  (findWidget(layout, "HEADER")?.settings as HeaderWidgetSettings | undefined) ?? {
                    subtitleEnabled: board.headerSubtitleEnabled,
                    subtitleText: board.headerSubtitleText,
                    showTime: board.headerShowTime,
                    showDate: board.headerShowDate,
                  }
                }
                tenantName={tenantName}
                onChange={(settings) =>
                  setWidgetSettings("HEADER", settings as unknown as Record<string, unknown>)
                }
              />
            )}

            {selectedWidget === "ACTIVITIES" && <ActivitiesWidgetPanel />}

            {selectedWidget === "ANNOUNCEMENT" && (
              <AnnouncementWidgetPanel
                enabled={findWidget(layout, "ANNOUNCEMENT")?.enabled ?? board.announcementEnabled}
                settings={
                  (findWidget(layout, "ANNOUNCEMENT")?.settings as AnnouncementWidgetSettings | undefined) ?? {
                    text: board.announcementText,
                    bgColor: board.announcementBgColor,
                    textColor: board.announcementTextColor,
                  }
                }
                onEnabledChange={(enabled) => setWidgetEnabled("ANNOUNCEMENT", enabled)}
                onSettingsChange={(settings) =>
                  setWidgetSettings("ANNOUNCEMENT", settings as unknown as Record<string, unknown>)
                }
              />
            )}
          </div>
        </aside>

      </div>
    </div>
  );
}
