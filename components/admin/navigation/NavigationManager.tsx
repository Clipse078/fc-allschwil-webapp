"use client";

/**
 * NavigationManager — CMS V4.2 Visual Navigation Builder
 *
 * Upgrades from rows/edit-buttons/tables to:
 *   - Visual drag-and-drop hierarchy (native HTML5 DnD)
 *   - Right-side Inspector panel for item editing
 *   - Mega menu toggle for top-level items
 *   - Scheduling (show/hide date range)
 *   - Badge labels (NEU, BETA, etc.)
 *   - Mobile nav preview
 *   - Live website preview indicator
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type FormEvent,
  type DragEvent,
} from "react";
import {
  Menu,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Plus,
  RefreshCw,
  Sparkles,
  ChevronRight,
  ExternalLink,
  X,
  Check,
  AlertCircle,
  Globe,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Monitor,
  Layers,
  Clock,
  Tag,
  LayoutGrid,
  Save,
  Loader2,
} from "lucide-react";
import { EmptyState } from "@/components/ui/page";
import {
  NAV_AREA,
  NAV_AREA_LABEL,
  NAV_AREA_SHORT_LABEL,
  NAV_AREA_ORDER,
  NAV_LINK_TYPE,
  NAV_LINK_TYPE_LABEL,
  NAV_TARGET,
  NAV_TARGET_LABEL,
  NAV_VISIBILITY_MODE,
  NAV_VISIBILITY_MODE_LABEL,
  type NavArea,
  type NavLinkType,
  type NavTarget,
  type NavVisibilityMode,
} from "@/lib/navigation/constants";
import type { NavItemTree } from "@/lib/navigation/admin-queries";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GroupedAreas = Record<NavArea, NavItemTree[]>;

type ApiResponse = {
  areas: GroupedAreas;
  meta: { total: number };
};

type InspectorState = {
  item: NavItemTree;
  mode: "edit";
} | {
  item: null;
  mode: "create";
  defaultArea: NavArea;
  defaultParentId: string | null;
};

type FormState = {
  label: string;
  area: NavArea;
  linkType: NavLinkType;
  href: string;
  target: NavTarget;
  isVisible: boolean;
  visibilityMode: NavVisibilityMode;
  parentId: string | null;
  // V4.2
  icon: string;
  megaMenu: boolean;
  description: string;
  badge: string;
  scheduleFrom: string;
  scheduleTo: string;
};

const EMPTY_FORM: FormState = {
  label: "",
  area: NAV_AREA.HEADER,
  linkType: NAV_LINK_TYPE.INTERNAL,
  href: "",
  target: NAV_TARGET.SELF,
  isVisible: true,
  visibilityMode: NAV_VISIBILITY_MODE.ALWAYS,
  parentId: null,
  icon: "",
  megaMenu: false,
  description: "",
  badge: "",
  scheduleFrom: "",
  scheduleTo: "",
};

// ---------------------------------------------------------------------------
// Area color config
// ---------------------------------------------------------------------------

const AREA_COLORS: Record<NavArea, { bg: string; border: string; icon: string; dot: string; badgeCls: string }> = {
  HEADER: { bg: "rgba(14,165,233,0.06)", border: "#0EA5E9", icon: "#0EA5E9", dot: "bg-sky-500", badgeCls: "bg-sky-50 text-sky-700 border-sky-200" },
  FOOTER: { bg: "rgba(139,92,246,0.06)", border: "#8B5CF6", icon: "#8B5CF6", dot: "bg-violet-500", badgeCls: "bg-violet-50 text-violet-700 border-violet-200" },
  UTILITY: { bg: "rgba(16,185,129,0.06)", border: "#10B981", icon: "#10B981", dot: "bg-emerald-500", badgeCls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

function toLocalDatetimeInput(d: Date | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

// ---------------------------------------------------------------------------
// Drag state context (simple ref-based, no context API needed)
// ---------------------------------------------------------------------------

type DragPayload = { id: string; area: NavArea; parentId: string | null };

// ---------------------------------------------------------------------------
// Mobile preview component
// ---------------------------------------------------------------------------

function MobileNavPreview({ items }: { items: NavItemTree[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const visible = items.filter((i) => i.isVisible);
  return (
    <div className="mx-auto w-72 overflow-hidden rounded-2xl border-4 border-[var(--foreground)] bg-white shadow-2xl">
      {/* Status bar */}
      <div className="flex items-center justify-between bg-[var(--foreground)] px-4 py-1.5">
        <span className="text-[10px] font-semibold text-white">9:41</span>
        <div className="flex gap-1">
          <div className="h-1.5 w-4 rounded-full bg-white/80" />
          <div className="h-1.5 w-1.5 rounded-full bg-white/80" />
          <div className="h-1.5 w-1.5 rounded-full bg-white/80" />
        </div>
      </div>
      {/* Navbar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div className="h-6 w-16 rounded bg-gray-200" />
        <div className="flex h-6 w-6 items-center justify-center rounded">
          <Menu className="h-4 w-4 text-gray-600" />
        </div>
      </div>
      {/* Nav items */}
      <div className="divide-y divide-gray-100 bg-white">
        {visible.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-400">Keine sichtbaren Elemente</p>
        ) : (
          visible.map((item) => (
            <div key={item.id}>
              <button
                type="button"
                onClick={() => setOpenId(openId === item.id ? null : item.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">{item.label}</span>
                  {item.badge && (
                    <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-orange-700">
                      {item.badge}
                    </span>
                  )}
                </div>
                {item.children.length > 0 && (
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-gray-400 transition-transform ${openId === item.id ? "rotate-180" : ""}`}
                  />
                )}
              </button>
              {openId === item.id && item.children.length > 0 && (
                <div className="border-t border-gray-100 bg-gray-50 pl-6">
                  {item.children.filter((c) => c.isVisible).map((child) => (
                    <div
                      key={child.id}
                      className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5 last:border-b-0"
                    >
                      <span className="text-xs text-gray-700">{child.label}</span>
                      {child.badge && (
                        <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-orange-700">
                          {child.badge}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop Mega-menu preview component
// ---------------------------------------------------------------------------

function DesktopNavPreview({ items }: { items: NavItemTree[] }) {
  const visible = items.filter((i) => i.isVisible);
  return (
    <div className="w-full overflow-hidden rounded-xl border-2 border-[var(--foreground)] bg-white shadow-xl">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-100 px-4 py-2">
        <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <div className="ml-3 flex-1 rounded-md bg-white px-3 py-1 text-[10px] text-gray-400">
          www.website.ch
        </div>
      </div>
      {/* Nav bar */}
      <div className="flex items-center gap-6 border-b border-gray-100 bg-white px-6 py-3">
        <div className="h-6 w-20 rounded bg-gray-200" />
        <div className="flex items-center gap-5">
          {visible.map((item) => (
            <div key={item.id} className="flex items-center gap-1">
              <span className="text-xs font-medium text-gray-700">{item.label}</span>
              {item.badge && (
                <span className="rounded-full bg-orange-100 px-1 py-0.5 text-[8px] font-bold uppercase text-orange-700">
                  {item.badge}
                </span>
              )}
              {item.children.length > 0 && (
                <ChevronDown className="h-2.5 w-2.5 text-gray-400" />
              )}
              {item.megaMenu && (
                <LayoutGrid className="h-2.5 w-2.5 text-blue-400" aria-label="Mega-Menü aktiv" />
              )}
            </div>
          ))}
        </div>
      </div>
      {/* Page body placeholder */}
      <div className="p-4">
        <div className="h-2 w-3/4 rounded bg-gray-100" />
        <div className="mt-2 h-2 w-1/2 rounded bg-gray-100" />
        <div className="mt-2 h-2 w-2/3 rounded bg-gray-100" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nav item drag card
// ---------------------------------------------------------------------------

type NavItemCardProps = {
  item: NavItemTree;
  depth: number;
  isFirst: boolean;
  isLast: boolean;
  dragPayload: React.MutableRefObject<DragPayload | null>;
  onToggle: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onInspect: (item: NavItemTree) => void;
  onDelete: (item: NavItemTree) => void;
  onAddChild: (parentId: string, area: NavArea) => void;
  isLoading: boolean;
  dropTargetId: string | null;
  setDropTargetId: (id: string | null) => void;
  onDrop: (draggedId: string, targetId: string) => void;
};

function NavItemCard({
  item,
  depth,
  isFirst,
  isLast,
  dragPayload,
  onToggle,
  onMoveUp,
  onMoveDown,
  onInspect,
  onDelete,
  onAddChild,
  isLoading,
  dropTargetId,
  setDropTargetId,
  onDrop,
}: NavItemCardProps) {
  const isChild = depth > 0;
  const isDragging = false;
  const isDropTarget = dropTargetId === item.id;

  function handleDragStart(e: DragEvent<HTMLDivElement>) {
    dragPayload.current = {
      id: item.id,
      area: item.area as NavArea,
      parentId: item.parentId,
    };
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragPayload.current?.id !== item.id) {
      setDropTargetId(item.id);
    }
  }

  function handleDragLeave() {
    setDropTargetId(null);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDropTargetId(null);
    const dragged = dragPayload.current;
    if (!dragged || dragged.id === item.id) return;
    onDrop(dragged.id, item.id);
    dragPayload.current = null;
  }

  return (
    <>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          "group flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 last:border-b-0 transition-colors",
          isChild ? "bg-[var(--surface-2)] pl-10" : "",
          isDropTarget ? "bg-blue-50 ring-2 ring-inset ring-blue-300" : "",
          "hover:bg-[var(--surface-2)]",
        ].join(" ")}
      >
        {/* Drag handle */}
        <div className="cursor-grab shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--muted)] active:cursor-grabbing">
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Hierarchy indicator */}
        {isChild && (
          <ChevronRight className="h-3 w-3 shrink-0 text-[var(--muted)]" />
        )}

        {/* Label + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-sm font-medium truncate ${!item.isVisible ? "text-[var(--muted)] line-through" : "text-[var(--foreground)]"}`}>
              {item.label}
            </span>
            {item.badge && (
              <span className="rounded-full border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-orange-700">
                {item.badge}
              </span>
            )}
            {item.megaMenu && depth === 0 && (
              <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                <LayoutGrid className="h-2.5 w-2.5" />
                Mega
              </span>
            )}
            {item.scheduleFrom || item.scheduleTo ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                <Clock className="h-2.5 w-2.5" />
                Zeitplan
              </span>
            ) : null}
            {item.linkType === NAV_LINK_TYPE.EXTERNAL && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                <ExternalLink className="h-2.5 w-2.5" />
                Extern
              </span>
            )}
            {!item.isVisible && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] text-[var(--muted)]">
                <EyeOff className="h-2.5 w-2.5" />
                Versteckt
              </span>
            )}
          </div>
          {item.href && (
            <p className="mt-0.5 truncate text-[11px] text-[var(--muted)] font-mono">
              {item.href}
            </p>
          )}
          {item.description && (
            <p className="mt-0.5 truncate text-[11px] text-[var(--text-2)] italic">
              {item.description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button title="Nach oben" type="button" onClick={() => onMoveUp(item.id)} disabled={isLoading || isFirst}
            className="flex h-7 w-7 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] disabled:opacity-30">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button title="Nach unten" type="button" onClick={() => onMoveDown(item.id)} disabled={isLoading || isLast}
            className="flex h-7 w-7 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] disabled:opacity-30">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button title={item.isVisible ? "Ausblenden" : "Einblenden"} type="button" onClick={() => onToggle(item.id)} disabled={isLoading}
            className={`flex h-7 w-7 items-center justify-center rounded disabled:opacity-50 ${item.isVisible ? "text-emerald-600 hover:bg-emerald-50" : "text-[var(--muted)] hover:bg-[var(--surface-2)]"}`}>
            {item.isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
          {depth === 0 && (
            <button title="Unterelement hinzufügen" type="button" onClick={() => onAddChild(item.id, item.area as NavArea)} disabled={isLoading}
              className="flex h-7 w-7 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] disabled:opacity-50">
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
          <button title="Bearbeiten (Inspector)" type="button" onClick={() => onInspect(item)} disabled={isLoading}
            className="flex h-7 w-7 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] disabled:opacity-50">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button title="Löschen" type="button" onClick={() => onDelete(item)} disabled={isLoading}
            className="flex h-7 w-7 items-center justify-center rounded text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Render children */}
      {item.children && item.children.length > 0 &&
        item.children.map((child, ci) => (
          <NavItemCard
            key={child.id}
            item={child}
            depth={depth + 1}
            isFirst={ci === 0}
            isLast={ci === item.children!.length - 1}
            dragPayload={dragPayload}
            onToggle={onToggle}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onInspect={onInspect}
            onDelete={onDelete}
            onAddChild={onAddChild}
            isLoading={isLoading}
            dropTargetId={dropTargetId}
            setDropTargetId={setDropTargetId}
            onDrop={onDrop}
          />
        ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Inspector panel
// ---------------------------------------------------------------------------

type InspectorPanelProps = {
  state: InspectorState;
  parentOptions: { id: string; label: string; area: NavArea }[];
  onSave: (form: FormState) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
  error: string | null;
};

function InspectorPanel({ state, parentOptions, onSave, onClose, isSaving, error }: InspectorPanelProps) {
  const [form, setForm] = useState<FormState>(() => {
    if (state.mode === "edit" && state.item) {
      return {
        label: state.item.label,
        area: state.item.area as NavArea,
        linkType: state.item.linkType as NavLinkType,
        href: state.item.href ?? "",
        target: state.item.target as NavTarget,
        isVisible: state.item.isVisible,
        visibilityMode: state.item.visibilityMode as NavVisibilityMode,
        parentId: state.item.parentId,
        icon: state.item.icon ?? "",
        megaMenu: state.item.megaMenu,
        description: state.item.description ?? "",
        badge: state.item.badge ?? "",
        scheduleFrom: toLocalDatetimeInput(state.item.scheduleFrom),
        scheduleTo: toLocalDatetimeInput(state.item.scheduleTo),
      };
    }
    return {
      ...EMPTY_FORM,
      area: state.mode === "create" ? state.defaultArea : NAV_AREA.HEADER,
      parentId: state.mode === "create" ? state.defaultParentId : null,
    };
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const filteredParents = parentOptions.filter(
    (p) => p.area === form.area && (state.mode === "create" || p.id !== state.item?.id),
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSave(form);
  }

  const isEdit = state.mode === "edit";

  return (
    <div className="flex h-full flex-col">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {isEdit ? "Element bearbeiten" : "Neues Element"}
          </p>
          {isEdit && state.item && (
            <p className="mt-0.5 truncate text-sm font-semibold text-[var(--foreground)]">
              {state.item.label}
            </p>
          )}
        </div>
        <button type="button" onClick={onClose}
          className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex-1 space-y-4 p-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Label */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Label <span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.label} onChange={(e) => set("label", e.target.value)}
              placeholder="z.B. News" className="fca-input text-sm" required />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Beschreibung
            </label>
            <input type="text" value={form.description} onChange={(e) => set("description", e.target.value)}
              placeholder="Kurzbeschreibung für Mega-Menü oder Tooltip…" className="fca-input text-xs" />
          </div>

          {/* Badge */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Badge
            </label>
            <input type="text" value={form.badge} onChange={(e) => set("badge", e.target.value)}
              placeholder="NEU, BETA, HOT…" className="fca-input text-xs" maxLength={8} />
            <p className="mt-0.5 text-[10px] text-[var(--muted)]">Kleines Label neben dem Menüpunkt. Max. 8 Zeichen.</p>
          </div>

          {/* Area + Parent */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Bereich</label>
              <select value={form.area} onChange={(e) => { set("area", e.target.value as NavArea); set("parentId", null); }}
                className="fca-input text-xs">
                {NAV_AREA_ORDER.map((area) => (
                  <option key={area} value={area}>{NAV_AREA_SHORT_LABEL[area]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Elternelement</label>
              <select value={form.parentId ?? ""} onChange={(e) => set("parentId", e.target.value || null)}
                className="fca-input text-xs">
                <option value="">— Top-Level —</option>
                {filteredParents.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Link type + URL */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Link-Typ</label>
            <select value={form.linkType} onChange={(e) => set("linkType", e.target.value as NavLinkType)}
              className="fca-input text-xs">
              {Object.entries(NAV_LINK_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              URL / Pfad
            </label>
            <input type="text" value={form.href} onChange={(e) => set("href", e.target.value)}
              placeholder={form.linkType === NAV_LINK_TYPE.INTERNAL ? "/news" : "https://example.com"}
              className="fca-input font-mono text-xs" />
          </div>

          {/* Target */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Ziel</label>
            <select value={form.target} onChange={(e) => set("target", e.target.value as NavTarget)}
              className="fca-input text-xs">
              {Object.entries(NAV_TARGET_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Visibility mode */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Sichtbarkeitsmodus</label>
            <select value={form.visibilityMode} onChange={(e) => set("visibilityMode", e.target.value as NavVisibilityMode)}
              className="fca-input text-xs">
              {Object.entries(NAV_VISIBILITY_MODE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Scheduling */}
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              <Clock className="h-3 w-3" />
              Zeitplanung
            </label>
            <div className="space-y-2">
              <div>
                <p className="mb-0.5 text-[10px] text-[var(--muted)]">Sichtbar ab</p>
                <input type="datetime-local" value={form.scheduleFrom} onChange={(e) => set("scheduleFrom", e.target.value)}
                  className="fca-input text-xs" />
              </div>
              <div>
                <p className="mb-0.5 text-[10px] text-[var(--muted)]">Sichtbar bis</p>
                <input type="datetime-local" value={form.scheduleTo} onChange={(e) => set("scheduleTo", e.target.value)}
                  className="fca-input text-xs" />
              </div>
            </div>
          </div>

          {/* V4.2 toggles */}
          <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Optionen
            </p>

            {/* isVisible toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-2)]">In der Navigation sichtbar</span>
              <button type="button" role="switch" aria-checked={form.isVisible}
                onClick={() => set("isVisible", !form.isVisible)}
                className={`relative h-5 w-9 rounded-full transition-colors ${form.isVisible ? "bg-emerald-500" : "bg-[var(--border)]"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.isVisible ? "translate-x-4.5" : "translate-x-0.5"}`} />
              </button>
            </div>

            {/* megaMenu toggle (only for top-level) */}
            {!form.parentId && form.area === NAV_AREA.HEADER && (
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-[var(--text-2)]">Mega-Menü aktivieren</span>
                  <p className="text-[10px] text-[var(--muted)]">Panel mit Unter-Links im Header</p>
                </div>
                <button type="button" role="switch" aria-checked={form.megaMenu}
                  onClick={() => set("megaMenu", !form.megaMenu)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${form.megaMenu ? "bg-blue-500" : "bg-[var(--border)]"}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.megaMenu ? "translate-x-4.5" : "translate-x-0.5"}`} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-[var(--border)] p-4">
          <div className="flex gap-2">
            <button type="submit" disabled={isSaving}
              className="fca-button-primary flex-1 text-sm">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isEdit ? "Speichern" : "Erstellen"}
            </button>
            <button type="button" onClick={onClose} disabled={isSaving}
              className="fca-button-secondary text-sm">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main NavigationManager
// ---------------------------------------------------------------------------

type Props = {
  initialData: ApiResponse | null;
};

export default function NavigationManager({ initialData }: Props) {
  const [areas, setAreas] = useState<GroupedAreas>(
    initialData?.areas ?? {
      [NAV_AREA.HEADER]: [],
      [NAV_AREA.FOOTER]: [],
      [NAV_AREA.UTILITY]: [],
    },
  );
  const [total, setTotal] = useState(initialData?.meta?.total ?? 0);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [inspector, setInspector] = useState<InspectorState | null>(null);
  const [inspectorError, setInspectorError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<NavItemTree | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [showPreview, setShowPreview] = useState(false);
  const [activeArea, setActiveArea] = useState<NavArea>(NAV_AREA.HEADER);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const dragPayload = useRef<DragPayload | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/website-navigation");
      if (!res.ok) throw new Error("Fehler beim Laden der Navigation.");
      const data: ApiResponse = await res.json();
      setAreas(data.areas);
      setTotal(data.meta.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialData) load();
  }, [initialData, load]);

  // ── All top-level items across all areas for parent selector ──────────────
  const allTopLevel = NAV_AREA_ORDER.flatMap((area) =>
    (areas[area] ?? []).map((item) => ({ id: item.id, label: item.label, area })),
  );

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleToggle(id: string) {
    try {
      const res = await fetch(`/api/website-navigation/${id}?action=toggle`, {
        method: "POST",
      });
      if (!res.ok) return;
      await load();
    } catch { /* silent */ }
  }

  async function handleMoveUp(id: string) {
    try {
      await fetch(`/api/website-navigation/${id}?action=move&direction=up`, { method: "POST" });
      await load();
    } catch { /* silent */ }
  }

  async function handleMoveDown(id: string) {
    try {
      await fetch(`/api/website-navigation/${id}?action=move&direction=down`, { method: "POST" });
      await load();
    } catch { /* silent */ }
  }

  async function handleDrop(draggedId: string, targetId: string) {
    try {
      await fetch(`/api/website-navigation/${draggedId}?action=reorder-before`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beforeId: targetId }),
      });
      await load();
    } catch { /* silent */ }
  }

  function handleInspect(item: NavItemTree) {
    setInspector({ item, mode: "edit" });
    setInspectorError(null);
  }

  function handleAddToArea(area: NavArea, parentId: string | null) {
    setInspector({ item: null, mode: "create", defaultArea: area, defaultParentId: parentId });
    setInspectorError(null);
  }

  async function handleSave(form: FormState) {
    if (!inspector) return;
    setIsSaving(true);
    setInspectorError(null);

    const body = {
      label: form.label,
      area: form.area,
      linkType: form.linkType,
      href: form.href || null,
      target: form.target,
      isVisible: form.isVisible,
      visibilityMode: form.visibilityMode,
      parentId: form.parentId,
      icon: form.icon || null,
      megaMenu: form.megaMenu,
      description: form.description || null,
      badge: form.badge || null,
      scheduleFrom: form.scheduleFrom || null,
      scheduleTo: form.scheduleTo || null,
    };

    try {
      const url =
        inspector.mode === "edit"
          ? `/api/website-navigation/${inspector.item.id}`
          : "/api/website-navigation";
      const method = inspector.mode === "edit" ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInspectorError(data?.error ?? "Fehler beim Speichern.");
        return;
      }
      setInspector(null);
      await load();
    } catch {
      setInspectorError("Netzwerkfehler.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteConfirm) return;
    setDeleteError(null);
    try {
      const res = await fetch(`/api/website-navigation/${deleteConfirm.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setDeleteError(data?.error ?? "Fehler beim Löschen."); return; }
      setDeleteConfirm(null);
      await load();
    } catch {
      setDeleteError("Netzwerkfehler.");
    }
  }

  async function handleBootstrap() {
    try {
      const res = await fetch("/api/website-navigation?bootstrap=1", { method: "POST" });
      if (!res.ok) return;
      await load();
    } catch { /* silent */ }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const previewItems = areas[activeArea] ?? [];

  return (
    <div className="flex h-full gap-0 overflow-hidden">
      {/* ── Left: Nav tree ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
          <div className="flex items-center gap-3">
            <Menu className="h-4 w-4 text-[var(--muted)]" />
            <span className="text-sm font-semibold text-[var(--foreground)]">Navigation Builder</span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
              {total} Elemente
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowPreview((v) => !v)}
              className={`fca-button-ghost flex items-center gap-1.5 text-xs ${showPreview ? "text-[var(--accent)]" : ""}`}>
              <Globe className="h-3.5 w-3.5" />
              {showPreview ? "Vorschau schließen" : "Vorschau"}
            </button>
            <button type="button" onClick={load} disabled={isLoading}
              className="fca-button-ghost flex items-center gap-1.5 text-xs">
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            {total === 0 && (
              <button type="button" onClick={handleBootstrap}
                className="fca-button-secondary flex items-center gap-1.5 text-xs">
                <Sparkles className="h-3.5 w-3.5" />
                Standard-Navigation erstellen
              </button>
            )}
          </div>
        </div>

        {/* Area tabs */}
        <div className="flex border-b border-[var(--border)] bg-[var(--surface)]">
          {NAV_AREA_ORDER.map((area) => {
            const count = areas[area]?.length ?? 0;
            const colors = AREA_COLORS[area];
            return (
              <button
                key={area}
                type="button"
                onClick={() => setActiveArea(area)}
                className={[
                  "flex items-center gap-2 px-5 py-3 text-xs font-semibold transition-colors",
                  activeArea === area
                    ? "border-b-2 text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]",
                ].join(" ")}
                style={activeArea === area ? { borderColor: colors.border } : {}}
              >
                <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
                {NAV_AREA_SHORT_LABEL[area]}
                <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${colors.badgeCls}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="m-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Nav items for active area */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="h-5 w-5 animate-spin text-[var(--muted)]" />
            </div>
          ) : (areas[activeArea] ?? []).length === 0 ? (
            <EmptyState
              icon={<Menu className="h-8 w-8" />}
              heading={`Keine Elemente in ${NAV_AREA_LABEL[activeArea]}`}
              description="Fügen Sie das erste Navigationselement hinzu."
              action={
                <button type="button" onClick={() => handleAddToArea(activeArea, null)}
                  className="fca-button-primary text-sm">
                  <Plus className="h-4 w-4" />
                  Erstes Element hinzufügen
                </button>
              }
            />
          ) : (
            <div className="divide-y divide-[var(--border)] rounded-none">
              {(areas[activeArea] ?? []).map((item, i, arr) => (
                <NavItemCard
                  key={item.id}
                  item={item}
                  depth={0}
                  isFirst={i === 0}
                  isLast={i === arr.length - 1}
                  dragPayload={dragPayload}
                  onToggle={handleToggle}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                  onInspect={handleInspect}
                  onDelete={setDeleteConfirm}
                  onAddChild={(parentId, area) => handleAddToArea(area, parentId)}
                  isLoading={isLoading}
                  dropTargetId={dropTargetId}
                  setDropTargetId={setDropTargetId}
                  onDrop={handleDrop}
                />
              ))}
            </div>
          )}
        </div>

        {/* Add top-level button */}
        <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <button
            type="button"
            onClick={() => handleAddToArea(activeArea, null)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border)] py-2.5 text-xs font-medium text-[var(--muted)] transition-colors hover:border-[var(--tenant-primary)] hover:text-[var(--tenant-primary)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Element zu {NAV_AREA_SHORT_LABEL[activeArea]} hinzufügen
          </button>
        </div>
      </div>

      {/* ── Inspector panel ─────────────────────────────────────────────────── */}
      {inspector && (
        <div className="w-72 shrink-0 overflow-hidden border-l border-[var(--border)] bg-[var(--surface)]">
          <InspectorPanel
            state={inspector}
            parentOptions={allTopLevel}
            onSave={handleSave}
            onClose={() => setInspector(null)}
            isSaving={isSaving}
            error={inspectorError}
          />
        </div>
      )}

      {/* ── Preview panel ───────────────────────────────────────────────────── */}
      {showPreview && (
        <div className="w-80 shrink-0 overflow-hidden border-l border-[var(--border)] bg-[var(--surface-2)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <p className="text-xs font-semibold text-[var(--foreground)]">Live-Vorschau</p>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setPreviewMode("desktop")}
                className={`rounded p-1.5 text-[var(--muted)] transition-colors ${previewMode === "desktop" ? "bg-[var(--surface-2)] text-[var(--foreground)]" : "hover:bg-[var(--surface-2)]"}`}>
                <Monitor className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => setPreviewMode("mobile")}
                className={`rounded p-1.5 text-[var(--muted)] transition-colors ${previewMode === "mobile" ? "bg-[var(--surface-2)] text-[var(--foreground)]" : "hover:bg-[var(--surface-2)]"}`}>
                <Smartphone className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="p-4 overflow-y-auto">
            {previewMode === "mobile" ? (
              <MobileNavPreview items={previewItems} />
            ) : (
              <DesktopNavPreview items={previewItems} />
            )}
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ───────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-sm overflow-hidden rounded-2xl bg-[var(--surface)] shadow-2xl">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">Element löschen?</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-[var(--text-2)]">
                <span className="font-semibold text-[var(--foreground)]">{deleteConfirm.label}</span>{" "}
                wird dauerhaft aus der Navigation entfernt.
              </p>
              {deleteConfirm.children && deleteConfirm.children.length > 0 && (
                <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  Dieses Element hat {deleteConfirm.children.length} Unterelement(e). Diese müssen zuerst entfernt werden.
                </p>
              )}
              {deleteError && (
                <p className="mt-2 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">{deleteError}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
              <button type="button" onClick={() => { setDeleteConfirm(null); setDeleteError(null); }}
                className="fca-button-secondary text-sm">Abbrechen</button>
              <button type="button" onClick={handleDeleteConfirmed}
                className="fca-button-primary bg-rose-600 text-sm">Löschen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
