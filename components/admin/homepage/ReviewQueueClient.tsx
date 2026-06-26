"use client";

/**
 * ReviewQueueClient — CMS V2 Slice 6
 *
 * Client component for the editorial review queue dashboard.
 * Renders the queue with approve/reject/request-review actions.
 * Receives initial server-fetched data; refreshes on action.
 */

import { useState, useCallback } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  FileEdit,
  RefreshCw,
  AlertCircle,
  UserCheck,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { SectionCard, EmptyState } from "@/components/ui/page";
import type { HomepageSectionAdminItem } from "@/lib/homepage/admin-queries";
import {
  APPROVAL_STATUS,
  type ApprovalStatus,
} from "@/lib/homepage/approval-constants";
import { CMS_ROUTES } from "@/lib/cms/routes";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type StatusConfig = Record<
  ApprovalStatus,
  { icon: React.ElementType; colorClass: string; bgClass: string }
>;

type Props = {
  queue: HomepageSectionAdminItem[];
  recentlyApproved: HomepageSectionAdminItem[];
  statusConfig: StatusConfig;
  approvalStatusLabels: Record<ApprovalStatus, string>;
};

// ---------------------------------------------------------------------------
// ApprovalBadge
// ---------------------------------------------------------------------------

function ApprovalBadge({
  status,
  statusConfig,
  labels,
}: {
  status: ApprovalStatus;
  statusConfig: StatusConfig;
  labels: Record<ApprovalStatus, string>;
}) {
  const cfg = statusConfig[status];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.bgClass} ${cfg.colorClass}`}
    >
      <Icon className="h-3 w-3" />
      {labels[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ReviewQueueClient
// ---------------------------------------------------------------------------

export function ReviewQueueClient({
  queue: initialQueue,
  recentlyApproved: initialApproved,
  statusConfig,
  approvalStatusLabels,
}: Props) {
  const [queue, setQueue] = useState(initialQueue);
  const [recentlyApproved, setRecentlyApproved] = useState(initialApproved);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);

  // Note modal state
  const [noteModal, setNoteModal] = useState<{
    id: string;
    label: string;
    action: "approve" | "reject";
  } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [notePending, setNotePending] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/homepage-sections/review-queue");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Ladefehler");
      setQueue(data.queue ?? []);
      setRecentlyApproved(data.recentlyApproved ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

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
      await reload();
    } finally {
      setActionPending(null);
    }
  }

  function openNoteModal(id: string, label: string, action: "approve" | "reject") {
    setNoteModal({ id, label, action });
    setNoteText("");
    setNoteError(null);
  }

  function closeNoteModal() {
    if (notePending) return;
    setNoteModal(null);
    setNoteText("");
    setNoteError(null);
  }

  async function handleConfirmAction() {
    if (!noteModal) return;
    setNotePending(true);
    setNoteError(null);
    const { id, action } = noteModal;
    try {
      const res = await fetch(`/api/homepage-sections/${id}/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteText.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNoteError(data?.error ?? "Aktion fehlgeschlagen");
        return;
      }
      setNoteModal(null);
      setNoteText("");
      await reload();
    } finally {
      setNotePending(false);
    }
  }

  const inReview = queue.filter(
    (s) => s.approvalStatus === APPROVAL_STATUS.IN_REVIEW,
  );
  const changesRequested = queue.filter(
    (s) => s.approvalStatus === APPROVAL_STATUS.CHANGES_REQUESTED,
  );
  const drafts = queue.filter(
    (s) => s.approvalStatus === APPROVAL_STATUS.DRAFT,
  );

  const isQueueEmpty = queue.length === 0;

  return (
    <>
      {/* Note modal */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
            <div className="mb-3 flex items-center gap-2">
              {noteModal.action === "approve" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {noteModal.action === "approve" ? "Sektion freigeben" : "Änderungen anfordern"}
              </p>
            </div>
            <p className="mb-3 text-xs text-[var(--text-2)]">
              <strong>{noteModal.label}</strong>
              {noteModal.action === "approve"
                ? " wird zur Veröffentlichung freigegeben."
                : " wird zur Überarbeitung zurückgegeben."}
            </p>
            <div className="mb-4">
              <label className="fca-label mb-1 block">
                {noteModal.action === "approve"
                  ? "Freigabenotiz (optional)"
                  : "Begründung für Änderungen (empfohlen)"}
              </label>
              <textarea
                className="fca-textarea min-h-[80px] resize-y"
                placeholder={
                  noteModal.action === "approve"
                    ? "Optionale Notiz für den Autor…"
                    : "Beschreibe die erforderlichen Änderungen…"
                }
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                disabled={notePending}
                rows={3}
                maxLength={1000}
              />
            </div>
            {noteError && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {noteError}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={notePending}
                className={`fca-button-primary ${noteModal.action === "reject" ? "!bg-red-600 hover:!bg-red-700" : ""}`}
              >
                {noteModal.action === "approve" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                {notePending
                  ? "Wird verarbeitet…"
                  : noteModal.action === "approve"
                    ? "Freigeben"
                    : "Ablehnen"}
              </button>
              <button
                type="button"
                onClick={closeNoteModal}
                disabled={notePending}
                className="fca-button-secondary"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-[var(--muted)]">
          {loading ? "Wird geladen…" : `${queue.length} Sektion${queue.length !== 1 ? "en" : ""} in der Queue`}
        </p>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="fca-button-secondary px-2.5"
          title="Aktualisieren"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* In Review */}
      {inReview.length > 0 && (
        <Section
          title="In Überprüfung"
          icon={Clock}
          colorClass="text-blue-600"
          bgClass="bg-blue-50"
          borderClass="border-blue-100"
        >
          {inReview.map((s) => (
            <QueueRow
              key={s.id}
              section={s}
              statusConfig={statusConfig}
              approvalStatusLabels={approvalStatusLabels}
              actionPending={actionPending}
              showApprove
              showReject
              onApprove={() => openNoteModal(s.id, s.label, "approve")}
              onReject={() => openNoteModal(s.id, s.label, "reject")}
            />
          ))}
        </Section>
      )}

      {/* Changes requested */}
      {changesRequested.length > 0 && (
        <Section
          title="Änderungen erforderlich"
          icon={XCircle}
          colorClass="text-red-600"
          bgClass="bg-red-50"
          borderClass="border-red-100"
        >
          {changesRequested.map((s) => (
            <QueueRow
              key={s.id}
              section={s}
              statusConfig={statusConfig}
              approvalStatusLabels={approvalStatusLabels}
              actionPending={actionPending}
              showRequestReview
              onRequestReview={() => handleRequestReview(s.id)}
            />
          ))}
        </Section>
      )}

      {/* Drafts */}
      {drafts.length > 0 && (
        <Section
          title="Entwürfe (noch nicht eingereicht)"
          icon={FileEdit}
          colorClass="text-amber-600"
          bgClass="bg-amber-50"
          borderClass="border-amber-100"
        >
          {drafts.map((s) => (
            <QueueRow
              key={s.id}
              section={s}
              statusConfig={statusConfig}
              approvalStatusLabels={approvalStatusLabels}
              actionPending={actionPending}
              showRequestReview
              onRequestReview={() => handleRequestReview(s.id)}
            />
          ))}
        </Section>
      )}

      {/* Empty state */}
      {isQueueEmpty && !loading && (
        <SectionCard>
          <EmptyState
            icon={<CheckCircle2 className="h-10 w-10 text-emerald-500" />}
            heading="Queue leer"
            description="Alle Sektionen sind freigegeben oder benötigen keine Freigabe. Gut gemacht!"
          />
        </SectionCard>
      )}

      {/* Recently approved */}
      {recentlyApproved.length > 0 && (
        <div className="mt-6">
          <Section
            title="Zuletzt freigegeben"
            icon={CheckCircle2}
            colorClass="text-emerald-600"
            bgClass="bg-emerald-50"
            borderClass="border-emerald-100"
          >
            {recentlyApproved.map((s) => (
              <QueueRow
                key={s.id}
                section={s}
                statusConfig={statusConfig}
                approvalStatusLabels={approvalStatusLabels}
                actionPending={actionPending}
              />
            ))}
          </Section>
        </div>
      )}

      {/* Link to Homepage Builder */}
      <div className="mt-6 text-center">
        <Link href={CMS_ROUTES.homepage} className="fca-button-secondary text-xs">
          <ExternalLink className="h-3.5 w-3.5" />
          Im Homepage Builder öffnen
        </Link>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  icon: Icon,
  colorClass,
  bgClass,
  borderClass,
  children,
}: {
  title: string;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`mb-4 rounded-xl border ${borderClass} overflow-hidden`}>
      <div className={`flex items-center gap-2 px-4 py-2.5 ${bgClass}`}>
        <Icon className={`h-4 w-4 ${colorClass}`} />
        <p className={`text-xs font-semibold ${colorClass}`}>{title}</p>
      </div>
      <div className="divide-y divide-[var(--border)] bg-[var(--surface)]">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QueueRow
// ---------------------------------------------------------------------------

function QueueRow({
  section,
  statusConfig,
  approvalStatusLabels,
  actionPending,
  showApprove,
  showReject,
  showRequestReview,
  onApprove,
  onReject,
  onRequestReview,
}: {
  section: HomepageSectionAdminItem;
  statusConfig: StatusConfig;
  approvalStatusLabels: Record<ApprovalStatus, string>;
  actionPending: string | null;
  showApprove?: boolean;
  showReject?: boolean;
  showRequestReview?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onRequestReview?: () => void;
}) {
  const isPending =
    actionPending === `${section.id}-approve` ||
    actionPending === `${section.id}-reject` ||
    actionPending === `${section.id}-request-review`;

  const approvalStatus = section.approvalStatus as ApprovalStatus;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      {/* Section info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-sm text-[var(--foreground)] truncate">
            {section.label}
          </p>
          <ApprovalBadge
            status={approvalStatus}
            statusConfig={statusConfig}
            labels={approvalStatusLabels}
          />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[11px] text-[var(--muted)]">Typ: {section.type}</span>
          {section.reviewRequestedAt && (
            <span className="text-[11px] text-[var(--muted)]">
              Eingereicht:{" "}
              {new Date(section.reviewRequestedAt).toLocaleString("de-CH")}
            </span>
          )}
          {section.reviewedAt && section.approvalStatus !== "IN_REVIEW" && (
            <span className="text-[11px] text-[var(--muted)]">
              Geprüft:{" "}
              {new Date(section.reviewedAt).toLocaleString("de-CH")}
            </span>
          )}
          {section.approvalNote && (
            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-2)]">
              <MessageSquare className="h-3 w-3" />
              {section.approvalNote.length > 80
                ? `${section.approvalNote.slice(0, 80)}…`
                : section.approvalNote}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {showApprove && onApprove && (
          <button
            type="button"
            onClick={onApprove}
            disabled={isPending}
            className="fca-button-primary py-1 text-xs"
            title="Freigeben"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Freigeben
          </button>
        )}
        {showReject && onReject && (
          <button
            type="button"
            onClick={onReject}
            disabled={isPending}
            className="fca-button-secondary py-1 text-xs text-red-600 border-red-200 hover:bg-red-50"
            title="Ablehnen / Änderungen anfordern"
          >
            <XCircle className="h-3.5 w-3.5" />
            Ablehnen
          </button>
        )}
        {showRequestReview && onRequestReview && (
          <button
            type="button"
            onClick={onRequestReview}
            disabled={isPending}
            className="fca-button-secondary py-1 text-xs"
            title="Erneut zur Überprüfung einreichen"
          >
            <UserCheck className="h-3.5 w-3.5" />
            Einreichen
          </button>
        )}
        <Link
          href={CMS_ROUTES.homepage}
          className="fca-button-secondary py-1 text-xs"
          title="Im Homepage Builder öffnen"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
