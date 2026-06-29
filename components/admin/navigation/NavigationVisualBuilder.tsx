"use client";

/**
 * NavigationVisualBuilder — CMS V4.2
 *
 * Visual drag-capable tree editor with Inspector panel for navigation items.
 * Reuses the existing NavigationManager for CRUD operations; this component
 * adds the Inspector UX pattern (select → inspect/edit in panel) and
 * scheduling fields (visibleFrom / visibleUntil).
 *
 * Design:
 *  - Left: hierarchical tree list (all areas: Header / Footer / Utility)
 *  - Right: Inspector panel for the selected item
 *  - Inspector shows: label, href, linkType, target, visibilityMode,
 *    visibleFrom/Until (CMS V4.2), isVisible toggle
 *  - Desktop preview toggle at bottom
 */

import { useState, useEffect, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Monitor,
  Smartphone,
  Settings,
  Calendar,
  Globe,
  ExternalLink,
  Link as LinkIcon,
} from "lucide-react";
import {
  NAV_AREA_ORDER,
  NAV_AREA_LABEL,
  NAV_AREA_SHORT_LABEL,
  NAV_LINK_TYPE_LABEL,
  NAV_TARGET_LABEL,
  NAV_VISIBILITY_MODE,
  NAV_VISIBILITY_MODE_LABEL,
  NAV_LINK_TYPE,
  NAV_TARGET,
  type NavArea,
  type NavLinkType,
  type NavTarget,
  type NavVisibilityMode,
} from "@/lib/navigation/constants";
import type { NavItemTree } from "@/lib/navigation/admin-queries";

// ── Types ─────────────────────────────────────────────────────────────────────

type GroupedAreas = Record<NavArea, NavItemTree[]>;

type SelectedItem = NavItemTree & {
  visibleFrom?: Date | null;
  visibleUntil?: Date | null;
};

type PreviewMode = "desktop" | "mobile";

// ── Helpers ───────────────────────────────────────────────────────────────────

const labelClass =
  "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5";

function toInputDatetime(d: Date | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}` +
    `T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
  );
}

// ── Tree node ─────────────────────────────────────────────────────────────────

