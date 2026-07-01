"use client";

import { Fragment, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  GripVertical,
  LayoutTemplate,
  Newspaper,
  Calendar,
  Users,
  CalendarDays,
  MousePointerClick,
  Award,
  LayoutPanelLeft,
  Blocks,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Globe,
  GlobeLock,
  Clock,
  Pencil,
  X,
  Check,
  CheckCircle2,
  XCircle,
  UserCheck,
  AlertCircle,
} from "lucide-react";
import type { HomepageSectionAdminItem } from "@/lib/homepage/admin-queries";
import { getBlockDefinition } from "@/lib/homepage/block-registry";
import {
  APPROVAL_STATUS,
  APPROVAL_STATUS_LABELS,
  APPROVAL_PUBLISH_ALLOWED,
  type ApprovalStatus,
} from "@/lib/homepage/approval-constants";
import { Badge } from "@/components/ui/Badge";
import { StatusIndicator } from "@/components/ui/StatusIndicator";

// ---------------------------------------------------------------------------
// Dynamic imports
// ---------------------------------------------------------------------------

const SplitContentCardsConfigForm = dynamic(
  () =>
    import(
      "@/components/admin/page-builder/block-forms/SplitContentCardsConfigForm"
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-20 animate-pulse rounded-lg bg-[var(--surface-2)]" />
    ),
  },
);

// ---------------------------------------------------------------------------
// Block icon map
// ---------------------------------------------------------------------------

const BLOCK_ICON_MAP: Record<string, React.ElementType> = {
  LayoutTemplate,
  Newspaper,
  Calendar,
  Users,
  CalendarDays,
  MousePointerClick,
  Award,
  LayoutPanelLeft,
  Blocks,
};

// Category → accent color map for the block icon background
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Header: { bg: "rgba(139,92,246,0.10)", text: "#8B5CF6" },
  Content: { bg: "rgba(59,130,246,0.10)", text: "#3B82F6" },
  "Data-driven": { bg: "rgba(16,185,129,0.10)", text: "#10B981" },
  Club: { bg: "rgba(245,158,11,0.10)", text: "#F59E0B" },
  Sponsors: { bg: "rgba(236,72,153,0.10)", text: "#EC4899" },
  Conversion: { bg: "rgba(239,68,68,0.10)", text: "#EF4444" },
  Utility: { bg: "rgba(107,114,128,0.10)", text: "#6B7280" },
};

// ---------------------------------------------------------------------------
// Config draft helpers
// ---------------------------------------------------------------------------

type ConfigDraft = Record<string, unknown>;

function initConfigDraft(config: HomepageSectionAdminItem["config"]): ConfigDraft {
  if (!config || typeof config !== "object" || Array.isArray(config)) return {};
  const raw = config as Record<string, unknown>;
  const draft: ConfigDraft = {};
  for (const [k, v] of Object.entries(raw)) {
    draft[k] = v === null || v === undefined ? "" : v;
  }
  return draft;
}

