"use client";

/**
 * components/infoboard/v2/designer/InboardDesignerClient.tsx
 *
 * Infoboard Designer — 3-panel layout (Designer-02):
 *   LEFT   Widget palette (~210px) — widget types + enable/disable
 *   CENTER Canvas (1fr) — interactive 16:9 canvas (Bearbeiten) or
 *          clean Vorschau (preview) of the exact kiosk renderer
 *   RIGHT  Contextual settings (~300px) for the selected widget
 *
 * New in Designer-02:
 *   • Direct canvas selection — clicking a widget on the canvas syncs
 *     palette and settings panel (and vice-versa)
 *   • Edit / Preview mode toggle (Bearbeiten / Vorschau)
 *   • Grid-based drag-to-move with snap, bounds, and collision enforcement
 *   • Grid-based resize (ACTIVITIES, ANNOUNCEMENT) within per-widget limits
 *   • Enable/disable restores default position when re-enabling a widget
 *   • "Layout zurücksetzen" resets to getDefaultLayout() locally (not saved
 *     until the user explicitly clicks Speichern)
 *
 * Canvas scaling:
 *   The overlay is placed at the wrapper's aspect-ratio level (not the
 *   1920 px virtual level), so pointer coords already match rendered pixels
 *   and no inverse-scale compensation is needed.
 *
 * Save states:
 *   Unsaved  → amber "Ungespeichert" badge + highlighted Speichern button
 *   Saving   → spinner + "Speichert…"
 *   Saved    → "Gespeichert ✓"
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
  Pencil,
  Eye,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";

import { InboardDesignerCanvas } from "./InboardDesignerCanvas";
import type { DesignerMode } from "./InboardDesignerCanvas";
import { HeaderWidgetPanel } from "./HeaderWidgetPanel";
import { ActivitiesWidgetPanel } from "./ActivitiesWidgetPanel";
import { AnnouncementWidgetPanel } from "./AnnouncementWidgetPanel";

import {
  parseLayoutJson,
  updateWidget,
  findWidget,
  validateLayout,
  getDefaultLayout,
  DEFAULT_WIDGET_POSITIONS,
  hasOverlapWithOthers,
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
  const [mode, setMode] = useState<DesignerMode>("edit");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  // ── Layout mutations ──────────────────────────────────────────────────────

  const markDirty = useCallback(() => {
    setDirty(true);
    setSaved(false);
  }, []);

  const setWidgetEnabled = useCallback(
    (type: WidgetType, enabled: boolean) => {
      setLayout((prev) => {
        const widget = findWidget(prev, type);
        if (!widget) return prev;

        if (!enabled) {
          return updateWidget(prev, type, { enabled: false });
        }

        // Re-enabling: if the widget's current position overlaps any other
        // enabled widget, restore it to its canonical default position.
        const defaultPos = DEFAULT_WIDGET_POSITIONS[type];
        const overlapAtCurrent = hasOverlapWithOthers(
          widget,
          widget.position,
          widget.width,
          widget.height,
          prev.widgets,
        );

        const updates = overlapAtCurrent
          ? {
              enabled: true,
              position: { col: defaultPos.col, row: defaultPos.row },
              width: defaultPos.width,
              height: defaultPos.height,
            }
          : { enabled: true };

        return updateWidget(prev, type, updates);
      });

      if (enabled) {
        // Select the widget that was just enabled
        setSelectedWidget(type);
      }

      markDirty();
    },
    [markDirty],
  );

  const setWidgetSettings = useCallback(
    (type: WidgetType, settings: Record<string, unknown>) => {
      setLayout((prev) => updateWidget(prev, type, { settings }));
      markDirty();
    },
    [markDirty],
  );

  const handleCanvasLayoutChange = useCallback(
    (updated: InboardLayout) => {
      setLayout(updated);
      markDirty();
    },
    [markDirty],
  );

  // ── Reset layout ──────────────────────────────────────────────────────────

  const handleConfirmReset = useCallback(() => {
    setLayout(getDefaultLayout(board));
    setSelectedWidget("HEADER");
    setConfirmingReset(false);
    markDirty();
  }, [board, markDirty]);

  // ── Derived preview props ─────────────────────────────────────────────────

  const headerWidget = findWidget(layout, "HEADER");
  const announcementWidget = findWidget(layout, "ANNOUNCEMENT");

  const headerSettings = headerWidget?.settings as HeaderWidgetSettings | undefined;
  const announcementSettings = announcementWidget?.settings as
    | AnnouncementWidgetSettings
    | undefined;

  const previewHeaderConfig = {
    subtitleEnabled: headerSettings?.subtitleEnabled,
    subtitleText: headerSettings?.subtitleText,
    showTime: headerSettings?.showTime,
    showDate: headerSettings?.showDate,
    showWeather: headerSettings?.showWeather,
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

    const hSettings = findWidget(layout, "HEADER")
      ?.settings as HeaderWidgetSettings | undefined;
    const annWidget = findWidget(layout, "ANNOUNCEMENT");
    const aSettings = annWidget?.settings as
      | AnnouncementWidgetSettings
      | undefined;
    const announcementEnabled = annWidget?.enabled ?? false;

    const payload = {
      layoutJson: JSON.stringify(layout),
      headerSubtitleEnabled: hSettings?.subtitleEnabled ?? true,
      headerSubtitleText: hSettings?.subtitleText ?? null,
      headerShowTime: hSettings?.showTime ?? true,
      headerShowDate: hSettings?.showDate ?? true,
      headerShowWeather: hSettings?.showWeather ?? false,
      announcementEnabled,
      announcementText: announcementEnabled ? (aSettings?.text ?? null) : null,
      announcementBgColor: announcementEnabled
        ? (aSettings?.bgColor ?? null)
        : null,
      announcementTextColor: announcementEnabled
        ? (aSettings?.textColor ?? null)
        : null,
    };

    try {
      const res = await fetch(`/api/infoboards/${board.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setSaveError(data.error ?? "Fehler beim Speichern.");
        return;
      }

      const { board: updated } = (await res.json()) as { board: InboardRow };
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
        className="flex items-center justify-between gap-3 min-h-[36px] flex-wrap"
        role="toolbar"
        aria-label="Designer-Steuerung"
      >
        {/* Left side: label + status badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Layers className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />
          <span className="text-[0.8rem] font-medium text-[var(--text-2)]">
            Designer
          </span>

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

        {/* Right side: mode toggle + reset + save */}
        <div className="flex items-center gap-2">

          {/* Edit / Preview mode toggle */}
          <div
            className="inline-flex rounded-[var(--radius-md)] border border-[var(--border)] overflow-hidden"
            role="group"
            aria-label="Anzeigemodus"
          >
            <button
              onClick={() => setMode("edit")}
              aria-pressed={mode === "edit"}
              aria-label="Bearbeiten-Modus"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.75rem] font-medium transition-colors ${
                mode === "edit"
                  ? "bg-[var(--sce-primary)] text-white"
                  : "bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-3)]"
              }`}
              data-testid="mode-btn-edit"
            >
              <Pencil className="h-3 w-3" aria-hidden="true" />
              Bearbeiten
            </button>
            <button
              onClick={() => setMode("preview")}
              aria-pressed={mode === "preview"}
              aria-label="Vorschau-Modus"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.75rem] font-medium transition-colors border-l border-[var(--border)] ${
                mode === "preview"
                  ? "bg-[var(--sce-primary)] text-white"
                  : "bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-3)]"
              }`}
              data-testid="mode-btn-preview"
            >
              <Eye className="h-3 w-3" aria-hidden="true" />
              Vorschau
            </button>
          </div>

          {/* Reset layout */}
          {!confirmingReset ? (
            <button
              onClick={() => setConfirmingReset(true)}
              aria-label="Layout auf Standard zurücksetzen"
              className="inline-flex items-center gap-1.5 text-[0.75rem] rounded-[var(--radius-md)] px-3 py-1.5 font-medium border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-3)] transition-colors"
              data-testid="layout-reset-button"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Layout zurücksetzen
            </button>
          ) : (
            <div
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-amber-300/60 bg-amber-50 px-2 py-1"
              role="group"
              aria-label="Reset bestätigen"
            >
              <AlertTriangle
                className="h-3.5 w-3.5 text-amber-600 shrink-0"
                aria-hidden="true"
              />
              <span className="text-[0.72rem] text-amber-700">
                Zurücksetzen?
              </span>
              <button
                onClick={handleConfirmReset}
                className="text-[0.72rem] font-semibold text-amber-700 underline hover:no-underline"
                data-testid="layout-reset-confirm"
              >
                Ja
              </button>
              <button
                onClick={() => setConfirmingReset(false)}
                className="text-[0.72rem] text-[var(--muted)] hover:text-[var(--foreground)]"
                data-testid="layout-reset-cancel"
              >
                Abbrechen
              </button>
            </div>
          )}

          {/* Save */}
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
      </div>

      {/* Save error banner */}
      {saveError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-3 py-2"
        >
          <AlertCircle
            className="h-3.5 w-3.5 text-red-600 shrink-0"
            aria-hidden="true"
          />
          <p className="text-[0.78rem] text-red-700">{saveError}</p>
        </div>
      )}

      {/* ── 3-panel Designer workspace ─────────────────────────────────── */}
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
                    <div
                      className={`mt-0.5 shrink-0 transition-colors ${
                        isSelected ? "text-[var(--sce-primary)]" : "text-[var(--muted)]"
                      }`}
                    >
                      {WIDGET_ICON[type]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[0.8rem] font-semibold truncate transition-colors ${
                            isSelected
                              ? "text-[var(--sce-primary)]"
                              : "text-[var(--foreground)]"
                          }`}
                        >
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
                  <div
                    className={`flex items-center gap-2 ${isLocked ? "opacity-50" : ""}`}
                  >
                    <button
                      role="switch"
                      id={toggleId}
                      aria-checked={isEnabled}
                      aria-label={`${WIDGET_LABELS[selectedWidget]} ${isEnabled ? "deaktivieren" : "aktivieren"}`}
                      disabled={isLocked}
                      onClick={() =>
                        !isLocked && setWidgetEnabled(selectedWidget, !isEnabled)
                      }
                      className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] ${
                        isLocked ? "cursor-not-allowed" : "cursor-pointer"
                      } ${
                        isEnabled
                          ? "bg-[var(--sce-primary)]"
                          : "bg-[var(--border)] border border-[var(--border)]"
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
                        isLocked
                          ? "cursor-not-allowed text-[var(--muted)]"
                          : "cursor-pointer text-[var(--foreground)]"
                      }`}
                    >
                      {isLocked ? "Immer aktiv" : isEnabled ? "Aktiv" : "Deaktiviert"}
                    </label>
                    {isLocked && (
                      <Circle
                        className="h-3 w-3 text-[var(--muted)]"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </aside>

        {/* ── CENTER: Canvas (dominant) ──────────────────────────────────── */}
        <div className="space-y-1.5 min-w-0">
          <InboardDesignerCanvas
            layout={layout}
            mode={mode}
            selectedWidget={selectedWidget}
            theme={board.displayTheme as "DARK" | "LIGHT" | null}
            headerConfig={previewHeaderConfig}
            announcement={previewAnnouncement}
            onWidgetSelect={setSelectedWidget}
            onLayoutChange={handleCanvasLayoutChange}
            className="border border-[var(--border)] shadow-sm"
          />
          <p className="text-center text-[0.66rem] text-[var(--muted)]">
            {mode === "edit"
              ? "Bearbeiten · Widget anklicken, ziehen oder Größe ändern"
              : "Vorschau · Beispieldaten — Kiosk-Anzeige verwendet Echtdaten"}
          </p>
        </div>

        {/* ── RIGHT: Widget settings ────────────────────────────────────── */}
        <aside
          className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden"
          aria-label="Widget-Einstellungen"
          data-testid="widget-settings-panel"
        >
          <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface-3)] flex items-center gap-2">
            <span
              className={`transition-colors ${
                selectedWidget ? "text-[var(--sce-primary)]" : "text-[var(--muted)]"
              }`}
            >
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
                  (findWidget(layout, "HEADER")?.settings as
                    | HeaderWidgetSettings
                    | undefined) ?? {
                    subtitleEnabled: board.headerSubtitleEnabled,
                    subtitleText: board.headerSubtitleText,
                    showTime: board.headerShowTime,
                    showDate: board.headerShowDate,
                    showWeather: board.headerShowWeather,
                  }
                }
                tenantName={tenantName}
                onChange={(settings) =>
                  setWidgetSettings(
                    "HEADER",
                    settings as unknown as Record<string, unknown>,
                  )
                }
              />
            )}

            {selectedWidget === "ACTIVITIES" && <ActivitiesWidgetPanel />}

            {selectedWidget === "ANNOUNCEMENT" && (
              <AnnouncementWidgetPanel
                enabled={
                  findWidget(layout, "ANNOUNCEMENT")?.enabled ??
                  board.announcementEnabled
                }
                settings={
                  (findWidget(layout, "ANNOUNCEMENT")?.settings as
                    | AnnouncementWidgetSettings
                    | undefined) ?? {
                    text: board.announcementText,
                    bgColor: board.announcementBgColor,
                    textColor: board.announcementTextColor,
                  }
                }
                onEnabledChange={(enabled) =>
                  setWidgetEnabled("ANNOUNCEMENT", enabled)
                }
                onSettingsChange={(settings) =>
                  setWidgetSettings(
                    "ANNOUNCEMENT",
                    settings as unknown as Record<string, unknown>,
                  )
                }
              />
            )}
          </div>
        </aside>

      </div>
    </div>
  );
}
