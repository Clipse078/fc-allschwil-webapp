"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  MapPin,
  User,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type VeranstaltungCardEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date | string;
  endAt: Date | string | null;
  organizerName: string | null;
  remarks: string | null;
  status: string;
  reviewStage: string;
  source: string;
  websiteVisible: boolean;
  infoboardVisible: boolean;
  homepageVisible: boolean;
  wochenplanVisible: boolean;
  season: {
    id: string;
    key: string;
    name: string;
  } | null;
};

type VeranstaltungCardProps = {
  event: VeranstaltungCardEvent;
  canManage: boolean;
  /** events.delete authority — required for permanent deletion. */
  canDelete: boolean;
};

function formatDateTime(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("de-CH", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_BADGE: Record<string, string> = {
  SCHEDULED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  DRAFT: "border-amber-200 bg-amber-50 text-amber-700",
  LIVE: "border-blue-200 bg-blue-50 text-blue-700",
  COMPLETED: "border-slate-200 bg-slate-50 text-slate-600",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-700",
  POSTPONED: "border-orange-200 bg-orange-50 text-orange-700",
  ARCHIVED: "border-slate-200 bg-slate-100 text-slate-500",
};

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Geplant",
  DRAFT: "Entwurf",
  LIVE: "Live",
  COMPLETED: "Abgeschlossen",
  CANCELLED: "Abgesagt",
  POSTPONED: "Verschoben",
  ARCHIVED: "Archiviert",
};

const REVIEW_STAGE_LABEL: Record<string, string> = {
  DRAFT: "Entwurf",
  SUBMITTED: "Zur Prüfung",
  APPROVED: "Freigegeben",
  REJECTED: "Abgelehnt",
  PUBLISHED: "Veröffentlicht",
};

const REVIEW_STAGE_BADGE: Record<string, string> = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-500",
  SUBMITTED: "border-amber-200 bg-amber-50 text-amber-700",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
  PUBLISHED: "border-blue-200 bg-blue-50 text-blue-700",
};

function PublicationTargets({ event }: { event: VeranstaltungCardEvent }) {
  const targets: string[] = [];
  if (event.websiteVisible) targets.push("Website");
  if (event.infoboardVisible) targets.push("Infoboard");
  if (event.homepageVisible) targets.push("Homepage");
  if (event.wochenplanVisible) targets.push("Wochenplan");
  if (targets.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {targets.map((target) => (
        <span
          key={target}
          className="inline-flex h-5 items-center rounded-full border border-violet-200 bg-violet-50 px-2 text-[0.65rem] font-semibold text-violet-700"
        >
          {target}
        </span>
      ))}
    </div>
  );
}

export default function VeranstaltungCard({
  event,
  canManage,
  canDelete,
}: VeranstaltungCardProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [busy, setBusy] = useState<"archive" | "restore" | "delete" | null>(
    null,
  );

  const isArchived = event.status === "ARCHIVED";
  const statusBadge =
    STATUS_BADGE[event.status] ?? "border-slate-200 bg-slate-50 text-slate-500";
  const statusLabel = STATUS_LABEL[event.status] ?? event.status;
  const reviewBadge =
    REVIEW_STAGE_BADGE[event.reviewStage] ??
    "border-slate-200 bg-slate-50 text-slate-500";
  const reviewLabel =
    REVIEW_STAGE_LABEL[event.reviewStage] ?? event.reviewStage;

  async function handleArchive() {
    if (busy) return;
    setBusy("archive");
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        toast.danger(data?.error ?? "Archivierung fehlgeschlagen.");
        return;
      }
      toast.success("Veranstaltung wurde archiviert.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function handleRestore() {
    if (busy) return;
    setBusy("restore");
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        toast.danger(data?.error ?? "Wiederherstellen fehlgeschlagen.");
        return;
      }
      toast.success("Veranstaltung wurde wiederhergestellt.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (busy) return;
    if (
      !window.confirm(
        `Veranstaltung „${event.title}" dauerhaft löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
      )
    ) {
      return;
    }
    setBusy("delete");
    try {
      const res = await fetch(`/api/events/${event.id}?permanent=true`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        toast.danger(data?.error ?? "Löschen fehlgeschlagen.");
        return;
      }
      toast.success("Veranstaltung wurde dauerhaft gelöscht.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className={`sce-detail-section ${isArchived ? "opacity-60" : ""}`}
    >
      {/* Header */}
      <div className="sce-detail-section-header">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-[var(--foreground)]">
            {event.title}
          </span>

          {event.season && (
            <span className="inline-flex h-5 items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 text-[0.65rem] font-semibold text-[var(--muted)]">
              {event.season.name}
            </span>
          )}

          <span
            className={`inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold ${statusBadge}`}
          >
            {statusLabel}
          </span>

          <span
            className={`inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold ${reviewBadge}`}
          >
            {reviewLabel}
          </span>
        </div>

        {canManage && (
          <div className="flex shrink-0 items-center gap-2">
            {!isArchived && (
              <Link
                href={`/dashboard/veranstaltungen/${event.id}/edit`}
                className="fca-button-secondary inline-flex items-center gap-1.5 py-1 text-xs"
              >
                <Pencil className="h-3.5 w-3.5" />
                Bearbeiten
              </Link>
            )}

            {!isArchived && (
              <button
                type="button"
                onClick={handleArchive}
                disabled={busy !== null}
                className="fca-button-secondary inline-flex items-center gap-1.5 py-1 text-xs"
                title="Archivieren"
              >
                <Archive className="h-3.5 w-3.5" />
                {busy === "archive" ? "..." : "Archivieren"}
              </button>
            )}

            {isArchived && (
              <button
                type="button"
                onClick={handleRestore}
                disabled={busy !== null}
                className="fca-button-secondary inline-flex items-center gap-1.5 py-1 text-xs"
                title="Wiederherstellen"
              >
                <ArchiveRestore className="h-3.5 w-3.5" />
                {busy === "restore" ? "..." : "Wiederherstellen"}
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                title="Endgültig löschen"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {busy === "delete" ? "..." : "Endgültig löschen"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="sce-detail-section-body">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="sce-data-field">
            <p className="sce-data-label">Start</p>
            <p className="sce-data-value mt-1 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-violet-600" />
              {formatDateTime(event.startAt)}
            </p>
          </div>

          {event.endAt ? (
            <div className="sce-data-field">
              <p className="sce-data-label">Ende</p>
              <p className="sce-data-value mt-1 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-violet-600" />
                {formatDateTime(event.endAt)}
              </p>
            </div>
          ) : null}

          {event.location ? (
            <div className="sce-data-field">
              <p className="sce-data-label">Ort</p>
              <p className="sce-data-value mt-1 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-violet-600" />
                {event.location}
              </p>
            </div>
          ) : null}

          {event.organizerName ? (
            <div className="sce-data-field">
              <p className="sce-data-label">Organisator</p>
              <p className="sce-data-value mt-1 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 shrink-0 text-violet-600" />
                {event.organizerName}
              </p>
            </div>
          ) : null}
        </div>

        {event.description ? (
          <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
            {event.description}
          </p>
        ) : null}

        {event.remarks ? (
          <p className="mt-2 text-xs italic text-[var(--muted)]">
            {event.remarks}
          </p>
        ) : null}

        <div className="mt-4">
          <PublicationTargets event={event} />
        </div>
      </div>
    </div>
  );
}
