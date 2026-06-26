"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LayoutTemplate,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Pencil,
  X,
  Check,
} from "lucide-react";
import { SectionCard, EmptyState } from "@/components/ui/page";
import type { HomepageSectionAdminItem } from "@/lib/homepage/admin-queries";
import { getHomepageSectionType } from "@/lib/homepage/section-types";
import { getBlockDefinition } from "@/lib/homepage/block-registry";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SectionTypeBadge({ type }: { type: string }) {
  const def = getHomepageSectionType(type);
  const isPlaceholder = def?.implementation === "placeholder";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${
        isPlaceholder
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)]"
      }`}
    >
      {def?.label ?? type}
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
// Config editor field components
// ---------------------------------------------------------------------------

type ConfigDraft = Record<string, unknown>;

type StringFieldProps = {
  fieldKey: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
};

function StringField({
  fieldKey,
  label,
  placeholder,
  value,
  onChange,
  disabled,
}: StringFieldProps) {
  return (
    <div>
      <label className="fca-label mb-1 block">{label}</label>
      <input
        type="text"
        className="fca-input"
        placeholder={placeholder ?? ""}
        value={value}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

type NumberFieldProps = {
  fieldKey: string;
  label: string;
  min: number;
  max: number;
  value: string;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
};

function NumberField({
  fieldKey,
  label,
  min,
  max,
  value,
  onChange,
  disabled,
}: NumberFieldProps) {
  return (
    <div>
      <label className="fca-label mb-1 block">
        {label}{" "}
        <span className="font-normal text-[var(--muted)]">
          ({min}–{max})
        </span>
      </label>
      <input
        type="number"
        className="fca-input"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

type TextareaFieldProps = {
  fieldKey: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
};

function TextareaField({
  fieldKey,
  label,
  placeholder,
  value,
  onChange,
  disabled,
}: TextareaFieldProps) {
  return (
    <div>
      <label className="fca-label mb-1 block">{label}</label>
      <textarea
        className="fca-textarea min-h-[80px] resize-y"
        placeholder={placeholder ?? ""}
        value={value}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        disabled={disabled}
        rows={3}
      />
    </div>
  );
}

type SelectFieldProps = {
  fieldKey: string;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
};

function SelectField({
  fieldKey,
  label,
  options,
  value,
  onChange,
  disabled,
}: SelectFieldProps) {
  return (
    <div>
      <label className="fca-label mb-1 block">{label}</label>
      <select
        className="fca-select"
        value={value}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        disabled={disabled}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-type config field renderers
// ---------------------------------------------------------------------------

type ConfigFieldsProps = {
  type: string;
  config: ConfigDraft;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
};

function ConfigFields({ type, config, onChange, disabled }: ConfigFieldsProps) {
  const str = (key: string) => (typeof config[key] === "string" ? (config[key] as string) : "");
  const num = (key: string) =>
    config[key] !== undefined && config[key] !== "" ? String(config[key]) : "";

  if (type === "hero") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <StringField
          fieldKey="title"
          label="Titel"
          placeholder="Hauptüberschrift"
          value={str("title")}
          onChange={onChange}
          disabled={disabled}
        />
        <StringField
          fieldKey="subtitle"
          label="Untertitel"
          placeholder="Ergänzender Text"
          value={str("subtitle")}
          onChange={onChange}
          disabled={disabled}
        />
        <StringField
          fieldKey="ctaLabel"
          label="CTA-Schaltflächentext"
          placeholder="z. B. Mehr erfahren"
          value={str("ctaLabel")}
          onChange={onChange}
          disabled={disabled}
        />
        <StringField
          fieldKey="ctaUrl"
          label="CTA-URL"
          placeholder="https://…"
          value={str("ctaUrl")}
          onChange={onChange}
          disabled={disabled}
        />
      </div>
    );
  }

  if (type === "newsTeaser") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField
          fieldKey="itemCount"
          label="Anzahl Artikel"
          min={1}
          max={10}
          value={num("itemCount")}
          onChange={onChange}
          disabled={disabled}
        />
        <StringField
          fieldKey="heading"
          label="Überschrift"
          placeholder="Standardüberschrift überschreiben"
          value={str("heading")}
          onChange={onChange}
          disabled={disabled}
        />
      </div>
    );
  }

  if (type === "eventsTeaser") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField
          fieldKey="itemCount"
          label="Anzahl Veranstaltungen"
          min={1}
          max={20}
          value={num("itemCount")}
          onChange={onChange}
          disabled={disabled}
        />
        <SelectField
          fieldKey="surface"
          label="Ansicht"
          options={[
            { value: "homepage", label: "Homepage (gefiltert)" },
            { value: "all", label: "Alle Veranstaltungen" },
          ]}
          value={str("surface") || "homepage"}
          onChange={onChange}
          disabled={disabled}
        />
        <StringField
          fieldKey="heading"
          label="Überschrift"
          placeholder="Standardüberschrift überschreiben"
          value={str("heading")}
          onChange={onChange}
          disabled={disabled}
        />
      </div>
    );
  }

  if (type === "teamsTeaser") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField
          fieldKey="itemCount"
          label="Anzahl Mannschaften"
          min={1}
          max={20}
          value={num("itemCount")}
          onChange={onChange}
          disabled={disabled}
        />
        <StringField
          fieldKey="seasonKey"
          label="Saison-Schlüssel"
          placeholder="Aktive Saison (Standard)"
          value={str("seasonKey")}
          onChange={onChange}
          disabled={disabled}
        />
        <StringField
          fieldKey="heading"
          label="Überschrift"
          placeholder="Standardüberschrift überschreiben"
          value={str("heading")}
          onChange={onChange}
          disabled={disabled}
        />
      </div>
    );
  }

  if (type === "sponsorsTeaser" || type === "weekplanTeaser") {
    return (
      <div className="grid gap-3">
        <StringField
          fieldKey="heading"
          label="Überschrift"
          placeholder="Standardüberschrift überschreiben"
          value={str("heading")}
          onChange={onChange}
          disabled={disabled}
        />
      </div>
    );
  }

  if (type === "callToAction") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <StringField
          fieldKey="title"
          label="Überschrift"
          placeholder="CTA-Titel"
          value={str("title")}
          onChange={onChange}
          disabled={disabled}
        />
        <div className="sm:col-span-2">
          <TextareaField
            fieldKey="body"
            label="Text"
            placeholder="Begleittext zum CTA"
            value={str("body")}
            onChange={onChange}
            disabled={disabled}
          />
        </div>
        <StringField
          fieldKey="primaryLabel"
          label="Primär-Schaltflächentext"
          placeholder="z. B. Jetzt beitreten"
          value={str("primaryLabel")}
          onChange={onChange}
          disabled={disabled}
        />
        <StringField
          fieldKey="primaryUrl"
          label="Primär-URL"
          placeholder="https://…"
          value={str("primaryUrl")}
          onChange={onChange}
          disabled={disabled}
        />
        <StringField
          fieldKey="secondaryLabel"
          label="Sekundär-Schaltflächentext"
          placeholder="z. B. Mehr erfahren"
          value={str("secondaryLabel")}
          onChange={onChange}
          disabled={disabled}
        />
        <StringField
          fieldKey="secondaryUrl"
          label="Sekundär-URL"
          placeholder="https://…"
          value={str("secondaryUrl")}
          onChange={onChange}
          disabled={disabled}
        />
      </div>
    );
  }

  // customContentPlaceholder or unknown type — no config fields
  return (
    <p className="text-xs text-[var(--muted)]">
      Keine konfigurierbaren Felder für diesen Sektionstyp.
    </p>
  );
}

// ---------------------------------------------------------------------------
// Edit draft helpers
// ---------------------------------------------------------------------------

/**
 * Initialise a mutable config draft from a section's stored config.
 * Converts all values to strings for controlled inputs.
 */
function initConfigDraft(config: HomepageSectionAdminItem["config"]): ConfigDraft {
  if (!config || typeof config !== "object" || Array.isArray(config)) return {};
  const raw = config as Record<string, unknown>;
  const draft: ConfigDraft = {};
  for (const [k, v] of Object.entries(raw)) {
    draft[k] = v === null || v === undefined ? "" : v;
  }
  return draft;
}

/**
 * Serialises a config draft back to a payload for the PATCH request.
 * - Empty strings for optional string fields are omitted.
 * - Number fields are parsed to integers; empty → omitted.
 * - Preserves enum string values (surface, etc.) as-is.
 */
function serialiseConfigDraft(
  type: string,
  draft: ConfigDraft,
): Record<string, unknown> {
  const numberFields: Record<string, true> = {};
  if (
    type === "newsTeaser" ||
    type === "eventsTeaser" ||
    type === "teamsTeaser"
  ) {
    numberFields["itemCount"] = true;
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(draft)) {
    const raw = typeof v === "string" ? v.trim() : v;
    if (raw === "" || raw === null || raw === undefined) continue;
    if (numberFields[k]) {
      const n = Number(raw);
      if (!Number.isNaN(n)) out[k] = n;
    } else {
      out[k] = raw;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function HomepageSectionList() {
  const [sections, setSections] = useState<HomepageSectionAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);

  // ── Inline edit state ───────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editConfig, setEditConfig] = useState<ConfigDraft>({});
  const [editPending, setEditPending] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/homepage-sections");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Ladefehler");
      setSections(data.sections ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggle(id: string) {
    setActionPending(id);
    try {
      const res = await fetch(`/api/homepage-sections/${id}/toggle`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error ?? "Fehler beim Umschalten");
        return;
      }
      setSections((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, isEnabled: data.section.isEnabled } : s,
        ),
      );
    } finally {
      setActionPending(null);
    }
  }

  async function handleMove(id: string, direction: "up" | "down") {
    setActionPending(`${id}-${direction}`);
    try {
      const res = await fetch(`/api/homepage-sections/${id}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error ?? "Fehler beim Verschieben");
        return;
      }
      setSections(data.sections ?? []);
    } finally {
      setActionPending(null);
    }
  }

  async function handleBootstrap() {
    if (
      !confirm(
        "Standard-Sektionen erstellen? Dies legt alle 8 Standard-Sektionen an. Vorgang kann nicht rückgängig gemacht werden.",
      )
    )
      return;

    setBootstrapping(true);
    try {
      const res = await fetch("/api/homepage-sections", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error ?? "Fehler beim Erstellen der Standard-Sektionen");
        return;
      }
      await load();
    } finally {
      setBootstrapping(false);
    }
  }

  // ── Edit handlers ─────────────────────────────────────────────────────────

  function handleStartEdit(section: HomepageSectionAdminItem) {
    setEditingId(section.id);
    setEditLabel(section.label);
    setEditConfig(initConfigDraft(section.config));
    setEditError(null);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditLabel("");
    setEditConfig({});
    setEditError(null);
  }

  function handleConfigFieldChange(key: string, value: string) {
    setEditConfig((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSaveEdit(section: HomepageSectionAdminItem) {
    setEditPending(true);
    setEditError(null);
    try {
      const payload = {
        label: editLabel.trim(),
        config: serialiseConfigDraft(section.type, editConfig),
      };

      const res = await fetch(`/api/homepage-sections/${section.id}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.details
          ? `${data.error}: ${(data.details as string[]).join(", ")}`
          : (data?.error ?? "Fehler beim Speichern");
        setEditError(msg);
        return;
      }

      setSections((prev) =>
        prev.map((s) => (s.id === section.id ? data.section : s)),
      );
      setEditingId(null);
      setEditLabel("");
      setEditConfig({});
    } finally {
      setEditPending(false);
    }
  }

  const isAnyActionPending = actionPending !== null || bootstrapping;

  return (
    <SectionCard noPadding>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
        <div className="flex items-center gap-2">
          <p className="text-xs text-[var(--muted)]">
            {loading
              ? "Wird geladen…"
              : `${sections.length} Sektion${sections.length !== 1 ? "en" : ""} konfiguriert`}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading || isAnyActionPending}
          className="fca-button-secondary px-2.5"
          title="Aktualisieren"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 border-b border-rose-100 bg-rose-50 px-5 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Content */}
      {loading && sections.length === 0 ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-[var(--radius-xl)] bg-[var(--surface-2)]"
            />
          ))}
        </div>
      ) : sections.length === 0 ? (
        <EmptyState
          icon={<LayoutTemplate className="h-10 w-10" />}
          heading="Keine Sektionen konfiguriert"
          description="Erstelle die Standard-Sektionen, um mit dem Homepage Builder zu starten."
          action={
            <button
              type="button"
              onClick={handleBootstrap}
              disabled={bootstrapping}
              className="fca-button-primary"
            >
              <Sparkles className="h-4 w-4" />
              {bootstrapping ? "Wird erstellt…" : "Standard-Sektionen erstellen"}
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-2)]">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Reihenfolge
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Sektion
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Typ
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Status
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {sections.map((section, idx) => {
                const def = getHomepageSectionType(section.type);
                const isFirst = idx === 0;
                const isLast = idx === sections.length - 1;
                const isThisPending =
                  actionPending === section.id ||
                  actionPending === `${section.id}-up` ||
                  actionPending === `${section.id}-down`;
                const isEditing = editingId === section.id;

                return (
                  <>
                    <tr
                      key={section.id}
                      className={`bg-[var(--surface)] transition hover:bg-[var(--surface-2)] ${
                        !section.isEnabled ? "opacity-60" : ""
                      } ${isEditing ? "bg-blue-50 hover:bg-blue-50" : ""}`}
                    >
                      {/* Sort position */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-[var(--muted)]">
                          {String(section.sortOrder).padStart(2, "0")}
                        </span>
                      </td>

                      {/* Label + description */}
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-[var(--foreground)]">
                            {section.label}
                          </p>
                          {def && (
                            <p className="mt-0.5 text-[11px] text-[var(--muted)] line-clamp-1">
                              {def.description}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Type badge */}
                      <td className="px-4 py-3">
                        <SectionTypeBadge type={section.type} />
                      </td>

                      {/* Enabled badge */}
                      <td className="px-4 py-3">
                        <EnabledBadge isEnabled={section.isEnabled} />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Move up */}
                          <button
                            type="button"
                            onClick={() => handleMove(section.id, "up")}
                            disabled={isFirst || isAnyActionPending || isEditing}
                            className="sce-icon-button disabled:opacity-30"
                            title="Nach oben"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>

                          {/* Move down */}
                          <button
                            type="button"
                            onClick={() => handleMove(section.id, "down")}
                            disabled={isLast || isAnyActionPending || isEditing}
                            className="sce-icon-button disabled:opacity-30"
                            title="Nach unten"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>

                          {/* Toggle enable/disable */}
                          <button
                            type="button"
                            onClick={() => handleToggle(section.id)}
                            disabled={isThisPending || isAnyActionPending || isEditing}
                            className={`sce-icon-button ${
                              section.isEnabled
                                ? "text-emerald-600 hover:text-emerald-800"
                                : "text-[var(--muted)] hover:text-[var(--foreground)]"
                            }`}
                            title={section.isEnabled ? "Deaktivieren" : "Aktivieren"}
                          >
                            {section.isEnabled ? (
                              <Eye className="h-3.5 w-3.5" />
                            ) : (
                              <EyeOff className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {/* Edit / cancel edit */}
                          <button
                            type="button"
                            onClick={() =>
                              isEditing ? handleCancelEdit() : handleStartEdit(section)
                            }
                            disabled={isAnyActionPending}
                            className={`sce-icon-button ${
                              isEditing
                                ? "text-blue-600 hover:text-blue-800"
                                : "text-[var(--muted)] hover:text-[var(--foreground)]"
                            }`}
                            title={isEditing ? "Bearbeitung abbrechen" : "Bearbeiten"}
                          >
                            {isEditing ? (
                              <X className="h-3.5 w-3.5" />
                            ) : (
                              <Pencil className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Inline edit panel */}
                    {isEditing && (
                      <tr key={`${section.id}-edit`}>
                        <td
                          colSpan={5}
                          className="border-b border-blue-100 bg-blue-50 px-5 py-4"
                        >
                          <div className="space-y-4">
                            {/* Panel header */}
                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-600">
                              Sektion bearbeiten
                            </p>

                            {/* Label field */}
                            <div className="max-w-sm">
                              <label className="fca-label mb-1 block">Bezeichnung</label>
                              <input
                                type="text"
                                className="fca-input"
                                value={editLabel}
                                onChange={(e) => setEditLabel(e.target.value)}
                                placeholder="Sektionsbezeichnung"
                                maxLength={200}
                                disabled={editPending}
                              />
                            </div>

                            {/* Per-type config fields */}
                            {(getBlockDefinition(section.type)?.configKeys.length ?? 0) > 0 && (
                              <div>
                                <p className="fca-label mb-2 block">Konfiguration</p>
                                <ConfigFields
                                  type={section.type}
                                  config={editConfig}
                                  onChange={handleConfigFieldChange}
                                  disabled={editPending}
                                />
                              </div>
                            )}

                            {/* Edit error */}
                            {editError && (
                              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                {editError}
                              </div>
                            )}

                            {/* Save / cancel */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(section)}
                                disabled={editPending || editLabel.trim().length === 0}
                                className="fca-button-primary"
                              >
                                <Check className="h-3.5 w-3.5" />
                                {editPending ? "Wird gespeichert…" : "Speichern"}
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                disabled={editPending}
                                className="fca-button-secondary"
                              >
                                Abbrechen
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer count */}
      {!loading && sections.length > 0 && (
        <div className="border-t border-[var(--border)] px-5 py-3">
          <p className="text-[11px] text-[var(--muted)]">
            {sections.filter((s) => s.isEnabled).length} von{" "}
            {sections.length} Sektionen aktiv · sichtbar in der öffentlichen
            Homepage-API
          </p>
        </div>
      )}
    </SectionCard>
  );
}
