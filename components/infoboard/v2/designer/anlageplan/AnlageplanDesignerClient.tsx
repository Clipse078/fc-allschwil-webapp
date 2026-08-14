"use client";

/**
 * components/infoboard/v2/designer/anlageplan/AnlageplanDesignerClient.tsx
 *
 * INFOBOARD-MAP-01 — Anlageplan Designer
 *
 * Free-positioning canvas for the Anlageplan (facility map) board layout.
 *
 * This is intentionally SEPARATE from the grid-based InboardDesignerClient:
 * map elements need arbitrary positions, not a 12-column widget grid.
 *
 * Three-panel layout:
 *   Left  — Elemente palette (add zones / markers)
 *   Center — 16:9 canvas with drag/resize/select
 *   Right  — Properties for selected element
 *
 * Coordinates:
 *   All positions stored as normalized [0,1] fractions of the canvas.
 *   At render time in the designer, multiply by the canvas DOM pixel size.
 *
 * Persistence:
 *   Canvas state → PATCH /api/infoboards/[id] { anlageplanJson }
 *   Background   → POST /api/infoboards/[id]/anlageplan/background
 *   Background delete → DELETE /api/infoboards/[id]/anlageplan/background
 */

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Image as ImageIcon,
  Trash2,
  Move,
  Save,
  Plus,
  MapPin,
  Square,
  Loader2,
  AlertCircle,
  Check,
  X,
} from "lucide-react";
import type { InboardRow } from "@/lib/infoboard/types";
import type {
  AnlageplanConfig,
  AnlageplanElement,
  ResourceZoneElement,
  MarkerElement,
  MarkerType,
  NormalizedRect,
  AnlageplanResourceOption,
} from "@/lib/infoboard/anlageplan-types";
import {
  parseAnlageplanJson,
  emptyAnlageplanConfig,
  isResourceZone,
  isMarker,
  isDuBistHier,
  validateAnlageplanConfig,
  MARKER_LABELS,
  MARKER_ICONS,
  ZONE_TYPE_LABELS,
  defaultRect,
  defaultMarkerRect,
  defaultDuBistHierRect,
  anlageplanResourceLabel,
} from "@/lib/infoboard/anlageplan-types";

// ── Marker palette — driven by canonical MARKER_ICONS (single source of truth) ─

const MARKER_PALETTE: { type: MarkerType }[] = [
  { type: "DU_BIST_HIER" },
  { type: "HAUPTEINGANG" },
  { type: "KABINE" },
  { type: "WC" },
  { type: "BISTRO" },
  { type: "PARKPLATZ" },
  { type: "SEKRETARIAT" },
  { type: "SPEAKERRAUM" },
  { type: "ERSTE_HILFE" },
  { type: "FREIER_MARKER" },
];

// ── Canvas helpers ─────────────────────────────────────────────────────────────

const CANVAS_ASPECT = 16 / 9;