function serialiseConfigDraft(
  type: string,
  draft: ConfigDraft,
): Record<string, unknown> {
  if (type === "splitContentCards") {
    return draft as Record<string, unknown>;
  }
  const numberFields: Record<string, true> = {};
  if (type === "newsTeaser" || type === "eventsTeaser" || type === "teamsTeaser") {
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
// Config field sub-components
// ---------------------------------------------------------------------------

function StringField({
  fieldKey,
  label,
  placeholder,
  value,
  onChange,
  disabled,
}: {
  fieldKey: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
}) {
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

function NumberField({
  fieldKey,
  label,
  min,
  max,
  value,
  onChange,
  disabled,
}: {
  fieldKey: string;
  label: string;
  min: number;
  max: number;
  value: string;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
}) {
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

function TextareaField({
  fieldKey,
  label,
  placeholder,
  value,
  onChange,
  disabled,
}: {
  fieldKey: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
}) {
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

function SelectField({
  fieldKey,
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  fieldKey: string;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
}) {
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

function ConfigFields({
  type,
  config,
  onChange,
  onChangeFull,
  disabled,
}: {
  type: string;
  config: ConfigDraft;
  onChange: (key: string, value: string) => void;
  onChangeFull?: (config: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  const str = (key: string) =>
    typeof config[key] === "string" ? (config[key] as string) : "";
  const num = (key: string) =>
    config[key] !== undefined && config[key] !== "" ? String(config[key]) : "";

  if (type === "hero") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <StringField fieldKey="title" label="Titel" placeholder="Hauptüberschrift" value={str("title")} onChange={onChange} disabled={disabled} />
        <StringField fieldKey="subtitle" label="Untertitel" placeholder="Ergänzender Text" value={str("subtitle")} onChange={onChange} disabled={disabled} />
        <StringField fieldKey="ctaLabel" label="CTA-Schaltflächentext" placeholder="z. B. Mehr erfahren" value={str("ctaLabel")} onChange={onChange} disabled={disabled} />
        <StringField fieldKey="ctaUrl" label="CTA-URL" placeholder="https://…" value={str("ctaUrl")} onChange={onChange} disabled={disabled} />
      </div>
    );
  }
  if (type === "newsTeaser") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField fieldKey="itemCount" label="Anzahl Artikel" min={1} max={10} value={num("itemCount")} onChange={onChange} disabled={disabled} />
        <StringField fieldKey="heading" label="Überschrift" placeholder="Standardüberschrift überschreiben" value={str("heading")} onChange={onChange} disabled={disabled} />
      </div>
    );
  }
  if (type === "eventsTeaser") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField fieldKey="itemCount" label="Anzahl Veranstaltungen" min={1} max={20} value={num("itemCount")} onChange={onChange} disabled={disabled} />
        <SelectField fieldKey="surface" label="Ansicht" options={[{ value: "homepage", label: "Homepage (gefiltert)" }, { value: "all", label: "Alle Veranstaltungen" }]} value={str("surface") || "homepage"} onChange={onChange} disabled={disabled} />
        <StringField fieldKey="heading" label="Überschrift" placeholder="Standardüberschrift überschreiben" value={str("heading")} onChange={onChange} disabled={disabled} />
      </div>
    );
  }
  if (type === "teamsTeaser") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField fieldKey="itemCount" label="Anzahl Mannschaften" min={1} max={20} value={num("itemCount")} onChange={onChange} disabled={disabled} />
        <StringField fieldKey="seasonKey" label="Saison-Schlüssel" placeholder="Aktive Saison (Standard)" value={str("seasonKey")} onChange={onChange} disabled={disabled} />
        <StringField fieldKey="heading" label="Überschrift" placeholder="Standardüberschrift überschreiben" value={str("heading")} onChange={onChange} disabled={disabled} />
      </div>
    );
  }
  if (type === "sponsorsTeaser" || type === "weekplanTeaser") {
    return (
      <div className="grid gap-3">
        <StringField fieldKey="heading" label="Überschrift" placeholder="Standardüberschrift überschreiben" value={str("heading")} onChange={onChange} disabled={disabled} />
      </div>
    );
  }
  if (type === "callToAction") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <StringField fieldKey="title" label="Überschrift" placeholder="CTA-Titel" value={str("title")} onChange={onChange} disabled={disabled} />
        <div className="sm:col-span-2">
          <TextareaField fieldKey="body" label="Text" placeholder="Begleittext zum CTA" value={str("body")} onChange={onChange} disabled={disabled} />
        </div>
        <StringField fieldKey="primaryLabel" label="Primär-Schaltflächentext" placeholder="z. B. Jetzt beitreten" value={str("primaryLabel")} onChange={onChange} disabled={disabled} />
        <StringField fieldKey="primaryUrl" label="Primär-URL" placeholder="https://…" value={str("primaryUrl")} onChange={onChange} disabled={disabled} />
        <StringField fieldKey="secondaryLabel" label="Sekundär-Schaltflächentext" placeholder="z. B. Mehr erfahren" value={str("secondaryLabel")} onChange={onChange} disabled={disabled} />
        <StringField fieldKey="secondaryUrl" label="Sekundär-URL" placeholder="https://…" value={str("secondaryUrl")} onChange={onChange} disabled={disabled} />
      </div>
    );
  }
  if (type === "splitContentCards") {
    return (
      <SplitContentCardsConfigForm
        config={config as Record<string, unknown>}
        onChange={(updated) => onChangeFull?.(updated)}
      />
    );
  }
  return (
    <p className="text-xs text-[var(--muted)]">
      Keine konfigurierbaren Felder für diesen Sektionstyp.
    </p>
  );
}

// ---------------------------------------------------------------------------
// Callbacks type
// ---------------------------------------------------------------------------

export type SectionCardCallbacks = {
  onSelect: () => void;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onStartSchedule: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (label: string, config: Record<string, unknown>) => Promise<void>;
  onRequestReview: () => void;
  onOpenApprove: () => void;
  onOpenReject: () => void;
};

// ---------------------------------------------------------------------------
// Main card component
// ---------------------------------------------------------------------------

type Props = {
  section: HomepageSectionAdminItem;
  isFirst: boolean;
  isLast: boolean;
  isSelected: boolean;
  isEditing: boolean;
  isPending: boolean;
  isAnyPending: boolean;
} & SectionCardCallbacks;

