"use client";

/**
 * components/admin/homepage/HomepageSectionList.tsx
 *
 * Homepage Builder — CMS V3 Inspector Panel V2.
 *
 * Migrated from legacy table-based editor with per-row inline editing to the
 * same Inspector sidebar architecture used by PageBuilderClient.
 *
 * Shared with Page Builder:
 *   - InspectorPanel (all 8 collapsible sections)
 *   - LayoutConfigPanel (Layout + Background sections)
 *   - SplitContentCardsInspectorContent (Content + Style for splitContentCards)
 *   - Block Registry supportsInspector capabilities
 *   - InspectorSectionData generic shape
 *   - InspectorWorkflowCallbacks (homepage-specific API endpoints wired here)
 *
 * Homepage-specific:
 *   - Bootstrap empty state (POST /api/homepage-sections)
 *   - Save via PATCH /api/homepage-sections/[id]/config
 *   - Publish/unpublish via separate PATCH endpoints (not unified workflow)
 *   - Approval workflow: request-review, approve (with note), reject (with note)
 *   - No revision history (homepage sections have no revision API yet)
 *   - Autosave (1.5s debounce) replaces explicit save button
 *   - Approve/reject modal preserved (carries optional approval note)
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  Fragment,
} from "react";
import {
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Pencil,
  RefreshCw,
  Globe,
  GlobeLock,
  Clock,
  Info,
  CheckCircle2,
  XCircle,
  LayoutTemplate,
  Sparkles,
  AlertCircle,
  Check,
  Save,
  PanelRight,
  ClipboardCheck,
  UserCheck,
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
import { getBlockDefinition } from "@/lib/homepage/block-registry";
import { CMS_ROUTES } from "@/lib/cms/routes";
import InspectorPanel from "@/components/admin/inspector/InspectorPanel";
import type { InspectorSaveState } from "@/components/admin/inspector/InspectorToolbar";
import type {
  InspectorSectionData,
  InspectorWorkflowCallbacks,
} from "@/lib/cms/inspector-types";
import { adaptToInspectorData } from "@/lib/cms/inspector-types";
import { SECTION_PUBLISH_STATUS } from "@/lib/cms/section-publishing";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTOSAVE_DELAY_MS = 1500;

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

function adaptHomepageSection(
  section: HomepageSectionAdminItem,
): InspectorSectionData {
  return adaptToInspectorData({
    id: section.id,
    type: section.type,
    label: section.label,
    isEnabled: section.isEnabled,
    config: section.config as Record<string, unknown>,
    publishStatus: section.publishStatus,
    approvalStatus: section.approvalStatus,
    scheduledPublishAt: section.scheduledPublishAt,
  });
}

// ---------------------------------------------------------------------------
// Status badges (section list)
// ---------------------------------------------------------------------------

function EnabledBadge({ isEnabled }: { isEnabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        isEnabled
          ? "bg-emerald-50 text-emerald-700"
          : "bg-[var(--surface-2)] text-[var(--muted)]"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isEnabled ? "bg-emerald-500" : "bg-gray-300"}`} />
      {isEnabled ? "Aktiv" : "Deaktiviert"}
    </span>
  );
}

function PublishBadge({ status, scheduledAt }: { status: string; scheduledAt: Date | null }) {
  const isPublished = status === SECTION_PUBLISH_STATUS.PUBLISHED;
  const isScheduled =
    !isPublished &&
    scheduledAt !== null &&
    scheduledAt > new Date();

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
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
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

function ApprovalBadge({ status }: { status: string }) {
  const as = status as ApprovalStatus;
  const label = APPROVAL_STATUS_LABELS[as] ?? status;
  const colorClass: Record<string, string> = {
    NOT_REQUIRED: "bg-[var(--surface-2)] text-[var(--text-2)]",
    DRAFT: "bg-amber-50 text-amber-600",
    IN_REVIEW: "bg-blue-50 text-blue-600",
    APPROVED: "bg-emerald-50 text-emerald-600",
    CHANGES_REQUESTED: "bg-rose-50 text-rose-600",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${colorClass[status] ?? colorClass.NOT_REQUIRED}`}>
      {label}
    </span>
  );
}

function SectionTypeBadge({ type }: { type: string }) {
  const def = getBlockDefinition(type);
  return (
    <span className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-2)]">
      {def?.displayName ?? type}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Autosave indicator
// ---------------------------------------------------------------------------

function SaveIndicator({ state, lastSaved }: { state: InspectorSaveState; lastSaved: Date | null }) {
  if (state === "idle" && !lastSaved) return null;
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      {state === "saving" && (
        <>
          <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
          <span className="text-[var(--muted)]">Speichern…</span>
        </>
      )}
      {state === "saved" && (
        <>
          <Check className="h-3 w-3 text-emerald-500" />
          <span className="text-[var(--muted)]">
            Gespeichert{lastSaved ? ` · ${lastSaved.toLocaleTimeString("de-CH")}` : ""}
          </span>
        </>
      )}
      {state === "error" && (
        <>
          <AlertCircle className="h-3 w-3 text-rose-500" />
          <span className="text-rose-600">Speichern fehlgeschlagen</span>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Build homepage workflow callbacks
// ---------------------------------------------------------------------------

function buildHomepageWorkflowCallbacks(
  sectionId: string,
  approvalStatus: string,
  onSectionUpdated: (updated: HomepageSectionAdminItem) => void,
  openApproveModal: (id: string, action: "approve" | "reject") => void,
): InspectorWorkflowCallbacks {
  async function patchEndpoint(
    endpoint: string,
    body?: Record<string, unknown>,
  ): Promise<InspectorSectionData> {
    const res = await fetch(`/api/homepage-sections/${sectionId}/${endpoint}`, {
      method: "PATCH",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Fehler");
    onSectionUpdated(data.section as HomepageSectionAdminItem);
    return adaptHomepageSection(data.section as HomepageSectionAdminItem);
  }

  const as = approvalStatus as ApprovalStatus;
  const canPublish = APPROVAL_PUBLISH_ALLOWED.has(as);

  return {
    ...(canPublish
      ? { publish: () => patchEndpoint("publish") }
      : {}),
    unpublish: () => patchEndpoint("unpublish"),
    ...(as !== APPROVAL_STATUS.IN_REVIEW
      ? { requestReview: () => patchEndpoint("request-review") }
      : {}),
    // Approve/reject open a modal in the parent — we use a sentinel callback
    ...(as === APPROVAL_STATUS.IN_REVIEW
      ? {
          approve: async () => {
            openApproveModal(sectionId, "approve");
            // Return a pending promise — the modal will resolve/reject separately
            return new Promise<InspectorSectionData>((_, reject) =>
              reject(new Error("Modal geöffnet — bitte im Dialog bestätigen.")),
            );
          },
          reject: async () => {
            openApproveModal(sectionId, "reject");
            return new Promise<InspectorSectionData>((_, reject) =>
              reject(new Error("Modal geöffnet — bitte im Dialog bestätigen.")),
            );
          },
        }
      : {}),
    schedule: (isoDate) =>
      patchEndpoint("schedule", { scheduledPublishAt: isoDate }),
  };
}

// ---------------------------------------------------------------------------
// Main HomepageSectionList
// ---------------------------------------------------------------------------

export default function HomepageSectionList() {
  const [sections, setSections] = useState<HomepageSectionAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);

  // Inspector selection + shadow state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorConfig, setInspectorConfig] = useState<Record<string, unknown>>({});
  const [inspectorLabel, setInspectorLabel] = useState<string>("");

  // Autosave
  const [saveState, setSaveState] = useState<InspectorSaveState>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inspectorRef = useRef<{
    id: string | null;
    label: string;
    config: Record<string, unknown>;
  }>({ id: null, label: "", config: {} });

  useEffect(() => {
    inspectorRef.current = { id: selectedId, label: inspectorLabel, config: inspectorConfig };
  }, [selectedId, inspectorLabel, inspectorConfig]);

  // Approval modal state (approve/reject with note)
  const [approvalModal, setApprovalModal] = useState<{
    id: string;
    action: "approve" | "reject";
  } | null>(null);
  const [approvalNote, setApprovalNote] = useState("");
  const [approvalPending, setApprovalPending] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

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

  useEffect(() => { load(); }, [load]);

  // ---------------------------------------------------------------------------
  // Inspector selection
  // ---------------------------------------------------------------------------

  function selectSection(section: HomepageSectionAdminItem) {
    setSelectedId(section.id);
    setInspectorConfig({ ...(section.config as Record<string, unknown>) });
    setInspectorLabel(section.label);
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }

  function closeInspector() {
    setSelectedId(null);
    setIsDirty(false);
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Autosave
  // ---------------------------------------------------------------------------

  const triggerAutosave = useCallback(() => {
    setIsDirty(true);
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      const { id, label, config } = inspectorRef.current;
      if (!id || !label.trim()) return;
      setSaveState("saving");
      try {
        const res = await fetch(`/api/homepage-sections/${id}/config`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: label.trim(), config }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? "Speichern fehlgeschlagen");
        setSections((prev) => prev.map((s) => (s.id === id ? data.section : s)));
        setSaveState("saved");
        setLastSaved(new Date());
        setIsDirty(false);
      } catch {
        setSaveState("error");
      }
    }, AUTOSAVE_DELAY_MS);
  }, []);

  // ---------------------------------------------------------------------------
  // Inspector change handlers
  // ---------------------------------------------------------------------------

  const handleInspectorConfigChange = useCallback(
    (config: Record<string, unknown>) => {
      setInspectorConfig(config);
      triggerAutosave();
    },
    [triggerAutosave],
  );

  const handleInspectorLabelChange = useCallback(
    (label: string) => {
      setInspectorLabel(label);
      triggerAutosave();
    },
    [triggerAutosave],
  );

  const handleSectionUpdate = useCallback(
    (updated: InspectorSectionData) => {
      setSections((prev) =>
        prev.map((s) => {
          if (s.id !== updated.id) return s;
          return {
            ...s,
            publishStatus: updated.publishStatus as HomepageSectionAdminItem["publishStatus"],
            approvalStatus: updated.approvalStatus as HomepageSectionAdminItem["approvalStatus"],
            scheduledPublishAt: updated.scheduledPublishAt,
            label: updated.label,
            config: updated.config as HomepageSectionAdminItem["config"],
          };
        }),
      );
      if (selectedId === updated.id) {
        setInspectorConfig({ ...updated.config });
        setInspectorLabel(updated.label);
      }
    },
    [selectedId],
  );

  // When a section is updated directly (toggle, move)
  function updateSection(updated: HomepageSectionAdminItem) {
    setSections((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    if (selectedId === updated.id) {
      setInspectorConfig({ ...(updated.config as Record<string, unknown>) });
      setInspectorLabel(updated.label);
    }
  }

  // ---------------------------------------------------------------------------
  // Section actions
  // ---------------------------------------------------------------------------

  async function handleToggle(id: string) {
    setActionPending(id);
    try {
      const res = await fetch(`/api/homepage-sections/${id}/toggle`, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data?.error ?? "Fehler"); return; }
      updateSection(data.section);
    } finally {
      setActionPending(null);
    }
  }

  async function handleMove(id: string, direction: "up" | "down") {
    setActionPending(id);
    try {
      const res = await fetch(`/api/homepage-sections/${id}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data?.error ?? "Fehler"); return; }
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

  // ---------------------------------------------------------------------------
  // Approval modal
  // ---------------------------------------------------------------------------

  function openApproveModal(id: string, action: "approve" | "reject") {
    setApprovalModal({ id, action });
    setApprovalNote("");
    setApprovalError(null);
  }

  function closeApprovalModal() {
    if (approvalPending) return;
    setApprovalModal(null);
    setApprovalNote("");
    setApprovalError(null);
  }

  async function confirmApproval() {
    if (!approvalModal) return;
    setApprovalPending(true);
    setApprovalError(null);
    const { id, action } = approvalModal;
    try {
      const res = await fetch(`/api/homepage-sections/${id}/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: approvalNote.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setApprovalError(data?.error ?? "Aktion fehlgeschlagen");
        return;
      }
      updateSection(data.section);
      setApprovalModal(null);
      setApprovalNote("");
    } finally {
      setApprovalPending(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Derived inspector data
  // ---------------------------------------------------------------------------

  const selectedSection = sections.find((s) => s.id === selectedId);

  const inspectorSection: InspectorSectionData | null = selectedSection
    ? {
        ...adaptHomepageSection(selectedSection),
        config: inspectorConfig,
        label: inspectorLabel,
      }
    : null;

  const workflowCallbacks: InspectorWorkflowCallbacks | undefined =
    selectedSection
      ? buildHomepageWorkflowCallbacks(
          selectedSection.id,
          selectedSection.approvalStatus,
          updateSection,
          openApproveModal,
        )
      : undefined;

  const hasInspector = !!inspectorSection;
  const isAnyActionPending = actionPending !== null || bootstrapping;

  const publishedCount = sections.filter(
    (s) => s.isEnabled && s.publishStatus === "PUBLISHED",
  ).length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Approval modal */}
      {approvalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
            <div className="mb-3 flex items-center gap-2">
              {approvalModal.action === "approve" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {approvalModal.action === "approve"
                  ? "Sektion freigeben"
                  : "Änderungen anfordern"}
              </p>
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-[var(--foreground)]">
                {approvalModal.action === "approve"
                  ? "Freigabenotiz (optional)"
                  : "Begründung (empfohlen)"}
              </label>
              <textarea
                className="fca-textarea min-h-[80px] resize-y"
                placeholder={
                  approvalModal.action === "approve"
                    ? "Optionale Notiz…"
                    : "Beschreibe die erforderlichen Änderungen…"
                }
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                disabled={approvalPending}
                rows={3}
                maxLength={1000}
              />
            </div>
            {approvalError && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {approvalError}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmApproval}
                disabled={approvalPending}
                className="fca-button-primary"
              >
                {approvalModal.action === "approve" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                {approvalPending
                  ? "Wird verarbeitet…"
                  : approvalModal.action === "approve"
                    ? "Freigeben"
                    : "Ablehnen"}
              </button>
              <button
                type="button"
                onClick={closeApprovalModal}
                disabled={approvalPending}
                className="fca-button-secondary"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <p className="text-sm text-[var(--muted)]">
              {loading
                ? "Wird geladen…"
                : `${sections.length} Sektion${sections.length !== 1 ? "en" : ""} konfiguriert`}
            </p>
            <SaveIndicator state={saveState} lastSaved={lastSaved} />
          </div>
          <div className="flex items-center gap-2">
            {hasInspector && (
              <div className="flex items-center gap-1 rounded-md border border-[var(--brand-primary,#f97316)] bg-orange-50 px-2.5 py-1 text-[11px] font-medium text-orange-700">
                <PanelRight className="h-3 w-3" />
                Inspector aktiv
              </div>
            )}
            <Link
              href={CMS_ROUTES.review}
              className="fca-button-secondary px-2.5 text-xs"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              <span className="ml-1 hidden sm:inline">Review-Queue</span>
            </Link>
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
        </div>

        {/* Unsaved changes */}
        {isDirty && saveState !== "saving" && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <Save className="h-3.5 w-3.5 flex-shrink-0" />
            Ungespeicherte Änderungen — wird automatisch gespeichert…
          </div>
        )}

        {/* Governance info */}
        <div className="flex items-start justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-xs text-[var(--text-2)]">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
            <span>
              <span className="font-medium text-[var(--foreground)]">Freigabe-Workflow:</span>{" "}
              Sektionen benötigen Status <strong>Freigegeben</strong> oder{" "}
              <strong>Keine Freigabe erforderlich</strong> bevor sie veröffentlicht werden können.
              Inspector → Publishing → Zur Überprüfung → Freigeben.
            </span>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Main layout: section list + optional inspector sidebar */}
        <div className={`flex gap-4 ${hasInspector ? "items-start" : ""}`}>
          {/* Section list */}
          <div className={`min-w-0 flex-1 ${hasInspector ? "max-w-[60%]" : ""}`}>
            <SectionCard noPadding>
              {loading && sections.length === 0 ? (
                <div className="space-y-2 p-5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-14 animate-pulse rounded-lg bg-[var(--surface-2)]" />
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
                <div className="divide-y divide-[var(--border)]">
                  {sections.map((section, idx) => {
                    const isSelected = selectedId === section.id;
                    const isFirst = idx === 0;
                    const isLast = idx === sections.length - 1;
                    const as = section.approvalStatus as ApprovalStatus;
                    const isInReview = as === APPROVAL_STATUS.IN_REVIEW;

                    return (
                      <Fragment key={section.id}>
                        <div
                          onClick={() =>
                            isSelected ? closeInspector() : selectSection(section)
                          }
                          className={`cursor-pointer px-4 py-3 transition-colors ${
                            isSelected
                              ? "bg-orange-50 ring-1 ring-inset ring-[var(--brand-primary,#f97316)]"
                              : "hover:bg-[var(--surface-2)]"
                          } ${!section.isEnabled ? "opacity-70" : ""}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            {/* Section info */}
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex flex-wrap items-center gap-2">
                                <span className="w-5 shrink-0 text-right text-xs font-mono text-[var(--muted)]">
                                  {String(section.sortOrder).padStart(2, "0")}
                                </span>
                                <span className="truncate text-sm font-medium text-[var(--foreground)]">
                                  {section.label}
                                </span>
                                {isSelected && (
                                  <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">
                                    Ausgewählt
                                  </span>
                                )}
                                <EnabledBadge isEnabled={section.isEnabled} />
                                <PublishBadge
                                  status={section.publishStatus}
                                  scheduledAt={section.scheduledPublishAt}
                                />
                                <ApprovalBadge status={section.approvalStatus} />
                              </div>
                              <div className="ml-7 flex flex-wrap items-center gap-2">
                                <SectionTypeBadge type={section.type} />
                                {section.approvalNote && (
                                  <span className="max-w-[160px] truncate text-[10px] text-[var(--muted)]" title={section.approvalNote}>
                                    {section.approvalNote}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div
                              className="flex shrink-0 items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Inspector toggle */}
                              <button
                                type="button"
                                onClick={() =>
                                  isSelected ? closeInspector() : selectSection(section)
                                }
                                className={`sce-icon-button ${isSelected ? "text-orange-600" : ""}`}
                                title={isSelected ? "Inspector schliessen" : "Inspector öffnen"}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>

                              {/* Move up */}
                              <button
                                type="button"
                                onClick={() => handleMove(section.id, "up")}
                                disabled={isFirst || isAnyActionPending}
                                className="sce-icon-button disabled:opacity-30"
                                title="Nach oben"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>

                              {/* Move down */}
                              <button
                                type="button"
                                onClick={() => handleMove(section.id, "down")}
                                disabled={isLast || isAnyActionPending}
                                className="sce-icon-button disabled:opacity-30"
                                title="Nach unten"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>

                              {/* Toggle enabled */}
                              <button
                                type="button"
                                onClick={() => handleToggle(section.id)}
                                disabled={isAnyActionPending}
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

                              {/* Quick review actions (accessible outside inspector) */}
                              {as !== APPROVAL_STATUS.IN_REVIEW && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setActionPending(`${section.id}-rr`);
                                    try {
                                      const res = await fetch(
                                        `/api/homepage-sections/${section.id}/request-review`,
                                        { method: "PATCH" },
                                      );
                                      const data = await res.json().catch(() => ({}));
                                      if (!res.ok) { alert(data?.error ?? "Fehler"); return; }
                                      updateSection(data.section);
                                    } finally {
                                      setActionPending(null);
                                    }
                                  }}
                                  disabled={isAnyActionPending}
                                  className="sce-icon-button text-[var(--muted)] hover:text-blue-600"
                                  title="Überprüfung anfordern"
                                >
                                  <UserCheck className="h-3.5 w-3.5" />
                                </button>
                              )}

                              {isInReview && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openApproveModal(section.id, "approve")}
                                    disabled={isAnyActionPending}
                                    className="sce-icon-button text-emerald-600 hover:text-emerald-800"
                                    title="Freigeben"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openApproveModal(section.id, "reject")}
                                    disabled={isAnyActionPending}
                                    className="sce-icon-button text-rose-500 hover:text-rose-700"
                                    title="Ablehnen"
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </Fragment>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Inspector sidebar */}
          {hasInspector && inspectorSection && (
            <div className="w-[40%] min-w-[320px] flex-shrink-0">
              <div
                className="sticky top-4 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-sm"
                style={{ maxHeight: "calc(100vh - 8rem)" }}
              >
                <InspectorPanel
                  section={inspectorSection}
                  workflowCallbacks={workflowCallbacks}
                  onConfigChange={handleInspectorConfigChange}
                  onLabelChange={handleInspectorLabelChange}
                  onSectionUpdate={handleSectionUpdate}
                  saveState={saveState}
                  lastSaved={lastSaved}
                  onClose={closeInspector}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && sections.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
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

        {/* Info footer */}
        <div className="space-y-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
          <p className="text-xs text-[var(--muted)]">
            <strong className="text-[var(--text-2)]">Inspector:</strong>{" "}
            Klicke auf eine Sektion, um sie im Inspector zu bearbeiten. Content, Layout, Background, Visibility, Publishing und Advanced in einem Bereich.
          </p>
          <p className="text-xs text-[var(--muted)]">
            <strong className="text-[var(--text-2)]">Autosave:</strong>{" "}
            Änderungen werden automatisch nach 1,5 Sekunden gespeichert.
          </p>
        </div>
      </div>
    </>
  );
}