function toPixels(
  norm: NormalizedRect,
  cw: number,
  ch: number,
): { x: number; y: number; w: number; h: number } {
  return {
    x: norm.x * cw,
    y: norm.y * ch,
    w: norm.width * cw,
    h: norm.height * ch,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ── Props ──────────────────────────────────────────────────────────────────────

type Props = {
  board: InboardRow;
  onBoardChange?: (updated: InboardRow) => void;
  /**
   * INFOBOARD-MAP-01B — canonical active FacilityResource options for the
   * resource picker. Passed from the server page (tenant-scoped, non-archived,
   * FULL_PITCH/HALF_PITCH types only).
   */
  facilityOptions?: AnlageplanResourceOption[];
};

// ── Component ──────────────────────────────────────────────────────────────────

export function AnlageplanDesignerClient({ board, onBoardChange, facilityOptions = [] }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 450 });

  const [config, setConfig] = useState<AnlageplanConfig>(
    () => parseAnlageplanJson(board.anlageplanJson) ?? emptyAnlageplanConfig(),
  );
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(
    board.anlageplanBackgroundUrl ?? null,
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag state
  const dragging = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // Resize state (bottom-right corner)
  const resizing = useRef<{
    id: string;
    startX: number;
    startY: number;
    origW: number;
    origH: number;
  } | null>(null);

  // Observe canvas size
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        setCanvasSize({ w, h: w / CANVAS_ASPECT });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const selectedElement = config.elements.find((e) => e.id === selectedId) ?? null;

  // ── Element mutations ──────────────────────────────────────────────────────

  function updateElement(id: string, patch: Partial<AnlageplanElement>) {
    setConfig((prev): AnlageplanConfig => ({
      ...prev,
      elements: prev.elements.map((e) =>
        e.id === id ? ({ ...e, ...patch } as AnlageplanElement) : e,
      ),
    }));
    setSaved(false);
  }

  function deleteElement(id: string) {
    setConfig((prev) => ({
      ...prev,
      elements: prev.elements.filter((e) => e.id !== id),
    }));
    setSelectedId(null);
    setSaved(false);
  }

  function addResourceZone(zoneType: "FULL_PITCH" | "HALF_PITCH") {
    const el: ResourceZoneElement = {
      kind: "RESOURCE_ZONE",
      id: crypto.randomUUID(),
      rect: defaultRect(),
      resourceCode: null,
      label: null,
      zoneType,
      showNextActivity: true,
    };
    setConfig((prev) => ({ ...prev, elements: [...prev.elements, el] }));
    setSelectedId(el.id);
    setSaved(false);
  }

  function addMarker(type: MarkerType) {
    const el: MarkerElement = {
      kind: "MARKER",
      id: crypto.randomUUID(),
      rect: type === "DU_BIST_HIER" ? defaultDuBistHierRect() : defaultMarkerRect(),
      markerType: type,
      label: MARKER_LABELS[type],
      secondaryText: null,
    };
    setConfig((prev) => ({ ...prev, elements: [...prev.elements, el] }));
    setSelectedId(el.id);
    setSaved(false);
  }

  // ── Drag ──────────────────────────────────────────────────────────────────

  function onMouseDownElement(e: React.MouseEvent, id: string) {
    if ((e.target as HTMLElement).dataset.resize) return;
    e.stopPropagation();
    setSelectedId(id);
    const el = config.elements.find((x) => x.id === id);
    if (!el) return;
    dragging.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: el.rect.x,
      origY: el.rect.y,
    };
  }

  function onMouseDownResize(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    const el = config.elements.find((x) => x.id === id);
    if (!el) return;
    resizing.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origW: el.rect.width,
      origH: el.rect.height,
    };
  }

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      const cw = canvasSize.w;
      const ch = canvasSize.h;

      if (dragging.current) {
        const { id, startX, startY, origX, origY } = dragging.current;
        const dx = (e.clientX - startX) / cw;
        const dy = (e.clientY - startY) / ch;
        const el = config.elements.find((x) => x.id === id);
        if (!el) return;
        const nx = clamp(origX + dx, 0, 1 - el.rect.width);
        const ny = clamp(origY + dy, 0, 1 - el.rect.height);
        setConfig((prev) => ({
          ...prev,
          elements: prev.elements.map((x) =>
            x.id === id ? { ...x, rect: { ...x.rect, x: nx, y: ny } } : x,
          ),
        }));
        setSaved(false);
      } else if (resizing.current) {
        const { id, startX, startY, origW, origH } = resizing.current;
        const dx = (e.clientX - startX) / cw;
        const dy = (e.clientY - startY) / ch;
        const el = config.elements.find((x) => x.id === id);
        if (!el) return;
        const nw = clamp(origW + dx, 0.03, 1 - el.rect.x);
        const nh = clamp(origH + dy, 0.03, 1 - el.rect.y);
        setConfig((prev) => ({
          ...prev,
          elements: prev.elements.map((x) =>
            x.id === id
              ? { ...x, rect: { ...x.rect, width: nw, height: nh } }
              : x,
          ),
        }));
        setSaved(false);
      }
    },
    [canvasSize, config.elements],
  );

  const onMouseUp = useCallback(() => {
    dragging.current = null;
    resizing.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    const err = validateAnlageplanConfig(config);
    if (err) {
      setSaveError(err);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/infoboards/${board.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anlageplanJson: JSON.stringify(config) }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setSaveError(d.error ?? "Fehler beim Speichern.");
        return;
      }
      const { board: updated } = (await res.json()) as { board: InboardRow };
      onBoardChange?.(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch {
      setSaveError("Netzwerkfehler.");
    } finally {
      setSaving(false);
    }
  }

  // ── Background upload ──────────────────────────────────────────────────────

  async function handleBgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `/api/infoboards/${board.id}/anlageplan/background`,
        { method: "POST", body: fd },
      );
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setUploadError(d.error ?? "Upload fehlgeschlagen.");
        return;
      }
      const { backgroundUrl: url, board: updated } = (await res.json()) as {
        backgroundUrl: string;
        board: InboardRow;
      };
      setBackgroundUrl(url);
      onBoardChange?.(updated);
    } catch {
      setUploadError("Netzwerkfehler.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleBgRemove() {
    setUploading(true);
    setUploadError(null);
    try {
      const res = await fetch(
        `/api/infoboards/${board.id}/anlageplan/background`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setUploadError(d.error ?? "Entfernen fehlgeschlagen.");
        return;
      }
      const { board: updated } = (await res.json()) as { board: InboardRow };
      setBackgroundUrl(null);
      onBoardChange?.(updated);
    } catch {
      setUploadError("Netzwerkfehler.");
    } finally {
      setUploading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const cw = canvasSize.w;
  const ch = canvasSize.h;

  return (
    <div className="flex gap-4 min-h-0" style={{ height: "calc(100vh - 220px)" }}>
      {/* ── Left panel: palette ─────────────────────────────────────────────── */}
      <aside className="w-52 shrink-0 overflow-y-auto space-y-4 pr-1">
        {/* Background */}
        <PanelSection label="Hintergrundbild">
          <div className="space-y-2">
            {backgroundUrl ? (
              <div className="relative rounded-[var(--radius-md)] overflow-hidden border border-[var(--border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={backgroundUrl} alt="Hintergrund" className="w-full h-24 object-cover" />
                <button
                  onClick={() => void handleBgRemove()}
                  disabled={uploading}
                  className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5"
                  title="Bild entfernen"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="h-24 rounded-[var(--radius-md)] border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center gap-1 text-[var(--muted)]">
                <ImageIcon className="h-5 w-5" />
                <span className="text-[0.7rem]">Kein Bild</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => void handleBgUpload(e)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full fca-button-secondary text-[0.75rem] inline-flex items-center justify-center gap-1.5 py-1.5"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImageIcon className="h-3.5 w-3.5" />
              )}
              {backgroundUrl ? "Ersetzen" : "Hochladen"}
            </button>
            {uploadError && (
              <p className="text-[0.68rem] text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" /> {uploadError}
              </p>
            )}
          </div>
        </PanelSection>

        {/* Zones */}
        <PanelSection label="Spielfelder">
          <button
            onClick={() => addResourceZone("FULL_PITCH")}
            className="w-full fca-button-secondary text-[0.75rem] inline-flex items-center gap-1.5 py-1.5"
          >
            <Square className="h-3.5 w-3.5" />
            Spielfeld (ganz)
          </button>
          <button
            onClick={() => addResourceZone("HALF_PITCH")}
            className="mt-1.5 w-full fca-button-secondary text-[0.75rem] inline-flex items-center gap-1.5 py-1.5"
          >
            <Square className="h-3 w-3 opacity-60" />
            Teilfeld (Feld A/B)
          </button>
        </PanelSection>

        {/* Markers */}
        <PanelSection label="Marker">
          <div className="space-y-1">
            {MARKER_PALETTE.map(({ type }) => (
              <button
                key={type}
                onClick={() => addMarker(type)}
                className="w-full text-left fca-button-secondary text-[0.72rem] py-1 px-2 inline-flex items-center gap-1.5"
              >
                <span className="text-sm">{MARKER_ICONS[type]}</span>
                {MARKER_LABELS[type]}
              </button>
            ))}
          </div>
        </PanelSection>
      </aside>

      {/* ── Center: canvas ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 shrink-0">
          <p className="text-[0.72rem] text-[var(--muted)]">
            Elemente ziehen und in der Größe anpassen. Klicken zum Auswählen.
          </p>
          <div className="flex items-center gap-2">
            {saveError && (
              <span className="text-[0.72rem] text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> {saveError}
              </span>
            )}
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="fca-button-primary inline-flex items-center gap-1.5 text-[0.78rem] py-1.5"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : saved ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {saving ? "Speichert…" : saved ? "Gespeichert" : "Speichern"}
            </button>
          </div>
        </div>

        {/* 16:9 canvas */}
        <div
          ref={canvasRef}
          className="relative w-full rounded-[var(--radius-xl)] overflow-hidden border border-[var(--border)] bg-[#0d0d0d] cursor-default select-none"
          style={{ aspectRatio: "16/9" }}
          onMouseDown={() => setSelectedId(null)}
        >
          {/* Background image */}
          {backgroundUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={backgroundUrl}
              alt="Anlageplan"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-[var(--muted)] opacity-40">
                <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                <p className="text-sm">Kein Hintergrundbild</p>
                <p className="text-xs">Bild links hochladen</p>
              </div>
            </div>
          )}

          {/* Map elements */}
          {config.elements.map((el) => {
            const px = toPixels(el.rect, cw, ch);
            const isSelected = selectedId === el.id;
            const isZone = isResourceZone(el);
            const isDubist = isDuBistHier(el);

            return (
              <div
                key={el.id}
                style={{
                  position: "absolute",
                  left: px.x,
                  top: px.y,
                  width: px.w,
                  height: px.h,
                  transform: el.rect.rotation
                    ? `rotate(${el.rect.rotation}deg)`
                    : undefined,
                  cursor: "move",
                  boxSizing: "border-box",
                  border: isSelected
                    ? "2px solid #3b82f6"
                    : isZone
                      ? "2px solid rgba(74,222,128,0.6)"
                      : isDubist
                        ? "2px solid #f59e0b"
                        : "2px solid rgba(148,163,184,0.5)",
                  background: isZone
                    ? "rgba(74,222,128,0.08)"
                    : isDubist
                      ? "rgba(245,158,11,0.15)"
                      : "rgba(148,163,184,0.08)",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  userSelect: "none",
                }}
                onMouseDown={(e) => onMouseDownElement(e, el.id)}
              >
                {/* Element label — icon + text, matching kiosk treatment */}
                {isZone ? (
                  <span
                    className="text-white text-center leading-tight font-semibold pointer-events-none"
                    style={{ fontSize: Math.max(9, Math.min(14, px.w / 8)) }}
                  >
                    {(el as ResourceZoneElement).label ?? (el as ResourceZoneElement).resourceCode ?? "Zone"}
                  </span>
                ) : isDubist ? (
                  <div
                    className="flex flex-col items-center gap-0.5 pointer-events-none"
                    style={{ fontSize: Math.max(8, Math.min(13, px.w / 7)) }}
                  >
                    <span style={{ fontSize: Math.max(10, Math.min(18, px.h * 0.38)) }}>
                      {MARKER_ICONS.DU_BIST_HIER}
                    </span>
                    <span className="text-amber-400 font-bold leading-none whitespace-nowrap" style={{ fontSize: Math.max(7, Math.min(11, px.w / 9)) }}>
                      DU BIST HIER
                    </span>
                  </div>
                ) : (
                  <div
                    className="flex flex-col items-center gap-0.5 pointer-events-none"
                  >
                    <span style={{ fontSize: Math.max(10, Math.min(18, px.h * 0.42)) }}>
                      {MARKER_ICONS[(el as MarkerElement).markerType]}
                    </span>
                    <span
                      className="text-white text-center leading-tight font-medium whitespace-nowrap overflow-hidden text-ellipsis"
                      style={{ fontSize: Math.max(7, Math.min(11, px.w / 9)), maxWidth: px.w - 4 }}
                    >
                      {(el as MarkerElement).label ?? MARKER_LABELS[(el as MarkerElement).markerType]}
                    </span>
                  </div>
                )}

                {/* Resize handle (bottom-right) */}
                {isSelected && (
                  <div
                    data-resize="1"
                    style={{
                      position: "absolute",
                      right: -4,
                      bottom: -4,
                      width: 12,
                      height: 12,
                      background: "#3b82f6",
                      borderRadius: 2,
                      cursor: "se-resize",
                    }}
                    onMouseDown={(e) => onMouseDownResize(e, el.id)}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Element count hint */}
        <p className="text-[0.68rem] text-[var(--muted)] shrink-0">
          {config.elements.length === 0
            ? "Noch keine Elemente. Links hinzufügen."
            : `${config.elements.length} Element${config.elements.length !== 1 ? "e" : ""}`}
        </p>
      </div>

      {/* ── Right panel: properties ─────────────────────────────────────────── */}
      <aside className="w-60 shrink-0 overflow-y-auto space-y-4 pl-1">
        {selectedElement ? (
          <>
            <PanelSection label="Element">
              <p className="text-[0.72rem] text-[var(--muted)] font-medium">
                {isResourceZone(selectedElement)
                  ? ZONE_TYPE_LABELS[selectedElement.zoneType]
                  : isMarker(selectedElement)
                    ? MARKER_LABELS[selectedElement.markerType]
                    : "Element"}
              </p>
            </PanelSection>

            {isResourceZone(selectedElement) && (
              <PanelSection label="Ressource">
                {/* ── Canonical resource picker ─────────────────────────── */}
                <label className="block text-[0.72rem] text-[var(--muted)] mb-1">
                  Anlage / Ressource
                </label>
                {facilityOptions.length > 0 ? (
                  <>
                    <select
                      value={selectedElement.resourceCode ?? ""}
                      onChange={(e) => {
                        const code = e.target.value || null;
                        const opt = code
                          ? facilityOptions.find((o) => o.code === code)
                          : null;
                        const patch: Partial<ResourceZoneElement> = { resourceCode: code };
                        if (opt) {
                          // Auto-sync zone type from canonical resource type
                          patch.zoneType = opt.type;
                          // Prefill display label if currently empty
                          if (!selectedElement.label) {
                            patch.label = anlageplanResourceLabel(opt);
                          }
                        }
                        updateElement(selectedElement.id, patch);
                      }}
                      className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[0.78rem] text-[var(--foreground)]"
                    >
                      <option value="">— Kein Bezug —</option>
                      {facilityOptions.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {anlageplanResourceLabel(opt)}
                          {" "}
                          ({opt.type === "FULL_PITCH" ? "Ganzes Feld" : "Halbes Feld"})
                        </option>
                      ))}
                    </select>
                    {selectedElement.resourceCode && (
                      <p className="mt-1 text-[0.65rem] text-[var(--muted)] font-mono">
                        Code: {selectedElement.resourceCode}
                      </p>
                    )}
                  </>
                ) : (
                  /* Fallback: no facilityOptions passed — should not happen in normal use */
                  <input
                    type="text"
                    value={selectedElement.resourceCode ?? ""}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        resourceCode: e.target.value || null,
                      } as Partial<ResourceZoneElement>)
                    }
                    placeholder="z.B. KR2, KR2-A"
                    className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[0.78rem] text-[var(--foreground)] font-mono"
                  />
                )}

                {/* ── Anzeigebezeichnung (independently editable) ──────── */}
                <label className="block text-[0.72rem] text-[var(--muted)] mt-3 mb-1">
                  Anzeigebezeichnung
                </label>
                <input
                  type="text"
                  value={selectedElement.label ?? ""}
                  onChange={(e) =>
                    updateElement(selectedElement.id, {
                      label: e.target.value || null,
                    } as Partial<ResourceZoneElement>)
                  }
                  placeholder="z.B. Kunstrasen 2"
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[0.78rem] text-[var(--foreground)]"
                />
                <p className="mt-1 text-[0.65rem] text-[var(--muted)]">
                  Nur für diese Karte. Ändert keine Stammdaten.
                </p>

                {/* ── Zone type ────────────────────────────────────────── */}
                <label className="block text-[0.72rem] text-[var(--muted)] mt-3 mb-1">
                  Feldtyp
                </label>
                <select
                  value={selectedElement.zoneType}
                  onChange={(e) =>
                    updateElement(selectedElement.id, {
                      zoneType: e.target.value as "FULL_PITCH" | "HALF_PITCH",
                    } as Partial<ResourceZoneElement>)
                  }
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[0.78rem] text-[var(--foreground)]"
                >
                  <option value="FULL_PITCH">Spielfeld (ganz)</option>
                  <option value="HALF_PITCH">Teilfeld (Feld A/B)</option>
                </select>

                <label className="flex items-center gap-2 mt-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedElement.showNextActivity}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        showNextActivity: e.target.checked,
                      } as Partial<ResourceZoneElement>)
                    }
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-[0.72rem] text-[var(--muted)]">
                    Nächste Aktivität anzeigen
                  </span>
                </label>
              </PanelSection>
            )}

            {isMarker(selectedElement) && (
              <PanelSection label="Marker">
                <label className="block text-[0.72rem] text-[var(--muted)] mb-1">
                  Bezeichnung
                </label>
                <input
                  type="text"
                  value={selectedElement.label ?? ""}
                  onChange={(e) =>
                    updateElement(selectedElement.id, {
                      label: e.target.value || null,
                    } as Partial<MarkerElement>)
                  }
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[0.78rem] text-[var(--foreground)]"
                />

                <label className="block text-[0.72rem] text-[var(--muted)] mt-3 mb-1">
                  Zusatztext
                </label>
                <input
                  type="text"
                  value={selectedElement.secondaryText ?? ""}
                  onChange={(e) =>
                    updateElement(selectedElement.id, {
                      secondaryText: e.target.value || null,
                    } as Partial<MarkerElement>)
                  }
                  placeholder="Optional"
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[0.78rem] text-[var(--foreground)]"
                />
              </PanelSection>
            )}

            {/* Position / size */}
            <PanelSection label="Position & Größe">
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["X", "x"],
                    ["Y", "y"],
                    ["B", "width"],
                    ["H", "height"],
                  ] as const
                ).map(([lbl, key]) => (
                  <div key={key}>
                    <label className="block text-[0.68rem] text-[var(--muted)] mb-0.5">
                      {lbl}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={Math.round(selectedElement.rect[key] * 100) / 100}
                      onChange={(e) =>
                        updateElement(selectedElement.id, {
                          rect: {
                            ...selectedElement.rect,
                            [key]: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[0.72rem] text-[var(--foreground)] font-mono"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2">
                <label className="block text-[0.68rem] text-[var(--muted)] mb-0.5">
                  Rotation (°)
                </label>
                <input
                  type="number"
                  min={0}
                  max={360}
                  step={1}
                  value={selectedElement.rect.rotation ?? 0}
                  onChange={(e) =>
                    updateElement(selectedElement.id, {
                      rect: {
                        ...selectedElement.rect,
                        rotation: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[0.72rem] text-[var(--foreground)] font-mono"
                />
              </div>
            </PanelSection>

            {/* Delete */}
            <div className="pt-1">
              <button
                onClick={() => deleteElement(selectedElement.id)}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-lg)] border border-red-500/30 bg-red-500/8 px-3 py-1.5 text-[0.75rem] text-red-600 hover:bg-red-500/15 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Element löschen
              </button>
            </div>
          </>
        ) : (
          <div className="p-4 text-center text-[var(--muted)]">
            <Move className="h-7 w-7 mx-auto mb-2 opacity-30" />
            <p className="text-[0.75rem]">Element auswählen</p>
            <p className="text-[0.68rem] mt-0.5 opacity-70">
              Klicke auf ein Element im Canvas
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

// ── Helper ─────────────────────────────────────────────────────────────────────

function PanelSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="border-b border-[var(--border)] px-3 py-2 bg-[var(--surface-3)]">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
          {label}
        </p>
      </div>
      <div className="p-3 space-y-1">{children}</div>
    </div>
  );
}