export function HomepageSectionCard({
  section,
  isFirst,
  isLast,
  isSelected,
  isEditing,
  isPending,
  isAnyPending,
  onSelect,
  onToggle,
  onMoveUp,
  onMoveDown,
  onPublish,
  onUnpublish,
  onStartSchedule,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onRequestReview,
  onOpenApprove,
  onOpenReject,
}: Props) {
  // Local edit state
  const [localLabel, setLocalLabel] = useState(section.label);
  const [localConfig, setLocalConfig] = useState<ConfigDraft>(() =>
    initConfigDraft(section.config),
  );
  const [localPending, setLocalPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Sync local state whenever editing starts or section refreshes
  useEffect(() => {
    if (isEditing) {
      setLocalLabel(section.label);
      setLocalConfig(initConfigDraft(section.config));
      setLocalError(null);
    }
  }, [isEditing, section]);

  async function handleSave() {
    setLocalPending(true);
    setLocalError(null);
    try {
      const config = serialiseConfigDraft(section.type, localConfig);
      await onSaveEdit(localLabel.trim(), config);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setLocalPending(false);
    }
  }

  const def = getBlockDefinition(section.type);
  const BlockIcon = BLOCK_ICON_MAP[def?.icon ?? "LayoutTemplate"] ?? LayoutTemplate;
  const categoryColor = CATEGORY_COLORS[def?.category ?? ""] ?? CATEGORY_COLORS["Utility"];

  const approvalStatus = section.approvalStatus as ApprovalStatus;
  const canPublish = APPROVAL_PUBLISH_ALLOWED.has(approvalStatus);
  const isPublished = section.publishStatus === "PUBLISHED";
  const isInReview = approvalStatus === APPROVAL_STATUS.IN_REVIEW;

  const scheduledDate =
    section.scheduledPublishAt !== null ? new Date(section.scheduledPublishAt) : null;
  const isScheduled =
    !isPublished && scheduledDate !== null && scheduledDate > new Date();

  const isBusy = isPending || isAnyPending || isEditing || localPending;

  function stopProp(e: React.MouseEvent) {
    e.stopPropagation();
  }

  const hasConfigKeys = (getBlockDefinition(section.type)?.configKeys.length ?? 0) > 0;

  return (
    <Fragment>
      {/* ── Card ─────────────────────────────────────────────────────── */}
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => e.key === "Enter" && onSelect()}
        className={[
          "group relative rounded-xl border bg-[var(--surface)] cursor-pointer",
          "transition-all duration-150 focus:outline-none",
          isSelected && !isEditing
            ? "border-[var(--sce-primary)] shadow-sm ring-1 ring-[var(--sce-primary)]/20"
            : "border-[var(--border)] hover:border-[var(--border-strong)] hover:shadow-sm",
          isEditing ? "border-blue-300 shadow-sm ring-1 ring-blue-200/50" : "",
          !section.isEnabled && !isEditing ? "opacity-70" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* Main content row */}
        <div className="flex items-start gap-3 p-4">
          {/* Drag handle placeholder */}
          <div
            className="mt-0.5 cursor-grab opacity-20 group-hover:opacity-40 transition-opacity shrink-0"
            title="Sortierung (drag-and-drop folgt)"
            onClick={stopProp}
          >
            <GripVertical className="h-4 w-4 text-[var(--muted)]" />
          </div>

          {/* Block icon */}
          <div
            className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: categoryColor.bg, color: categoryColor.text }}
          >
            <BlockIcon className="h-4 w-4" />
          </div>

          {/* Info area */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-0.5">
              <p className="text-sm font-semibold text-[var(--foreground)] leading-snug">
                {section.label}
              </p>
              {def && (
                <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--muted)] bg-[var(--surface-2)] border border-[var(--border)] rounded px-1.5 py-0.5">
                  {def.category}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--muted)] line-clamp-1 leading-relaxed">
              {def?.description ?? section.type}
            </p>
            {isScheduled && scheduledDate && (
              <p className="mt-0.5 text-[11px] text-amber-600 font-medium">
                Geplant: {scheduledDate.toLocaleString("de-CH")}
              </p>
            )}
          </div>

          {/* Status cluster */}
          <div
            className="flex flex-wrap items-center justify-end gap-1 shrink-0 pt-0.5"
            onClick={stopProp}
          >
            {section.isEnabled ? (
              <StatusIndicator variant="success" label="Aktiv" size="sm" />
            ) : (
              <StatusIndicator variant="neutral" label="Aus" size="sm" />
            )}

            {isPublished ? (
              <Badge variant="info" size="sm">Pub</Badge>
            ) : isScheduled ? (
              <Badge variant="warning" size="sm">Geplant</Badge>
            ) : (
              <Badge variant="default" size="sm">Entwurf</Badge>
            )}

            {approvalStatus !== "NOT_REQUIRED" && (
              <Badge
                size="sm"
                variant={
                  approvalStatus === "APPROVED"
                    ? "success"
                    : approvalStatus === "IN_REVIEW"
                      ? "info"
                      : approvalStatus === "CHANGES_REQUESTED"
                        ? "danger"
                        : "warning"
                }
              >
                {APPROVAL_STATUS_LABELS[approvalStatus] ?? approvalStatus}
              </Badge>
            )}
          </div>
        </div>

        {/* Action strip */}
        <div
          className="flex flex-wrap items-center gap-0.5 border-t border-[var(--border)] px-4 py-2"
          onClick={stopProp}
        >
          {/* Sort */}
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst || isBusy}
            className="sce-icon-button disabled:opacity-30"
            title="Nach oben"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast || isBusy}
            className="sce-icon-button disabled:opacity-30"
            title="Nach unten"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>

          <span className="h-4 w-px bg-[var(--border)] mx-1" />

          {/* Visibility toggle */}
          <button
            type="button"
            onClick={onToggle}
            disabled={isBusy}
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

          {/* Publish / Unpublish */}
          {isPublished ? (
            <button
              type="button"
              onClick={onUnpublish}
              disabled={isBusy}
              className="sce-icon-button text-blue-600 hover:text-blue-800"
              title="Aus Publikation zurückziehen"
            >
              <GlobeLock className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onPublish}
              disabled={isBusy || !canPublish}
              className={`sce-icon-button ${
                canPublish
                  ? "text-[var(--muted)] hover:text-blue-600"
                  : "text-rose-300 cursor-not-allowed"
              }`}
              title={
                !canPublish
                  ? `Veröffentlichung blockiert: ${APPROVAL_STATUS_LABELS[approvalStatus]}`
                  : "Veröffentlichen"
              }
            >
              <Globe className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Schedule publish */}
          {!isPublished && (
            <button
              type="button"
              onClick={onStartSchedule}
              disabled={isBusy || !canPublish}
              className={`sce-icon-button ${
                canPublish
                  ? "text-[var(--muted)] hover:text-amber-600"
                  : "text-rose-300 cursor-not-allowed"
              }`}
              title={
                !canPublish
                  ? `Planung blockiert: ${APPROVAL_STATUS_LABELS[approvalStatus]}`
                  : "Veröffentlichung planen"
              }
            >
              <Clock className="h-3.5 w-3.5" />
            </button>
          )}

          <span className="h-4 w-px bg-[var(--border)] mx-1" />

          {/* Review: request */}
          {approvalStatus !== APPROVAL_STATUS.IN_REVIEW && (
            <button
              type="button"
              onClick={onRequestReview}
              disabled={isBusy}
              className="sce-icon-button text-[var(--muted)] hover:text-blue-600"
              title="Überprüfung anfordern"
            >
              <UserCheck className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Review: approve / reject */}
          {isInReview && (
            <>
              <button
                type="button"
                onClick={onOpenApprove}
                disabled={isBusy}
                className="sce-icon-button text-emerald-600 hover:text-emerald-800"
                title="Freigeben"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onOpenReject}
                disabled={isBusy}
                className="sce-icon-button text-red-500 hover:text-red-700"
                title="Ablehnen / Änderungen anfordern"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
            </>
          )}

          {/* Edit / cancel */}
          <button
            type="button"
            onClick={() => (isEditing ? onCancelEdit() : onStartEdit())}
            disabled={isAnyPending && !isEditing}
            className={`sce-icon-button ${
              isEditing
                ? "text-blue-600 hover:text-blue-800"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
            title={isEditing ? "Bearbeitung abbrechen" : "Bearbeiten"}
          >
            {isEditing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Inline edit form ──────────────────────────────────────────── */}
      {isEditing && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-5 py-4 space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-600">
            Sektion bearbeiten
          </p>

          {/* Label field */}
          <div className="max-w-sm">
            <label className="fca-label mb-1 block">Bezeichnung</label>
            <input
              type="text"
              className="fca-input"
              value={localLabel}
              onChange={(e) => setLocalLabel(e.target.value)}
              placeholder="Sektionsbezeichnung"
              maxLength={200}
              disabled={localPending}
            />
          </div>

          {/* Per-type config */}
          {hasConfigKeys && (
            <div>
              <p className="fca-label mb-2 block">Konfiguration</p>
              <ConfigFields
                type={section.type}
                config={localConfig}
                onChange={(key, value) =>
                  setLocalConfig((prev) => ({ ...prev, [key]: value }))
                }
                onChangeFull={(full) => setLocalConfig(full)}
                disabled={localPending}
              />
            </div>
          )}

          {/* Error */}
          {localError && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {localError}
            </div>
          )}

          {/* Save / cancel */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={localPending || localLabel.trim().length === 0}
              className="fca-button-primary"
            >
              <Check className="h-3.5 w-3.5" />
              {localPending ? "Wird gespeichert…" : "Speichern"}
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={localPending}
              className="fca-button-secondary"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </Fragment>
  );
}
