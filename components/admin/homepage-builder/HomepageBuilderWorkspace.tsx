"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Info,
  Eye,
  Monitor,
  Tablet,
  Smartphone,
  X,
  RefreshCw,
  Blocks,
  Globe,
  GlobeLock,
} from "lucide-react";
import Link from "next/link";
import { SectionCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/Badge";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import type { HomepageSectionAdminItem } from "@/lib/homepage/admin-queries";
import { getBlockDefinition } from "@/lib/homepage/block-registry";
import { CMS_ROUTES } from "@/lib/cms/routes";
import { HomepageBuilderToolbar, type BuilderMode } from "./HomepageBuilderToolbar";
import { HomepageBuilderEmptyState } from "./HomepageBuilderEmptyState";
import { HomepageSectionCard } from "./HomepageSectionCard";
import { HomepageSectionInspector } from "./HomepageSectionInspector";
import { HomepageCanvas } from "./HomepageCanvas";
import WebsiteSectionDispatcher from "@/components/website/WebsiteSectionDispatcher";

// ---------------------------------------------------------------------------
// Preview panel types
// ---------------------------------------------------------------------------

type ViewportMode = "desktop" | "tablet" | "mobile";

const VIEWPORT_CONFIG: Record<ViewportMode, { label: string; icon: React.ElementType; maxWidth: string }> = {
  desktop: { label: "Desktop", icon: Monitor, maxWidth: "100%" },
  tablet: { label: "Tablet", icon: Tablet, maxWidth: "768px" },
  mobile: { label: "Mobile", icon: Smartphone, maxWidth: "375px" },
};

type PreviewMode = "all" | "published";

type PreviewSectionItem = {
  id: string;
  type: string;
  label: string;
  sortOrder: number;
  isEnabled: boolean;
  publishStatus: string;
  approvalStatus: string;
  config: Record<string, unknown>;
  isDraft: boolean;
  isDisabled: boolean;
  scheduledPublishAt: string | null;
};

// ---------------------------------------------------------------------------
// Preview panel sub-components
// ---------------------------------------------------------------------------

function SectionTypeBadgePreview({ type }: { type: string }) {
  const def = getBlockDefinition(type);
  return (
    <span className="inline-flex items-center rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted)]">
      {def?.displayName ?? type}
    </span>
  );
}

function EnabledBadgePreview({ isEnabled }: { isEnabled: boolean }) {
  return isEnabled ? (
    <StatusIndicator variant="success" label="Aktiv" size="sm" />
  ) : (
    <StatusIndicator variant="neutral" label="Deaktiviert" size="sm" />
  );
}

function PublishBadgePreview({ status }: { status: string }) {
  if (status === "PUBLISHED") {
    return (
      <Badge variant="info" size="sm">
        <Globe className="h-2.5 w-2.5" />
        Pub
      </Badge>
    );
  }
  return (
    <Badge variant="default" size="sm">
      <GlobeLock className="h-2.5 w-2.5" />
      Entwurf
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Preview panel
// ---------------------------------------------------------------------------

function HomepagePreviewPanel({ onClose }: { onClose: () => void }) {
  const [viewport, setViewport] = useState<ViewportMode>("desktop");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("all");
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<PreviewSectionItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/homepage-sections/preview")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setSections(d.sections ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Vorschau konnte nicht geladen werden.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const vc = VIEWPORT_CONFIG[viewport];

  const displaySections =
    previewMode === "published"
      ? sections.filter((s) => s.isEnabled && s.publishStatus === "PUBLISHED")
      : sections;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--background)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Eye className="h-4 w-4 text-[var(--text-2)]" />
          <div>
            <p className="text-sm font-semibold">Homepage Vorschau</p>
            <p className="text-[11px] text-[var(--muted)]">
              Nur-Lese-Modus · keine Änderungen werden gespeichert
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Draft / Published mode toggle */}
          <div className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
            {(["all", "published"] as PreviewMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPreviewMode(m)}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition ${
                  previewMode === m
                    ? "bg-white text-[var(--foreground)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {m === "all" ? "Entwurf" : "Veröffentlicht"}
              </button>
            ))}
          </div>

          {/* Viewport switcher */}
          <div className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
            {(["desktop", "tablet", "mobile"] as ViewportMode[]).map((v) => {
              const cfg = VIEWPORT_CONFIG[v];
              const Icon = cfg.icon;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setViewport(v)}
                  className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition ${
                    viewport === v
                      ? "bg-white text-[var(--foreground)] shadow-sm"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{cfg.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="fca-button-secondary px-2.5"
            title="Vorschau schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Preview body */}
      <div className="flex-1 overflow-auto bg-[var(--surface-2)] p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-[var(--muted)]">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            Lädt Vorschau…
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-32 text-rose-600 text-sm">
            {error}
          </div>
        ) : (
          <div
            className="mx-auto transition-all duration-300 rounded-lg border border-[var(--border)] bg-white overflow-hidden"
            style={{ maxWidth: vc.maxWidth }}
          >
            {displaySections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[var(--muted)]">
                <Blocks className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">
                  {previewMode === "published"
                    ? "Keine veröffentlichten Sektionen"
                    : "Keine Sektionen vorhanden"}
                </p>
              </div>
            ) : (
              <div>
                {displaySections.map((s) => {
                  const isVisible =
                    s.isEnabled && s.publishStatus === "PUBLISHED";
                  return (
                    <div
                      key={s.id}
                      className={`border-b border-[var(--border)] last:border-0 ${
                        !isVisible ? "opacity-50" : ""
                      }`}
                    >
                      {/* Status strip */}
                      <div className="flex items-center justify-between px-4 py-2 bg-[var(--surface-2)] text-[11px] gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-[var(--foreground)] truncate">
                            {s.label}
                          </span>
                          <SectionTypeBadgePreview type={s.type} />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <EnabledBadgePreview isEnabled={s.isEnabled} />
                          <PublishBadgePreview status={s.publishStatus} />
                        </div>
                      </div>

                      {/* Block visual */}
                      <Suspense
                        fallback={
                          <div className="h-16 animate-pulse bg-gray-50" />
                        }
                      >
                        <WebsiteSectionDispatcher
                          section={{ id: s.id, type: s.type, config: s.config }}
                          previewMode
                        />
                      </Suspense>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-2 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
        <span>
          {sections.length} Sektion{sections.length !== 1 ? "en" : ""} gesamt
        </span>
        <span>·</span>
        <span>
          {sections.filter((s) => s.isEnabled && s.publishStatus === "PUBLISHED").length} öffentlich sichtbar
        </span>
        {previewMode === "published" && (
          <>
            <span>·</span>
            <span className="text-blue-600">Nur veröffentlichte Sektionen</span>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main workspace
// ---------------------------------------------------------------------------

export default function HomepageBuilderWorkspace() {
  // ── Core state ────────────────────────────────────────────────────────────
  const [sections, setSections] = useState<HomepageSectionAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);

  // ── Edit state (which card is open) ──────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);

  // ── Schedule modal state ──────────────────────────────────────────────────
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [schedulePending, setSchedulePending] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // ── Review modal state ────────────────────────────────────────────────────
  const [reviewModal, setReviewModal] = useState<{
    id: string;
    label: string;
    action: "approve" | "reject";
  } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewPending, setReviewPending] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // ── Canvas / inspector state ──────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [builderMode, setBuilderMode] = useState<BuilderMode>("list");

  // ── Reorder state (Canvas drag & drop) ───────────────────────────────────
  const [reorderPending, setReorderPending] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────────

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

  // ── Action handlers ───────────────────────────────────────────────────────

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

  async function handleReorder(orderedIds: string[]) {
    const snapshot = sections;
    const reordered = orderedIds
      .map((id) => snapshot.find((s) => s.id === id))
      .filter((s): s is HomepageSectionAdminItem => s !== undefined);

    setSections(reordered);
    setReorderPending(true);
    setReorderError(null);

    try {
      const res = await fetch("/api/homepage-sections/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSections(snapshot);
        setReorderError(data?.error ?? "Reihenfolge konnte nicht gespeichert werden.");
        return;
      }
      setSections(data.sections ?? reordered);
    } finally {
      setReorderPending(false);
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
      setSections((prev) => prev.map((s) => (s.id === id ? data.section : s)));
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
      setSections((prev) => prev.map((s) => (s.id === id ? data.section : s)));
    } finally {
      setActionPending(null);
    }
  }

  function handleStartSchedule(id: string) {
    setSchedulingId(id);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
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
      const res = await fetch(
        `/api/homepage-sections/${schedulingId}/schedule`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduledPublishAt: dt.toISOString() }),
        },
      );
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

  // ── Save edit callback (called from card) ─────────────────────────────────

  async function handleSaveEdit(
    id: string,
    label: string,
    config: Record<string, unknown>,
  ): Promise<void> {
    const res = await fetch(`/api/homepage-sections/${id}/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, config }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.details
        ? `${data.error}: ${(data.details as string[]).join(", ")}`
        : (data?.error ?? "Fehler beim Speichern");
      throw new Error(msg);
    }
    setSections((prev) =>
      prev.map((s) => (s.id === id ? data.section : s)),
    );
    setEditingId(null);
  }

  // ── Review handlers ───────────────────────────────────────────────────────

  async function handleRequestReview(id: string) {
    setActionPending(`${id}-request-review`);
    try {
      const res = await fetch(
        `/api/homepage-sections/${id}/request-review`,
        { method: "PATCH" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error ?? "Fehler bei der Überprüfungsanfrage");
        return;
      }
      setSections((prev) =>
        prev.map((s) => (s.id === id ? data.section : s)),
      );
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
      setSections((prev) =>
        prev.map((s) => (s.id === id ? data.section : s)),
      );
      setReviewModal(null);
      setReviewNote("");
    } finally {
      setReviewPending(false);
    }
  }

  // ── Builder mode change ───────────────────────────────────────────────────

  function handleBuilderModeChange(mode: BuilderMode) {
    if (mode === "canvas") {
      // Clear the inline edit form when entering canvas — editing stays in list
      setEditingId(null);
    }
    setBuilderMode(mode);
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const isAnyActionPending = actionPending !== null || bootstrapping;
  const publishedCount = sections.filter(
    (s) => s.isEnabled && s.publishStatus === "PUBLISHED",
  ).length;

  const selectedSection =
    sections.find((s) => s.id === selectedId) ?? null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Preview overlay */}
      {showPreview && (
        <HomepagePreviewPanel onClose={() => setShowPreview(false)} />
      )}

      {/* Review modal */}
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

      {/* Main builder */}
      <SectionCard noPadding>
        {/* Toolbar */}
        <HomepageBuilderToolbar
          sectionCount={sections.length}
          publishedCount={publishedCount}
          loading={loading}
          disabled={isAnyActionPending}
          builderMode={builderMode}
          onBuilderModeChange={handleBuilderModeChange}
          onRefresh={load}
          onPreview={() => setShowPreview(true)}
        />

        {/* Governance info banner */}
        <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-3 text-xs text-[var(--text-2)]">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
            <span>
              <span className="font-medium text-[var(--foreground)]">
                Freigabe-Workflow:
              </span>{" "}
              Sektionen benötigen Status{" "}
              <span className="font-medium">Freigegeben</span> oder{" "}
              <span className="font-medium">Keine Freigabe erforderlich</span>,
              bevor sie veröffentlicht werden können.
            </span>
          </div>
          <Link
            href={CMS_ROUTES.review}
            className="fca-button-secondary shrink-0 px-2 py-1 text-[10px]"
          >
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
                className="h-20 animate-pulse rounded-xl bg-[var(--surface-2)]"
              />
            ))}
          </div>
        ) : sections.length === 0 ? (
          <HomepageBuilderEmptyState
            onBootstrap={handleBootstrap}
            bootstrapping={bootstrapping}
          />
        ) : (
          /* Two-column workspace */
          <div className="flex flex-col lg:flex-row lg:divide-x lg:divide-[var(--border)]">
            {/* ── Left panel: List or Canvas ── */}
            <div className="flex-1 min-w-0">
              {builderMode === "canvas" ? (
                /* Canvas Mode */
                <HomepageCanvas
                  sections={sections}
                  selectedId={selectedId}
                  actionPending={actionPending}
                  isAnyPending={isAnyActionPending}
                  onBootstrap={handleBootstrap}
                  bootstrapping={bootstrapping}
                  onSelectSection={(id) =>
                    setSelectedId((prev) => (prev === id ? null : id))
                  }
                  onToggle={(id) => handleToggle(id)}
                  onMoveUp={(id) => handleMove(id, "up")}
                  onMoveDown={(id) => handleMove(id, "down")}
                  onPublish={(id) => handlePublish(id)}
                  onUnpublish={(id) => handleUnpublish(id)}
                  onStartEdit={(id) => {
                    setEditingId(id);
                    setSelectedId(id);
                    // Switch back to list so the inline edit form is visible
                    setBuilderMode("list");
                  }}
                  onReorder={handleReorder}
                  reorderPending={reorderPending}
                  reorderError={reorderError}
                />
              ) : (
                /* List Mode */
                <div className="p-5">
                  <div className="space-y-3">
                    {sections.map((section, idx) => {
                      const isFirst = idx === 0;
                      const isLast = idx === sections.length - 1;
                      const isSelected = selectedId === section.id;
                      const isEditing = editingId === section.id;
                      const isPending =
                        actionPending === section.id ||
                        actionPending === `${section.id}-up` ||
                        actionPending === `${section.id}-down` ||
                        actionPending === `${section.id}-publish` ||
                        actionPending === `${section.id}-unpublish` ||
                        actionPending === `${section.id}-request-review`;

                      return (
                        <HomepageSectionCard
                          key={section.id}
                          section={section}
                          isFirst={isFirst}
                          isLast={isLast}
                          isSelected={isSelected}
                          isEditing={isEditing}
                          isPending={isPending}
                          isAnyPending={isAnyActionPending}
                          onSelect={() =>
                            setSelectedId((prev) =>
                              prev === section.id ? null : section.id,
                            )
                          }
                          onToggle={() => handleToggle(section.id)}
                          onMoveUp={() => handleMove(section.id, "up")}
                          onMoveDown={() => handleMove(section.id, "down")}
                          onPublish={() => handlePublish(section.id)}
                          onUnpublish={() => handleUnpublish(section.id)}
                          onStartSchedule={() => handleStartSchedule(section.id)}
                          onStartEdit={() => {
                            setEditingId(section.id);
                            setSelectedId(section.id);
                          }}
                          onCancelEdit={() => setEditingId(null)}
                          onSaveEdit={(label, config) =>
                            handleSaveEdit(section.id, label, config)
                          }
                          onRequestReview={() => handleRequestReview(section.id)}
                          onOpenApprove={() =>
                            handleOpenReviewModal(section.id, section.label, "approve")
                          }
                          onOpenReject={() =>
                            handleOpenReviewModal(section.id, section.label, "reject")
                          }
                        />
                      );
                    })}
                  </div>

                  {/* Footer count */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] text-[var(--muted)]">
                      {publishedCount} von {sections.length} Sektionen aktiv &amp;
                      veröffentlicht · sichtbar in der öffentlichen Homepage-API
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Inspector panel (shared between modes) ── */}
            <div className="w-full lg:w-80 xl:w-96 shrink-0 border-t border-[var(--border)] lg:border-t-0">
              <div className="sticky top-0 max-h-screen overflow-y-auto">
                <div className="border-b border-[var(--border)] px-4 py-3 bg-[var(--surface-2)]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                    Sektion Inspector
                  </p>
                </div>
                <HomepageSectionInspector section={selectedSection} />
              </div>
            </div>
          </div>
        )}
      </SectionCard>
    </>
  );
}
