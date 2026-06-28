"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
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
  Globe,
  GlobeLock,
  Clock,
  Info,
  CheckCircle2,
  XCircle,
  FileEdit,
  UserCheck,
  ClipboardCheck,
} from "lucide-react";
import Link from "next/link";
import { SectionCard, EmptyState } from "@/components/ui/page";
import type { HomepageSectionAdminItem } from "@/lib/homepage/admin-queries";
import {
  APPROVAL_STATUS,
  APPROVAL_STATUS_LABELS,
  APPROVAL_PUBLISH_ALLOWED,
  type ApprovalStatus,
} from "@/lib/homepage/approval-constants";
import { getHomepageSectionType } from "@/lib/homepage/section-types";
import { getBlockDefinition } from "@/lib/homepage/block-registry";
import { CMS_ROUTES } from "@/lib/cms/routes";

const SplitContentCardsConfigForm = dynamic(
  () => import("@/components/admin/page-builder/block-forms/SplitContentCardsConfigForm"),
  { ssr: false, loading: () => <div className="h-20 animate-pulse rounded-lg bg-[var(--surface-2)]" /> },
);

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
// Approval status badge (CMS V2 Slice 6)
// ---------------------------------------------------------------------------

const APPROVAL_BADGE_CONFIG: Record<
  ApprovalStatus,
  { icon: React.ElementType; colorClass: string; bgClass: string }
> = {
  NOT_REQUIRED: {
    icon: CheckCircle2,
    colorClass: "text-[var(--text-2)]",
    bgClass: "bg-[var(--surface-2)]",
  },
  DRAFT: {
    icon: FileEdit,
    colorClass: "text-amber-600",
    bgClass: "bg-amber-50",
  },
  IN_REVIEW: {
    icon: Clock,
    colorClass: "text-blue-600",
    bgClass: "bg-blue-50",
  },
  APPROVED: {
    icon: CheckCircle2,
    colorClass: "text-emerald-600",
    bgClass: "bg-emerald-50",
  },
  CHANGES_REQUESTED: {
    icon: XCircle,
    colorClass: "text-red-600",
    bgClass: "bg-red-50",
  },
};

function ApprovalStatusBadge({ approvalStatus }: { approvalStatus: string }) {
  const status = approvalStatus as ApprovalStatus;
  const cfg = APPROVAL_BADGE_CONFIG[status] ?? APPROVAL_BADGE_CONFIG.NOT_REQUIRED;
  const Icon = cfg.icon;
  const label = APPROVAL_STATUS_LABELS[status] ?? status;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.bgClass} ${cfg.colorClass}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function PublishStatusBadge({
  publishStatus,
  scheduledPublishAt,
}: {
  publishStatus: string;
  scheduledPublishAt: Date | string | null;
}) {
  const isPublished = publishStatus === "PUBLISHED";
  const scheduledDate =
    scheduledPublishAt != null ? new Date(scheduledPublishAt) : null;
  const isScheduled =
    !isPublished && scheduledDate !== null && scheduledDate > new Date();

  if (isPublished) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
        <Globe className="h-3 w-3" />
        Veröffentlicht
      </span>
    );
  }

  if (isScheduled) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
        title={`Geplant für: ${scheduledDate!.toLocaleString("de-CH")}`}
      >
        <Clock className="h-3 w-3" />
        Geplant
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
      <GlobeLock className="h-3 w-3" />
      Entwurf
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
  onChangeFull?: (config: Record<string, unknown>) => void;
  disabled?: boolean;
};

