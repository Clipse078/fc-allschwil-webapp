"use client";

/**
 * components/admin/page-builder/PageBuilderClient.tsx
 *
 * Client component for the Website Page Builder (CMS V2 Slice 8).
 *
 * Features:
 *   - List page sections for the selected page
 *   - Show section type, label, status (enabled/disabled), sortOrder
 *   - Create a new section from existing block types
 *   - Edit section label and config (using the shared config editor pattern)
 *   - Enable/disable section toggle
 *   - Move up/down
 *   - Delete section (with confirmation)
 *
 * Foundation-safe scope:
 *   - No visual drag-and-drop
 *   - No live visual preview
 *   - No section-level publish/approval workflow
 *   - Config editor: key/value JSON form (same minimal approach as homepage builder)
 */

import { useState, useEffect, useCallback, Fragment } from "react";
import {
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Plus,
  RefreshCw,
  X,
  Check,
  Blocks,
} from "lucide-react";
import { SectionCard, EmptyState } from "@/components/ui/page";
import type { PageSectionAdminItem } from "@/lib/page-sections/admin-queries";
import {
  BLOCK_REGISTRY,
  getBlockDefinition,
  type BlockDefinition,
} from "@/lib/homepage/block-registry";
import { HOMEPAGE_SECTION_TYPE_KEYS } from "@/lib/homepage/section-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SectionTypeBadge({ type }: { type: string }) {
  const def = getBlockDefinition(type);
  return (
    <span className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-2)]">
      {def?.displayName ?? type}
    </span>
  );
}