function TreeNode({
  item,
  depth = 0,
  selectedId,
  onSelect,
}: {
  item: NavItemTree;
  depth?: number;
  selectedId: string | null;
  onSelect: (item: NavItemTree) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = item.children.length > 0;
  const isSelected = item.id === selectedId;

  return (
    <div>
      <div
        className={[
          "group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
          isSelected
            ? "bg-[var(--accent)] text-white"
            : "hover:bg-[var(--surface-2)] text-[var(--foreground)]",
        ].join(" ")}
        style={{ paddingLeft: `${8 + depth * 20}px` }}
        onClick={() => onSelect(item)}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
            className={isSelected ? "text-white/70" : "text-[var(--muted)]"}
          >
            {open
              ? <ChevronDown className="h-3 w-3" />
              : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="h-3 w-3 shrink-0" />
        )}

        <span className={["flex-1 truncate text-xs font-medium", !item.isVisible ? "opacity-50" : ""].join(" ")}>
          {item.label}
        </span>

        {!item.isVisible && (
          <EyeOff className={`h-3 w-3 shrink-0 ${isSelected ? "text-white/60" : "text-[var(--muted)]"}`} />
        )}

        {item.href && (
          <span className={`text-[10px] font-mono truncate max-w-[80px] ${isSelected ? "text-white/70" : "text-[var(--muted)]"}`}>
            {item.href}
          </span>
        )}
      </div>

      {hasChildren && open && (
        <div>
          {item.children.map((child) => (
            <TreeNode
              key={child.id}
              item={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Inspector panel ───────────────────────────────────────────────────────────

function InspectorPanel({
  item,
  onSaved,
}: {
  item: SelectedItem;
  onSaved: (updated: NavItemTree) => void;
}) {
  const [label, setLabel] = useState(item.label);
  const [href, setHref] = useState(item.href ?? "");
  const [linkType, setLinkType] = useState<NavLinkType>(item.linkType);
  const [target, setTarget] = useState<NavTarget>(item.target);
  const [visibilityMode, setVisibilityMode] = useState<NavVisibilityMode>(item.visibilityMode);
  const [isVisible, setIsVisible] = useState(item.isVisible);
  const [visibleFrom, setVisibleFrom] = useState(toInputDatetime(item.visibleFrom));
  const [visibleUntil, setVisibleUntil] = useState(toInputDatetime(item.visibleUntil));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Intentionally depend only on item.id — re-syncing all fields when item
  // updates mid-edit would discard unsaved changes. A fresh mount on id change
  // is the correct behaviour for an Inspector panel.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setLabel(item.label);
    setHref(item.href ?? "");
    setLinkType(item.linkType);
    setTarget(item.target);
    setVisibilityMode(item.visibilityMode);
    setIsVisible(item.isVisible);
    setVisibleFrom(toInputDatetime(item.visibleFrom));
    setVisibleUntil(toInputDatetime(item.visibleUntil));
    setSaveError(null);
    setSaveSuccess(false);
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/website-navigation/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          href: href.trim() || null,
          linkType,
          target,
          visibilityMode,
          isVisible,
          visibleFrom: visibleFrom || null,
          visibleUntil: visibleUntil || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data?.error ?? "Fehler beim Speichern.");
        return;
      }
      setSaveSuccess(true);
      onSaved(data.item);
    } catch {
      setSaveError("Netzwerkfehler.");
    } finally {
      setSaving(false);
    }
  }

  const linkTypeIcon =
    linkType === NAV_LINK_TYPE.EXTERNAL ? <ExternalLink className="h-3.5 w-3.5" /> :
    linkType === NAV_LINK_TYPE.CUSTOM ? <Settings className="h-3.5 w-3.5" /> :
    <LinkIcon className="h-3.5 w-3.5" />;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-[var(--border)] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
          Inspector
        </p>
        <p className="mt-0.5 text-sm font-semibold text-[var(--foreground)] truncate">
          {label || "—"}
        </p>
        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
          {linkTypeIcon}
          <span>{NAV_LINK_TYPE_LABEL[linkType] ?? linkType}</span>
          <span className="text-[var(--border)]">·</span>
          <Globe className="h-3 w-3" />
          <span>{NAV_AREA_SHORT_LABEL[item.area as NavArea] ?? item.area}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {/* Label */}
        <div>
          <label className={labelClass}>Bezeichnung</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="fca-input"
            placeholder="Menüpunkt-Bezeichnung"
          />
        </div>

        {/* Link type */}
        <div>
          <label className={labelClass}>Link-Typ</label>
          <select
            value={linkType}
            onChange={(e) => setLinkType(e.target.value as NavLinkType)}
            className="fca-input"
          >
            {Object.entries(NAV_LINK_TYPE).map(([, v]) => (
              <option key={v} value={v}>{NAV_LINK_TYPE_LABEL[v] ?? v}</option>
            ))}
          </select>
        </div>

        {/* Href */}
        <div>
          <label className={labelClass}>URL / Pfad</label>
          <input
            type={linkType === NAV_LINK_TYPE.EXTERNAL ? "url" : "text"}
            value={href}
            onChange={(e) => setHref(e.target.value)}
            placeholder={linkType === NAV_LINK_TYPE.EXTERNAL ? "https://…" : "/seite"}
            className="fca-input text-xs font-mono"
          />
        </div>

        {/* Target */}
        <div>
          <label className={labelClass}>Ziel</label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as NavTarget)}
            className="fca-input"
          >
            {Object.entries(NAV_TARGET).map(([, v]) => (
              <option key={v} value={v}>{NAV_TARGET_LABEL[v] ?? v}</option>
            ))}
          </select>
        </div>

        <hr className="border-[var(--border)]" />

        {/* Visibility */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-2">
            Sichtbarkeit
          </p>
          <div className="flex items-center gap-3 mb-3">
            <button
              type="button"
              role="switch"
              aria-checked={isVisible}
              onClick={() => setIsVisible((v) => !v)}
              className={[
                "relative inline-flex h-5 w-9 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                isVisible ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]",
              ].join(" ")}
            >
              <span className={[
                "inline-block h-4 w-4 transform rounded-full bg-white shadow transition",
                isVisible ? "translate-x-4" : "translate-x-0",
              ].join(" ")} />
            </button>
            <span className="text-xs text-[var(--foreground)]">
              {isVisible ? <><Eye className="inline h-3 w-3 mr-1" />Sichtbar</> : <><EyeOff className="inline h-3 w-3 mr-1" />Versteckt</>}
            </span>
          </div>

          <label className={labelClass}>Sichtbarkeits-Modus</label>
          <select
            value={visibilityMode}
            onChange={(e) => setVisibilityMode(e.target.value as NavVisibilityMode)}
            className="fca-input"
          >
            {Object.entries(NAV_VISIBILITY_MODE).map(([, v]) => (
              <option key={v} value={v}>{NAV_VISIBILITY_MODE_LABEL[v] ?? v}</option>
            ))}
          </select>
        </div>

        {/* CMS V4.2: Scheduling window */}
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-2">
            <Calendar className="h-3 w-3" />
            Zeitfenster (CMS V4.2)
          </p>
          <div className="space-y-2">
            <div>
              <label className={labelClass}>Sichtbar ab</label>
              <input
                type="datetime-local"
                value={visibleFrom}
                onChange={(e) => setVisibleFrom(e.target.value)}
                className="fca-input text-xs"
              />
            </div>
            <div>
              <label className={labelClass}>Sichtbar bis</label>
              <input
                type="datetime-local"
                value={visibleUntil}
                onChange={(e) => setVisibleUntil(e.target.value)}
                className="fca-input text-xs"
              />
            </div>
            <p className="text-[10px] text-[var(--muted)]">
              Leer lassen = keine Zeitbeschränkung. Bestehende Navigationspunkte
              ohne Zeitfenster werden nicht beeinträchtigt.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--border)] px-4 py-3 space-y-2">
        {saveError && (
          <p className="text-xs text-rose-600">{saveError}</p>
        )}
        {saveSuccess && (
          <p className="text-xs text-emerald-600">Gespeichert.</p>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="fca-button-primary w-full justify-center"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? "Speichern…" : "Änderungen speichern"}
        </button>
      </div>
    </div>
  );
}

// ── Preview bar ───────────────────────────────────────────────────────────────

function PreviewBar({
  areas,
  mode,
  onModeChange,
}: {
  areas: GroupedAreas;
  mode: PreviewMode;
  onModeChange: (m: PreviewMode) => void;
}) {
  const headerItems = areas.HEADER?.filter((i) => i.isVisible) ?? [];

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      {/* Mode toggle */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
          Vorschau
        </p>
        <div className="flex gap-1">
          {([["desktop", Monitor], ["mobile", Smartphone]] as [PreviewMode, typeof Monitor][]).map(([m, Icon]) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={[
                "flex h-6 w-6 items-center justify-center rounded transition",
                mode === m
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:bg-[var(--surface-2)]",
              ].join(" ")}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </div>

      {/* Header preview */}
      <div className={["p-3", mode === "mobile" ? "max-w-[375px] mx-auto" : ""].join(" ")}>
        <div
          className="rounded-lg border border-[var(--border)] px-4 py-2 flex items-center gap-4"
          style={{ background: "var(--surface-2)" }}
        >
          <span className="text-[10px] font-bold text-[var(--foreground)]">FC Allschwil</span>
          {mode === "desktop" ? (
            <nav className="flex-1 flex items-center gap-3">
              {headerItems.map((item) => (
                <span key={item.id} className="text-[10px] text-[var(--text-2)] hover:text-[var(--foreground)] cursor-pointer">
                  {item.label}
                </span>
              ))}
            </nav>
          ) : (
            <div className="ml-auto text-[var(--muted)]">
              <span className="text-lg">≡</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NavigationVisualBuilder() {
  const [areas, setAreas] = useState<GroupedAreas>({} as GroupedAreas);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/website-navigation");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Fehler beim Laden.");
        return;
      }
      setAreas(data.areas ?? {});
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSaved(updated: NavItemTree) {
    setSelectedItem({ ...updated } as SelectedItem);
    load();
  }

  const allItems: NavItemTree[] = NAV_AREA_ORDER.flatMap(
    (area) => (areas[area] ?? []),
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--muted)] py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Navigation laden…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error}
        <button type="button" onClick={load} className="ml-3 underline text-xs">
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--muted)]">
          {allItems.length} Navigationselemente
          {selectedItem ? ` · Ausgewählt: ${selectedItem.label}` : ""}
        </p>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Aktualisieren
        </button>
      </div>

      {/* Main layout: Tree + Inspector */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Tree */}
        <div className="sce-detail-section">
          <div className="sce-detail-section-header flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Navigationsstruktur
            </p>
          </div>
          <div className="sce-detail-section-body">
            {NAV_AREA_ORDER.map((area) => {
              const items = areas[area] ?? [];
              return (
                <div key={area} className="mb-4 last:mb-0">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                    {NAV_AREA_LABEL[area]}
                  </p>
                  {items.length === 0 ? (
                    <p className="text-xs text-[var(--muted)] pl-2">— keine Einträge —</p>
                  ) : (
                    items.map((item) => (
                      <TreeNode
                        key={item.id}
                        item={item}
                        selectedId={selectedItem?.id ?? null}
                        onSelect={(i) => setSelectedItem(i as SelectedItem)}
                      />
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Inspector */}
        <div className="sce-detail-section overflow-hidden" style={{ minHeight: 400 }}>
          {selectedItem ? (
            <InspectorPanel item={selectedItem} onSaved={handleSaved} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center p-6">
              <Settings className="h-8 w-8 text-[var(--muted)]" />
              <p className="text-sm font-medium text-[var(--foreground)]">
                Inspector
              </p>
              <p className="text-xs text-[var(--muted)]">
                Navigationselement auswählen um es zu bearbeiten.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Desktop/Mobile preview */}
      <PreviewBar areas={areas} mode={previewMode} onModeChange={setPreviewMode} />
    </div>
  );
}