function ConfigFields({ type, config, onChange, onChangeFull, disabled }: ConfigFieldsProps) {
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

  if (type === "splitContentCards") {
    return (
      <SplitContentCardsConfigForm
        config={config as Record<string, unknown>}
        onChange={(updated) => onChangeFull?.(updated)}
      />
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
  // Premium blocks store full structured config — return as-is
  if (type === "splitContentCards") {
    return draft as Record<string, unknown>;
  }

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

  // ── Schedule modal state ─────────────────────────────────────────────────
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [schedulePending, setSchedulePending] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // ── Approval review modal state (CMS V2 Slice 6) ─────────────────────────
  const [reviewModal, setReviewModal] = useState<{
    id: string;
    label: string;
    action: "approve" | "reject";
  } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewPending, setReviewPending] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

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

  async function handlePublish(id: string) {
    setActionPending(`${id}-publish`);
    try {
      const res = await fetch(`/api/homepage-sections/${id}/publish`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error ?? "Fehler beim Veröffentlichen");
        return;
      }
      setSections((prev) =>
        prev.map((s) => (s.id === id ? data.section : s)),
      );
    } finally {
      setActionPending(null);
    }
  }

  async function handleUnpublish(id: string) {
    setActionPending(`${id}-unpublish`);
    try {
      const res = await fetch(`/api/homepage-sections/${id}/unpublish`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error ?? "Fehler beim Zurückziehen");
        return;
      }
      setSections((prev) =>
        prev.map((s) => (s.id === id ? data.section : s)),
      );
    } finally {
      setActionPending(null);
    }
  }

  function handleStartSchedule(id: string) {
    setSchedulingId(id);
    // Default to tomorrow at 09:00 local time
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    // datetime-local input expects "YYYY-MM-DDTHH:MM"
    const pad = (n: number) => String(n).padStart(2, "0");
    const localStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`;
    setScheduleDate(localStr);
    setScheduleError(null);
  }

  async function handleConfirmSchedule() {
    if (!schedulingId) return;
    setSchedulePending(true);
    setScheduleError(null);
    try {
      const dt = new Date(scheduleDate);
      if (isNaN(dt.getTime())) {
        setScheduleError("Ungültiges Datum.");
        return;
      }
      if (dt <= new Date()) {
        setScheduleError("Das Datum muss in der Zukunft liegen.");
        return;
      }
      const res = await fetch(`/api/homepage-sections/${schedulingId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledPublishAt: dt.toISOString() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setScheduleError(data?.error ?? "Fehler beim Planen");
        return;
      }
      setSections((prev) =>
        prev.map((s) => (s.id === schedulingId ? data.section : s)),
      );
      setSchedulingId(null);
    } finally {
      setSchedulePending(false);
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

  // ── Approval handlers (CMS V2 Slice 6) ──────────────────────────────────

  async function handleRequestReview(id: string) {
    setActionPending(`${id}-request-review`);
    try {
      const res = await fetch(`/api/homepage-sections/${id}/request-review`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error ?? "Fehler bei der Überprüfungsanfrage");
        return;
      }
      setSections((prev) => prev.map((s) => (s.id === id ? data.section : s)));
    } finally {
      setActionPending(null);
    }
  }

  function handleOpenReviewModal(
    id: string,
    label: string,
    action: "approve" | "reject",
  ) {
    setReviewModal({ id, label, action });
    setReviewNote("");
    setReviewError(null);
  }

  function handleCloseReviewModal() {
    if (reviewPending) return;
    setReviewModal(null);
    setReviewNote("");
    setReviewError(null);
  }

  async function handleConfirmReview() {
    if (!reviewModal) return;
    setReviewPending(true);
    setReviewError(null);
    const { id, action } = reviewModal;
    try {
      const res = await fetch(`/api/homepage-sections/${id}/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: reviewNote.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReviewError(data?.error ?? "Aktion fehlgeschlagen");
        return;
      }
      setSections((prev) => prev.map((s) => (s.id === id ? data.section : s)));
      setReviewModal(null);
      setReviewNote("");
    } finally {
      setReviewPending(false);
    }
  }

  const isAnyActionPending = actionPending !== null || bootstrapping;

  const publishedCount = sections.filter(
    (s) => s.isEnabled && s.publishStatus === "PUBLISHED",
  ).length;

  return (
    <>
      {/* Approval review modal (CMS V2 Slice 6) */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
            <div className="mb-3 flex items-center gap-2">
              {reviewModal.action === "approve" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {reviewModal.action === "approve"
                  ? "Sektion freigeben"
                  : "Änderungen anfordern"}
              </p>
            </div>
            <p className="mb-3 text-xs text-[var(--text-2)]">
              <strong>{reviewModal.label}</strong>
              {reviewModal.action === "approve"
                ? " wird zur Veröffentlichung freigegeben."
                : " wird zur Überarbeitung zurückgegeben."}
            </p>
            <div className="mb-4">
              <label className="fca-label mb-1 block">
                {reviewModal.action === "approve"
                  ? "Freigabenotiz (optional)"
                  : "Begründung (empfohlen)"}
              </label>
              <textarea
                className="fca-textarea min-h-[80px] resize-y"
                placeholder={
                  reviewModal.action === "approve"
                    ? "Optionale Notiz…"
                    : "Beschreibe die erforderlichen Änderungen…"
                }
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                disabled={reviewPending}
                rows={3}
                maxLength={1000}
              />
            </div>
            {reviewError && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {reviewError}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirmReview}
                disabled={reviewPending}
                className="fca-button-primary"
              >
                {reviewModal.action === "approve" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                {reviewPending
                  ? "Wird verarbeitet…"
                  : reviewModal.action === "approve"
                    ? "Freigeben"
                    : "Ablehnen"}
              </button>
              <button
                type="button"
                onClick={handleCloseReviewModal}
                disabled={reviewPending}
                className="fca-button-secondary"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule modal */}
      {schedulingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Veröffentlichung planen
              </p>
            </div>
            <p className="mb-3 text-xs text-[var(--text-2)]">
              Die Sektion wird ab diesem Zeitpunkt automatisch in der
              öffentlichen Homepage-API erscheinen.
            </p>
            <div className="mb-4">
              <label className="fca-label mb-1 block">Datum und Uhrzeit</label>
              <input
                type="datetime-local"
                className="fca-input"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                disabled={schedulePending}
              />
            </div>
            {scheduleError && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {scheduleError}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirmSchedule}
                disabled={schedulePending}
                className="fca-button-primary"
              >
                <Clock className="h-3.5 w-3.5" />
                {schedulePending ? "Wird geplant…" : "Planen"}
              </button>
              <button
                type="button"
                onClick={() => setSchedulingId(null)}
                disabled={schedulePending}
                className="fca-button-secondary"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

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

        {/* Governance info banner */}
        <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-3 text-xs text-[var(--text-2)]">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
            <span>
              <span className="font-medium text-[var(--foreground)]">Freigabe-Workflow (Slice 6):</span>{" "}
              Sektionen benötigen Status{" "}
              <span className="font-medium">Freigegeben</span> oder{" "}
              <span className="font-medium">Keine Freigabe erforderlich</span>, bevor sie veröffentlicht werden können.
              Nutze{" "}
              <span className="font-medium">Überprüfung anfordern</span> → <span className="font-medium">Freigeben</span> für den Approval-Workflow.
            </span>
          </div>
          <Link
            href={CMS_ROUTES.review}
            className="fca-button-secondary shrink-0 px-2 py-1 text-[10px]"
          >
            <ClipboardCheck className="h-3 w-3" />
            Review-Queue
          </Link>
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
                    Aktiv
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                    Freigabe
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                    Publikation
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
                    actionPending === `${section.id}-down` ||
                    actionPending === `${section.id}-publish` ||
                    actionPending === `${section.id}-unpublish` ||
                    actionPending === `${section.id}-request-review`;
                  const isEditing = editingId === section.id;
                  const isPublished = section.publishStatus === "PUBLISHED";
                  const approvalStatus = section.approvalStatus as ApprovalStatus;
                  const canPublish = APPROVAL_PUBLISH_ALLOWED.has(approvalStatus);
                  const isInReview = approvalStatus === APPROVAL_STATUS.IN_REVIEW;

                  return (
                    <Fragment key={section.id}>
                      <tr
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
                            {section.scheduledPublishAt &&
                              section.publishStatus !== "PUBLISHED" && (
                                <p className="mt-0.5 text-[11px] text-amber-600">
                                  Geplant:{" "}
                                  {new Date(section.scheduledPublishAt).toLocaleString("de-CH")}
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

                        {/* Approval status badge (CMS V2 Slice 6) */}
                        <td className="px-4 py-3">
                          <div>
                            <ApprovalStatusBadge approvalStatus={section.approvalStatus} />
                            {section.approvalNote && (
                              <p
                                className="mt-0.5 text-[10px] text-[var(--muted)] line-clamp-1"
                                title={section.approvalNote}
                              >
                                {section.approvalNote}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Publish status badge */}
                        <td className="px-4 py-3">
                          <PublishStatusBadge
                            publishStatus={section.publishStatus}
                            scheduledPublishAt={section.scheduledPublishAt}
                          />
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

                            {/* Publish / Unpublish */}
                            {isPublished ? (
                              <button
                                type="button"
                                onClick={() => handleUnpublish(section.id)}
                                disabled={isThisPending || isAnyActionPending || isEditing}
                                className="sce-icon-button text-blue-600 hover:text-blue-800"
                                title="Aus Publikation zurückziehen (Entwurf)"
                              >
                                <GlobeLock className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handlePublish(section.id)}
                                disabled={isThisPending || isAnyActionPending || isEditing || !canPublish}
                                className={`sce-icon-button ${canPublish ? "text-[var(--muted)] hover:text-blue-600" : "text-rose-300 cursor-not-allowed"}`}
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
                                onClick={() => handleStartSchedule(section.id)}
                                disabled={isThisPending || isAnyActionPending || isEditing || !canPublish}
                                className={`sce-icon-button ${canPublish ? "text-[var(--muted)] hover:text-amber-600" : "text-rose-300 cursor-not-allowed"}`}
                                title={
                                  !canPublish
                                    ? `Planung blockiert: ${APPROVAL_STATUS_LABELS[approvalStatus]}`
                                    : "Veröffentlichung planen"
                                }
                              >
                                <Clock className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {/* Approval actions (CMS V2 Slice 6) */}
                            {/* Request review — available from DRAFT, NOT_REQUIRED, CHANGES_REQUESTED, APPROVED */}
                            {approvalStatus !== APPROVAL_STATUS.IN_REVIEW && (
                              <button
                                type="button"
                                onClick={() => handleRequestReview(section.id)}
                                disabled={isThisPending || isAnyActionPending || isEditing}
                                className="sce-icon-button text-[var(--muted)] hover:text-blue-600"
                                title="Überprüfung anfordern"
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {/* Approve — available from IN_REVIEW */}
                            {isInReview && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenReviewModal(section.id, section.label, "approve")
                                }
                                disabled={isThisPending || isAnyActionPending || isEditing}
                                className="sce-icon-button text-emerald-600 hover:text-emerald-800"
                                title="Freigeben"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {/* Reject — available from IN_REVIEW */}
                            {isInReview && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenReviewModal(section.id, section.label, "reject")
                                }
                                disabled={isThisPending || isAnyActionPending || isEditing}
                                className="sce-icon-button text-red-500 hover:text-red-700"
                                title="Ablehnen / Änderungen anfordern"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </button>
                            )}

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
                            colSpan={7}
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
                                    onChangeFull={(fullConfig) => setEditConfig(fullConfig)}
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
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer count */}
        {!loading && sections.length > 0 && (
          <div className="border-t border-[var(--border)] px-5 py-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-[var(--muted)]">
              {publishedCount} von {sections.length} Sektionen aktiv &amp; veröffentlicht
              · sichtbar in der öffentlichen Homepage-API
            </p>
            <Link
              href={CMS_ROUTES.review}
              className="fca-button-secondary px-2 py-1 text-[10px]"
            >
              <ClipboardCheck className="h-3 w-3" />
              Review-Queue
            </Link>
          </div>
        )}
      </SectionCard>
    </>
  );
}
