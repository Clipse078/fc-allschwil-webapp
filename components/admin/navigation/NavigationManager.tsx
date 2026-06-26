"use client";

import {
  useState,
  useEffect,
  useCallback,
  type FormEvent,
} from "react";
import {
  Menu,
  ChevronUp,
  ChevronDown,
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

type FormState = {
  label: string;
  area: NavArea;
  linkType: NavLinkType;
  href: string;
  target: NavTarget;
  isVisible: boolean;
  visibilityMode: NavVisibilityMode;
  parentId: string | null;
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
};

// ---------------------------------------------------------------------------
// Area color config
// ---------------------------------------------------------------------------

const AREA_COLORS: Record<NavArea, { bg: string; border: string; icon: string; dot: string }> = {
  HEADER: { bg: "rgba(14,165,233,0.06)", border: "#0EA5E9", icon: "#0EA5E9", dot: "bg-sky-500" },
  FOOTER: { bg: "rgba(139,92,246,0.06)", border: "#8B5CF6", icon: "#8B5CF6", dot: "bg-violet-500" },
  UTILITY: { bg: "rgba(16,185,129,0.06)", border: "#10B981", icon: "#10B981", dot: "bg-emerald-500" },
};

// ---------------------------------------------------------------------------
// Small helper components
// ---------------------------------------------------------------------------

function LinkTypeBadge({ linkType }: { linkType: string }) {
  const isExternal = linkType === NAV_LINK_TYPE.EXTERNAL;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
        isExternal
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)]"
      }`}
    >
      {isExternal && <ExternalLink className="h-2.5 w-2.5" />}
      {linkType}
    </span>
  );
}

function VisibilityBadge({ isVisible }: { isVisible: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        isVisible
          ? "bg-emerald-50 text-emerald-700"
          : "bg-[var(--surface-2)] text-[var(--muted)]"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isVisible ? "bg-emerald-500" : "bg-gray-300"}`} />
      {isVisible ? "Sichtbar" : "Versteckt"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Inline edit form
// ---------------------------------------------------------------------------

type NavItemFormProps = {
  initial?: Partial<FormState>;
  defaultArea?: NavArea;
  /** Parent options: top-level items available for selection */
  parentOptions: { id: string; label: string; area: NavArea }[];
  onSave: (data: FormState) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  error?: string | null;
  mode: "create" | "edit";
};

function NavItemForm({
  initial,
  defaultArea,
  parentOptions,
  onSave,
  onCancel,
  isSaving,
  error,
  mode,
}: NavItemFormProps) {
  const [form, setForm] = useState<FormState>({
    ...EMPTY_FORM,
    ...(defaultArea ? { area: defaultArea } : {}),
    ...initial,
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Filter parent options to same area, top-level only
  const filteredParents = parentOptions.filter((p) => p.area === form.area);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSave(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Label */}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-[var(--text-2)]">
            Label <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.label}
            onChange={(e) => set("label", e.target.value)}
            placeholder="z.B. News"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--tenant-primary)]"
            required
          />
        </div>

        {/* Area */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-2)]">Bereich</label>
          <select
            value={form.area}
            onChange={(e) => {
              set("area", e.target.value as NavArea);
              set("parentId", null); // reset parent on area change
            }}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--tenant-primary)]"
          >
            {NAV_AREA_ORDER.map((area) => (
              <option key={area} value={area}>
                {NAV_AREA_SHORT_LABEL[area]}
              </option>
            ))}
          </select>
        </div>

        {/* Parent */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-2)]">
            Übergeordnetes Element
          </label>
          <select
            value={form.parentId ?? ""}
            onChange={(e) => set("parentId", e.target.value || null)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--tenant-primary)]"
          >
            <option value="">— Kein Elternelement (Top-Level) —</option>
            {filteredParents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Link type */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-2)]">Link-Typ</label>
          <select
            value={form.linkType}
            onChange={(e) => set("linkType", e.target.value as NavLinkType)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--tenant-primary)]"
          >
            {Object.entries(NAV_LINK_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Href */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-2)]">
            URL / Pfad
            {form.linkType === NAV_LINK_TYPE.INTERNAL && (
              <span className="ml-1 text-[var(--muted)]">(z.B. /news)</span>
            )}
            {form.linkType === NAV_LINK_TYPE.EXTERNAL && (
              <span className="ml-1 text-[var(--muted)]">(https://...)</span>
            )}
          </label>
          <input
            type="text"
            value={form.href}
            onChange={(e) => set("href", e.target.value)}
            placeholder={
              form.linkType === NAV_LINK_TYPE.INTERNAL
                ? "/news"
                : form.linkType === NAV_LINK_TYPE.EXTERNAL
                ? "https://example.com"
                : "#"
            }
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--tenant-primary)]"
          />
        </div>

        {/* Target */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-2)]">Ziel</label>
          <select
            value={form.target}
            onChange={(e) => set("target", e.target.value as NavTarget)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--tenant-primary)]"
          >
            {Object.entries(NAV_TARGET_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Visibility mode */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-2)]">Sichtbarkeitsmodus</label>
          <select
            value={form.visibilityMode}
            onChange={(e) => set("visibilityMode", e.target.value as NavVisibilityMode)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--tenant-primary)]"
          >
            {Object.entries(NAV_VISIBILITY_MODE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* isVisible toggle */}
        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="button"
            role="switch"
            aria-checked={form.isVisible}
            onClick={() => set("isVisible", !form.isVisible)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--tenant-primary)] ${
              form.isVisible ? "bg-emerald-500" : "bg-[var(--border)]"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                form.isVisible ? "translate-x-4.5" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className="text-sm text-[var(--text-2)]">
            {form.isVisible ? "In der Navigation sichtbar" : "In der Navigation versteckt"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className="fca-button-primary text-sm"
        >
          {isSaving ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          {mode === "create" ? "Erstellen" : "Speichern"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="fca-button-secondary text-sm"
        >
          <X className="h-3.5 w-3.5" />
          Abbrechen
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Single nav item row
// ---------------------------------------------------------------------------

type NavItemRowProps = {
  item: NavItemTree;
  depth: number;
  isFirst: boolean;
  isLast: boolean;
  onToggle: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onEdit: (item: NavItemTree) => void;
  onDelete: (item: NavItemTree) => void;
  onAddChild: (parentId: string, area: NavArea) => void;
  isLoading: boolean;
};

function NavItemRow({
  item,
  depth,
  isFirst,
  isLast,
  onToggle,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
  onAddChild,
  isLoading,
}: NavItemRowProps) {
  const indent = depth > 0 ? "pl-8" : "";
  const isChild = depth > 0;

  return (
    <>
      <div
        className={`flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 last:border-b-0 ${
          isChild ? "bg-[var(--surface-2)]" : ""
        } ${indent}`}
      >
        {/* Hierarchy indicator */}
        {isChild && (
          <ChevronRight className="h-3 w-3 shrink-0 text-[var(--muted)]" />
        )}

        {/* Label + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[var(--foreground)] truncate">
              {item.label}
            </span>
            <LinkTypeBadge linkType={item.linkType} />
            <VisibilityBadge isVisible={item.isVisible} />
            {item.target === NAV_TARGET.BLANK && (
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
                <ExternalLink className="h-2.5 w-2.5" />
                Neuer Tab
              </span>
            )}
          </div>
          {item.href && (
            <p className="mt-0.5 truncate text-xs text-[var(--muted)] font-mono">
              {item.href}
            </p>
          )}
        </div>

        {/* Sort order indicator */}
        <span className="shrink-0 text-xs text-[var(--muted)] tabular-nums w-6 text-right">
          {item.sortOrder}
        </span>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            title="Nach oben"
            onClick={() => onMoveUp(item.id)}
            disabled={isLoading || isFirst}
            className="flex h-7 w-7 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            title="Nach unten"
            onClick={() => onMoveDown(item.id)}
            disabled={isLoading || isLast}
            className="flex h-7 w-7 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            title={item.isVisible ? "Ausblenden" : "Einblenden"}
            onClick={() => onToggle(item.id)}
            disabled={isLoading}
            className={`flex h-7 w-7 items-center justify-center rounded disabled:opacity-50 ${
              item.isVisible
                ? "text-emerald-600 hover:bg-emerald-50"
                : "text-[var(--muted)] hover:bg-[var(--surface-2)]"
            }`}
          >
            {item.isVisible ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
          </button>
          {depth === 0 && (
            <button
              title="Unterelement hinzufügen"
              onClick={() => onAddChild(item.id, item.area as NavArea)}
              disabled={isLoading}
              className="flex h-7 w-7 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            title="Bearbeiten"
            onClick={() => onEdit(item)}
            disabled={isLoading}
            className="flex h-7 w-7 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            title="Löschen"
            onClick={() => onDelete(item)}
            disabled={isLoading}
            className="flex h-7 w-7 items-center justify-center rounded text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Render children */}
      {item.children && item.children.length > 0 &&
        item.children.map((child, ci) => (
          <NavItemRow
            key={child.id}
            item={child}
            depth={depth + 1}
            isFirst={ci === 0}
            isLast={ci === item.children!.length - 1}
            onToggle={onToggle}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddChild={onAddChild}
            isLoading={isLoading}
          />
        ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Area section
// ---------------------------------------------------------------------------

type AreaSectionProps = {
  area: NavArea;
  items: NavItemTree[];
  onAdd: (area: NavArea, parentId: string | null) => void;
  onToggle: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onEdit: (item: NavItemTree) => void;
  onDelete: (item: NavItemTree) => void;
  isLoading: boolean;
};

function AreaSection({
  area,
  items,
  onAdd,
  onToggle,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
  isLoading,
}: AreaSectionProps) {
  const colors = AREA_COLORS[area];
  const label = NAV_AREA_LABEL[area];

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]"
        style={{ background: colors.bg }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`h-2 w-2 rounded-full ${colors.dot}`}
          />
          <span className="text-sm font-semibold text-[var(--foreground)]">
            {label}
          </span>
          <span className="text-xs text-[var(--muted)]">
            ({items.length} Element{items.length !== 1 ? "e" : ""})
          </span>
        </div>
        <button
          onClick={() => onAdd(area, null)}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)] disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          Hinzufügen
        </button>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-[var(--muted)]">
            Keine Navigationselemente in diesem Bereich.
          </p>
          <button
            onClick={() => onAdd(area, null)}
            className="mt-3 text-xs text-[var(--tenant-primary)] hover:underline"
          >
            Erstes Element hinzufügen →
          </button>
        </div>
      ) : (
        <div>
          {items.map((item, i) => (
            <NavItemRow
              key={item.id}
              item={item}
              depth={0}
              isFirst={i === 0}
              isLast={i === items.length - 1}
              onToggle={onToggle}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={(parentId, a) => onAdd(a, parentId)}
              isLoading={isLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main NavigationManager component
// ---------------------------------------------------------------------------

export default function NavigationManager() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingItem, setEditingItem] = useState<NavItemTree | null>(null);
  const [formDefaults, setFormDefaults] = useState<Partial<FormState>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation
  const [deletingItem, setDeletingItem] = useState<NavItemTree | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/website-navigation");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json() as ApiResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------

  async function handleBootstrap() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/website-navigation?bootstrap=1", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setIsLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Open create / edit form
  // ---------------------------------------------------------------------------

  function openCreate(area: NavArea, parentId: string | null) {
    setEditingItem(null);
    setFormDefaults({ area, parentId });
    setFormMode("create");
    setFormError(null);
  }

  function openEdit(item: NavItemTree) {
    setEditingItem(item);
    setFormDefaults({
      label: item.label,
      area: item.area as NavArea,
      linkType: item.linkType as NavLinkType,
      href: item.href ?? "",
      target: item.target as NavTarget,
      isVisible: item.isVisible,
      visibilityMode: item.visibilityMode as NavVisibilityMode,
      parentId: item.parentId,
    });
    setFormMode("edit");
    setFormError(null);
  }

  function closeForm() {
    setFormMode(null);
    setEditingItem(null);
    setFormDefaults({});
    setFormError(null);
  }

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  async function handleSave(formData: FormState) {
    setIsSaving(true);
    setFormError(null);
    try {
      const isEdit = formMode === "edit" && editingItem;
      const url = isEdit
        ? `/api/website-navigation/${editingItem.id}`
        : "/api/website-navigation";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: formData.label,
          area: formData.area,
          linkType: formData.linkType,
          href: formData.href || null,
          target: formData.target,
          isVisible: formData.isVisible,
          visibilityMode: formData.visibilityMode,
          parentId: formData.parentId || null,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(body.error ?? `HTTP ${res.status}`);
        return;
      }

      closeForm();
      await fetchData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setIsSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Toggle / Move
  // ---------------------------------------------------------------------------

  async function handleToggle(id: string) {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/website-navigation/${id}/toggle`, { method: "PATCH" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      await fetchData();
    } catch {
      setError("Fehler beim Umschalten der Sichtbarkeit.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMove(id: string, direction: "up" | "down") {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/website-navigation/${id}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      await fetchData();
    } catch {
      setError("Fehler beim Verschieben.");
    } finally {
      setIsLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  function startDelete(item: NavItemTree) {
    setDeletingItem(item);
    setDeleteError(null);
  }

  function cancelDelete() {
    setDeletingItem(null);
    setDeleteError(null);
    setIsDeleting(false);
  }

  async function confirmDelete() {
    if (!deletingItem) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/website-navigation/${deletingItem.id}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(body.error ?? `HTTP ${res.status}`);
        setIsDeleting(false);
        return;
      }
      setDeletingItem(null);
      await fetchData();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setIsDeleting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Collect parent options (top-level items across all areas)
  // ---------------------------------------------------------------------------

  function getParentOptions(): { id: string; label: string; area: NavArea }[] {
    if (!data) return [];
    const opts: { id: string; label: string; area: NavArea }[] = [];
    for (const area of NAV_AREA_ORDER) {
      for (const item of data.areas[area] ?? []) {
        // Only top-level items (parentId = null) can be parents
        if (!item.parentId) {
          opts.push({ id: item.id, label: item.label, area });
        }
      }
    }
    return opts;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isEmpty = data && data.meta.total === 0;
  const parentOptions = getParentOptions();

  return (
    <div className="space-y-5">
      {/* Global error */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Fehler</p>
            <p className="mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="ml-auto shrink-0 text-red-400 hover:text-red-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && !data && (
        <div className="flex items-center justify-center py-12 text-[var(--muted)]">
          <RefreshCw className="h-5 w-5 animate-spin" />
        </div>
      )}

      {/* Empty state with bootstrap */}
      {!isLoading && isEmpty && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <EmptyState
            icon={<Menu className="h-10 w-10" />}
            heading="Keine Navigationselemente"
            description="Erstelle die erste Navigation oder lade die Standardkonfiguration."
            action={
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={handleBootstrap}
                  disabled={isLoading}
                  className="fca-button-primary"
                >
                  <Sparkles className="h-4 w-4" />
                  Standard-Navigation laden
                </button>
                <button
                  onClick={() => openCreate(NAV_AREA.HEADER, null)}
                  className="fca-button-secondary"
                >
                  <Plus className="h-4 w-4" />
                  Manuell erstellen
                </button>
              </div>
            }
          />
        </div>
      )}

      {/* Inline form (create / edit) */}
      {formMode !== null && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
            {formMode === "create" ? "Neues Navigationselement" : `Bearbeiten: ${editingItem?.label}`}
          </h3>
          <NavItemForm
            initial={formDefaults}
            defaultArea={formDefaults.area as NavArea}
            parentOptions={parentOptions}
            onSave={handleSave}
            onCancel={closeForm}
            isSaving={isSaving}
            error={formError}
            mode={formMode}
          />
        </div>
      )}

      {/* Delete confirmation */}
      {deletingItem && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-semibold text-red-800">
            &bdquo;{deletingItem.label}&ldquo; wirklich löschen?
          </p>
          {(deletingItem.children?.length ?? 0) > 0 && (
            <p className="mt-1 text-xs text-red-700">
              Dieses Element hat {deletingItem.children!.length} Unterelement
              {deletingItem.children!.length !== 1 ? "e" : ""}. Das Löschen ist
              erst möglich, nachdem die Unterelemente entfernt wurden.
            </p>
          )}
          {deleteError && (
            <p className="mt-2 rounded border border-red-200 bg-white px-3 py-2 text-xs text-red-700">
              {deleteError}
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={confirmDelete}
              disabled={isDeleting}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isDeleting ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
              Löschen bestätigen
            </button>
            <button
              onClick={cancelDelete}
              disabled={isDeleting}
              className="fca-button-secondary text-xs"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Area sections */}
      {data && !isEmpty && (
        <>
          {/* Refresh + stats bar */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--muted)]">
              {data.meta.total} Element{data.meta.total !== 1 ? "e" : ""} insgesamt
            </p>
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Aktualisieren
            </button>
          </div>

          {NAV_AREA_ORDER.map((area) => (
            <AreaSection
              key={area}
              area={area}
              items={data.areas[area] ?? []}
              onAdd={openCreate}
              onToggle={handleToggle}
              onMoveUp={(id) => handleMove(id, "up")}
              onMoveDown={(id) => handleMove(id, "down")}
              onEdit={openEdit}
              onDelete={startDelete}
              isLoading={isLoading}
            />
          ))}
        </>
      )}

      {/* Public API hint */}
      {data && (
        <div className="flex items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
          <Globe className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
          <p className="text-xs text-[var(--text-2)]">
            Sichtbare Navigationselemente sind abrufbar unter:{" "}
            <code className="rounded bg-[var(--surface-2)] px-1 py-0.5 font-mono text-[10px]">
              GET /api/public/[tenant]/website/navigation
            </code>
          </p>
        </div>
      )}
    </div>
  );
}
