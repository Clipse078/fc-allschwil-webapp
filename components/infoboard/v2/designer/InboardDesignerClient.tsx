"use client";

/**
 * components/infoboard/v2/designer/InboardDesignerClient.tsx
 *
 * Infoboard Designer — 3-panel layout:
 *   LEFT   Widget palette (widget types + enable/disable)
 *   CENTER 16:9 live preview (same renderer as public kiosk)
 *   RIGHT  Contextual settings for the selected widget
 *
 * Design principles (Škoda-like, controlled customisation):
 *   - Users choose what is shown, where, how large, which variant
 *   - SportClubEvo retains guardrails: layout stays readable and premium
 *   - No free-form pixel canvas; controlled 12-column grid model
 *   - Changes reflect immediately in the live preview
 *
 * State:
 *   - layout: InboardLayout (widget instances with enabled, position, settings)
 *   - selectedWidgetType: which widget's settings are shown in the right panel
 *   - dirty: whether unsaved changes exist
 *   - saving: PATCH in progress
 *
 * Persistence:
 *   - Saves layoutJson (full widget config) + flat fields (for kiosk compat)
 *   - Single PATCH /api/infoboards/[id] on "Speichern"
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
    const headerSettings = findWidget(layout, "HEADER")
      ?.settings as HeaderWidgetSettings | undefined;
    const announcementWidget = findWidget(layout, "ANNOUNCEMENT");
    const annSettings = announcementWidget?.settings as AnnouncementWidgetSettings | undefined;
    const announcementEnabled = announcementWidget?.enabled ?? false;

    const payload = {
      layoutJson: JSON.stringify(layout),
      // Sync flat fields with widget settings
      headerSubtitleEnabled: headerSettings?.subtitleEnabled ?? true,
      headerSubtitleText: headerSettings?.subtitleText ?? null,
      headerShowTime: headerSettings?.showTime ?? true,
      headerShowDate: headerSettings?.showDate ?? true,
      announcementEnabled,
      announcementText: announcementEnabled ? (annSettings?.text ?? null) : null,
      announcementBgColor: announcementEnabled ? (annSettings?.bgColor ?? null) : null,
      announcementTextColor: announcementEnabled ? (annSettings?.textColor ?? null) : null,
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
    <div className="flex flex-col gap-4">
      {/* Designer toolbar */}
      <div className="flex items-center justify-between gap-3 min-h-[36px]">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />
          <span className="text-[0.8rem] font-medium text-[var(--text-2)]">Designer</span>
          {dirty && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 text-[0.68rem] font-medium text-amber-600">
              Ungespeichert
            </span>
          )}
        </div>
        <button
          onClick={() => void handleSave()}
          disabled={saving || !dirty}
          className="fca-button-primary inline-flex items-center gap-1.5 text-[0.78rem] disabled:opacity-40"
          data-testid="designer-save-button"
        >
          {saved ? (
            <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {saving ? "Speichert…" : saved ? "Gespeichert" : "Speichern"}
        </button>
      </div>

      {saveError && (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0" aria-hidden="true" />
          <p className="text-[0.78rem] text-red-700">{saveError}</p>
        </div>
      )}

      {/* 3-panel layout */}
      <div className="grid grid-cols-[200px_1fr_260px] gap-4 items-start min-h-[420px]">

        {/* ── LEFT: Widget palette ────────────────────────────────────────── */}
        <aside
          className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden"
          aria-label="Widget-Auswahl"
          data-testid="widget-palette"
        >
          <div className="px-3 py-2.5 border-b border-[var(--border)] bg-[var(--surface-3)]">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
              Widgets
            </p>
          </div>
          <ul className="py-1.5" role="list">
            {WIDGET_ORDER.map((type) => {
              const widget = findWidget(layout, type);
              const isEnabled = widget?.enabled ?? true;
              const isSelected = selectedWidget === type;

              return (
                <li key={type}>
                  <button
                    onClick={() => setSelectedWidget(type)}
                    className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors ${
                      isSelected
                        ? "bg-[var(--sce-primary)]/8 border-l-2 border-[var(--sce-primary)]"
                        : "border-l-2 border-transparent hover:bg-[var(--surface-3)]"
                    } ${!isEnabled ? "opacity-50" : ""}`}
                    aria-pressed={isSelected}
                    data-testid={`widget-palette-item-${type.toLowerCase()}`}
                  >
                    <div className={`mt-0.5 shrink-0 ${isSelected ? "text-[var(--sce-primary)]" : "text-[var(--muted)]"}`}>
                      {WIDGET_ICON[type]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[0.8rem] font-medium truncate ${isSelected ? "text-[var(--sce-primary)]" : "text-[var(--foreground)]"}`}>
                          {WIDGET_LABELS[type]}
                        </span>
                        {!isEnabled && (
                          <span className="shrink-0 text-[0.62rem] font-medium text-[var(--muted)] bg-[var(--surface-3)] border border-[var(--border)] rounded px-1 py-0.5 leading-none">
                            AUS
                          </span>
                        )}
                      </div>
                      <p className="text-[0.68rem] text-[var(--muted)] mt-0.5 leading-snug line-clamp-2">
                        {WIDGET_DESCRIPTIONS[type]}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Widget enabled/disabled toggle for selected */}
          {selectedWidget && (
            <div className="px-3 py-2.5 border-t border-[var(--border)] bg-[var(--surface-3)]">
              {(() => {
                const widget = findWidget(layout, selectedWidget);
                const isEnabled = widget?.enabled ?? true;
                const isLocked = selectedWidget === "ACTIVITIES"; // Activities always on
                return (
                  <label className={`flex items-center gap-2 ${isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      disabled={isLocked}
                      onChange={(e) => setWidgetEnabled(selectedWidget, e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`h-4 w-7 rounded-full transition-colors relative ${
                        isEnabled ? "bg-[var(--sce-primary)]" : "bg-[var(--surface-3)] border border-[var(--border)]"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${
                          isEnabled ? "translate-x-3" : "translate-x-0.5"
                        }`}
                      />
                    </div>
                    <span className="text-[0.72rem] text-[var(--foreground)]">
                      {isEnabled ? "Aktiv" : "Deaktiviert"}
                    </span>
                    {isLocked && (
                      <Circle className="h-3 w-3 text-[var(--muted)]" aria-hidden="true" />
                    )}
                  </label>
                );
              })()}
            </div>
          )}
        </aside>

        {/* ── CENTER: Live preview ────────────────────────────────────────── */}
        <div className="space-y-2">
          <InboardLivePreview
            theme={board.displayTheme as "DARK" | "LIGHT" | null}
            headerConfig={previewHeaderConfig}
            announcement={previewAnnouncement}
            className="border border-[var(--border)] shadow-sm"
          />
          <p className="text-center text-[0.68rem] text-[var(--muted)]">
            Vorschau — Beispieldaten · Kiosk-Anzeige kann leicht abweichen
          </p>
        </div>

        {/* ── RIGHT: Widget settings ──────────────────────────────────────── */}
        <aside
          className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden"
          aria-label="Widget-Einstellungen"
          data-testid="widget-settings-panel"
        >
          <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface-3)] flex items-center gap-2">
            <span className="text-[var(--muted)]">{WIDGET_ICON[selectedWidget]}</span>
            <p className="text-[0.78rem] font-semibold text-[var(--foreground)]">
              {WIDGET_LABELS[selectedWidget]}
            </p>
          </div>

          <div className="p-4">
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