function EnabledBadge({ isEnabled }: { isEnabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        isEnabled
          ? "bg-emerald-50 text-emerald-700"
          : "bg-[var(--surface-2)] text-[var(--muted)]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isEnabled ? "bg-emerald-500" : "bg-gray-300"}`}
      />
      {isEnabled ? "Aktiv" : "Deaktiviert"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Config editor (minimal key-value form)
// ---------------------------------------------------------------------------

function ConfigEditor({
  section,
  onSave,
  onCancel,
}: {
  section: PageSectionAdminItem;
  onSave: (label: string, config: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const def = getBlockDefinition(section.type);
  const configKeys = def?.configKeys ?? [];

  const [label, setLabel] = useState(section.label);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const k of configKeys) {
      const v = section.config[k];
      init[k] = v !== undefined && v !== null ? String(v) : "";
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = label.trim();
    if (!trimmed) {
      setError("Label darf nicht leer sein.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const config: Record<string, unknown> = {};
      for (const k of configKeys) {
        const raw = values[k];
        if (raw === "" || raw === undefined) continue;
        // Attempt numeric coercion for numeric-looking values
        const num = Number(raw);
        config[k] = !isNaN(num) && raw.trim() !== "" ? num : raw;
      }
      await onSave(trimmed, config);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div className="space-y-3">
        {/* Label */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">
            Label
          </label>
          <input
            className="fca-input w-full"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Sektionsbezeichnung"
          />
        </div>

        {/* Config keys */}
        {configKeys.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Konfiguration
            </p>
            {configKeys.map((k) => (
              <div key={k} className="flex items-center gap-2">
                <label className="w-36 flex-shrink-0 text-xs text-[var(--text-2)]">{k}</label>
                <input
                  className="fca-input flex-1"
                  value={values[k] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [k]: e.target.value }))}
                  placeholder={`${k}…`}
                />
              </div>
            ))}
          </div>
        )}

        {configKeys.length === 0 && (
          <p className="text-xs text-[var(--muted)] italic">
            Dieser Blocktyp hat keine konfigurierbaren Felder.
          </p>
        )}

        {error && <p className="text-xs text-rose-600">{error}</p>}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="fca-button-primary py-1.5 text-xs"
          >
            <Check className="h-3.5 w-3.5" />
            {saving ? "Speichern…" : "Speichern"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="fca-button-secondary py-1.5 text-xs"
          >
            <X className="h-3.5 w-3.5" />
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add section panel
// ---------------------------------------------------------------------------

const AVAILABLE_BLOCKS: BlockDefinition[] = BLOCK_REGISTRY.filter(
  (b) => HOMEPAGE_SECTION_TYPE_KEYS.includes(b.type as (typeof HOMEPAGE_SECTION_TYPE_KEYS)[number]) &&
    b.status !== "coming-next",
);

function AddSectionPanel({
  pageId,
  onCreated,
  onCancel,
}: {
  pageId: string;
  onCreated: (section: PageSectionAdminItem) => void;
  onCancel: () => void;
}) {
  const [selectedType, setSelectedType] = useState<string>(
    AVAILABLE_BLOCKS[0]?.type ?? "",
  );
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const def = getBlockDefinition(selectedType);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/website-pages/${pageId}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          label: label.trim() || def?.displayName || selectedType,
          config: def?.defaultConfig ?? {},
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Fehler beim Erstellen");
      onCreated(data.section);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <p className="text-sm font-semibold text-[var(--foreground)] mb-3">
        Neue Sektion hinzufügen
      </p>
      <div className="space-y-3">
        {/* Block type selector */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">
            Blocktyp
          </label>
          <select
            className="fca-input w-full"
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setLabel("");
            }}
          >
            {AVAILABLE_BLOCKS.map((b) => (
              <option key={b.type} value={b.type}>
                {b.displayName} — {b.category}
                {b.status === "foundation-ready" ? " (foundation-ready)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        {def && (
          <p className="text-xs text-[var(--muted)]">{def.description}</p>
        )}

        {/* Label override */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">
            Label (optional, Standard = Blockname)
          </label>
          <input
            className="fca-input w-full"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={def?.displayName ?? selectedType}
          />
        </div>

        {error && <p className="text-xs text-rose-600">{error}</p>}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving || !selectedType}
            className="fca-button-primary py-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            {saving ? "Erstelle…" : "Sektion erstellen"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="fca-button-secondary py-1.5 text-xs"
          >
            <X className="h-3.5 w-3.5" />
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type PageBuilderClientProps = {
  pageId: string;
};

export default function PageBuilderClient({
  pageId,
}: PageBuilderClientProps) {
  const [sections, setSections] = useState<PageSectionAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/website-pages/${pageId}/sections`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Ladefehler");
      setSections(data.sections ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggle(id: string) {
    setActionPending(id);
    try {
      const res = await fetch(
        `/api/website-pages/${pageId}/sections/${id}/toggle`,
        { method: "PATCH" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data?.error ?? "Fehler"); return; }
      setSections((prev) =>
        prev.map((s) => (s.id === id ? data.section : s)),
      );
    } finally {
      setActionPending(null);
    }
  }

  async function handleMove(id: string, direction: "up" | "down") {
    setActionPending(id);
    try {
      const res = await fetch(
        `/api/website-pages/${pageId}/sections/${id}/move`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ direction }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data?.error ?? "Fehler"); return; }
      setSections(data.sections ?? []);
    } finally {
      setActionPending(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Sektion wirklich löschen?")) return;
    setActionPending(id);
    try {
      const res = await fetch(
        `/api/website-pages/${pageId}/sections/${id}`,
        { method: "DELETE" },
      );
      if (res.ok || res.status === 204) {
        setSections((prev) => prev.filter((s) => s.id !== id));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data?.error ?? "Löschen fehlgeschlagen");
      }
    } finally {
      setActionPending(null);
    }
  }

  async function handleSaveConfig(
    id: string,
    label: string,
    config: Record<string, unknown>,
  ) {
    const res = await fetch(`/api/website-pages/${pageId}/sections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, config }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Speichern fehlgeschlagen");
    setSections((prev) => prev.map((s) => (s.id === id ? data.section : s)));
    setEditingId(null);
  }

  function handleCreated(section: PageSectionAdminItem) {
    setSections((prev) => [...prev, section]);
    setShowAdd(false);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">
          {loading
            ? "Lädt…"
            : `${sections.length} Sektion${sections.length !== 1 ? "en" : ""}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="fca-button-secondary px-2.5"
            title="Aktualisieren"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          {!showAdd && (
            <button
              type="button"
              onClick={() => { setShowAdd(true); setEditingId(null); }}
              className="fca-button-primary"
            >
              <Plus className="h-4 w-4" />
              Sektion hinzufügen
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Add section panel */}
      {showAdd && (
        <AddSectionPanel
          pageId={pageId}
          onCreated={handleCreated}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* Section list */}
      <SectionCard noPadding>
        {loading && sections.length === 0 ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-lg bg-[var(--surface-2)]"
              />
            ))}
          </div>
        ) : sections.length === 0 ? (
          <EmptyState
            icon={<Blocks className="h-10 w-10" />}
            heading="Keine Sektionen vorhanden"
            description="Füge die erste Sektion hinzu, um diese Seite mit Blöcken zu befüllen."
            action={
              !showAdd ? (
                <button
                  type="button"
                  onClick={() => setShowAdd(true)}
                  className="fca-button-primary"
                >
                  <Plus className="h-4 w-4" />
                  Erste Sektion hinzufügen
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {sections.map((section, idx) => (
              <Fragment key={section.id}>
                <div className="px-5 py-4">
                  {/* Row: info + actions */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-[var(--muted)] w-5 text-right shrink-0">
                          {idx + 1}.
                        </span>
                        <span className="font-medium text-sm text-[var(--foreground)] truncate">
                          {section.label}
                        </span>
                        <EnabledBadge isEnabled={section.isEnabled} />
                      </div>
                      <div className="ml-7 flex flex-wrap items-center gap-2">
                        <SectionTypeBadge type={section.type} />
                        <span className="text-[11px] text-[var(--muted)]">
                          sortOrder: {section.sortOrder}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {/* Move up */}
                      <button
                        type="button"
                        onClick={() => handleMove(section.id, "up")}
                        disabled={actionPending === section.id || idx === 0}
                        className="sce-icon-button disabled:opacity-30"
                        title="Nach oben"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      {/* Move down */}
                      <button
                        type="button"
                        onClick={() => handleMove(section.id, "down")}
                        disabled={
                          actionPending === section.id ||
                          idx === sections.length - 1
                        }
                        className="sce-icon-button disabled:opacity-30"
                        title="Nach unten"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      {/* Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggle(section.id)}
                        disabled={actionPending === section.id}
                        className="sce-icon-button"
                        title={section.isEnabled ? "Deaktivieren" : "Aktivieren"}
                      >
                        {section.isEnabled ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </button>
                      {/* Edit config */}
                      <button
                        type="button"
                        onClick={() =>
                          setEditingId(
                            editingId === section.id ? null : section.id,
                          )
                        }
                        className={`sce-icon-button ${editingId === section.id ? "text-blue-600" : ""}`}
                        title="Konfigurieren"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDelete(section.id)}
                        disabled={actionPending === section.id}
                        className="sce-icon-button text-rose-500 hover:text-rose-700"
                        title="Löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Config editor (inline expand) */}
                  {editingId === section.id && (
                    <ConfigEditor
                      section={section}
                      onSave={(label, config) =>
                        handleSaveConfig(section.id, label, config)
                      }
                      onCancel={() => setEditingId(null)}
                    />
                  )}
                </div>
              </Fragment>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Help note */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
        <p className="text-xs text-[var(--muted)]">
          <strong className="text-[var(--text-2)]">Publishing:</strong>{" "}
          Sektionen sind öffentlich sichtbar, wenn die Seite{" "}
          <strong>veröffentlicht</strong> ist und die Sektion{" "}
          <strong>aktiv</strong> ist.
          Das vollständige Sektion-Publish-Workflow wird in einem zukünftigen Slice ergänzt.
        </p>
      </div>
    </div>
  );
}
