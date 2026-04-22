"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  FileText,
  Loader2,
  Lock,
  PlayCircle,
  Send,
  ShieldCheck,
  Undo2,
  UserRound,
  XCircle,
} from "lucide-react";
import {
  getMeetingApprovalStatusOptions,
  getMeetingStatusOptions,
} from "@/lib/vereinsleitung/meeting-utils";

type VereinsleitungMeetingInfoCardProps = {
  meetingId: string;
  title: string;
  dateLabel: string;
  timeLabel: string;
  location: string | null;
  onlineMeetingUrl: string | null;
  meetingModeLabel: string;
  meetingProviderLabel: string;
  teamsSyncStatusLabel: string;
  externalMeetingUrl: string | null;
  teamsJoinUrl: string | null;
  status: string;
  statusLabel: string;
  approvalStatus: string;
  approvalStatusLabel: string;
  approvalNotes: string | null;
  approvalSubmittedAtLabel: string | null;
  approvedAtLabel: string | null;
  rejectedAtLabel: string | null;
  approvalRequestedByUserId: string | null;
  approvedByUserId: string | null;
  rejectedByUserId: string | null;
  approvalLockReasonLabel: string | null;
  isApprovalLocked: boolean;
  isDone: boolean;
  canManageMeetings: boolean;
  canReviewMeetings: boolean;
  canApproveMeetings: boolean;
};

function getTeamsStatusClass(label: string) {
  switch (label) {
    case "Erstellt":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Ausstehend":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Fehlgeschlagen":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "Manuell":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getMeetingUrl(
  externalMeetingUrl: string | null,
  teamsJoinUrl: string | null,
  onlineMeetingUrl: string | null,
) {
  return teamsJoinUrl ?? externalMeetingUrl ?? onlineMeetingUrl ?? null;
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "DONE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "IN_PROGRESS":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "DONE":
      return CheckCircle2;
    case "IN_PROGRESS":
      return PlayCircle;
    default:
      return CalendarClock;
  }
}

function getApprovalBadgeClass(status: string) {
  switch (status) {
    case "APPROVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "SUBMITTED":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "REJECTED":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function getApprovalIcon(status: string) {
  switch (status) {
    case "APPROVED":
      return ShieldCheck;
    case "SUBMITTED":
      return Send;
    case "REJECTED":
      return XCircle;
    default:
      return CalendarClock;
  }
}

function getApprovalNoteLabel(status: string) {
  return status === "REJECTED" ? "Ablehnungsgrund" : "Freigabehinweis";
}

function getUserIdLabel(userId: string | null) {
  if (!userId) {
    return "â€”";
  }

  return userId;
}

export default function VereinsleitungMeetingInfoCard({
  meetingId,
  title,
  dateLabel,
  timeLabel,
  location,
  onlineMeetingUrl,
  meetingModeLabel,
  meetingProviderLabel,
  teamsSyncStatusLabel,
  externalMeetingUrl,
  teamsJoinUrl,
  status,
  statusLabel,
  approvalStatus,
  approvalStatusLabel,
  approvalNotes,
  approvalSubmittedAtLabel,
  approvedAtLabel,
  rejectedAtLabel,
  approvalRequestedByUserId,
  approvedByUserId,
  rejectedByUserId,
  approvalLockReasonLabel,
  isApprovalLocked,
  isDone,
  canManageMeetings,
  canReviewMeetings,
  canApproveMeetings,
}: VereinsleitungMeetingInfoCardProps) {
  const router = useRouter();
  const meetingUrl = getMeetingUrl(externalMeetingUrl, teamsJoinUrl, onlineMeetingUrl);
  const statusOptions = getMeetingStatusOptions();
  const approvalStatusOptions = getMeetingApprovalStatusOptions();
  const StatusIcon = getStatusIcon(status);
  const ApprovalIcon = getApprovalIcon(approvalStatus);

  const [selectedStatus, setSelectedStatus] = useState(status);
  const [selectedApprovalStatus, setSelectedApprovalStatus] = useState(approvalStatus);
  const [approvalNotesInput, setApprovalNotesInput] = useState("");
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  async function patchMeeting(payload: Record<string, string>) {
    const response = await fetch("/api/vereinsleitung/meetings/" + meetingId, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "Meeting konnte nicht aktualisiert werden.");
    }

    router.refresh();
  }

  async function saveStatus() {
    if (!canManageMeetings) {
      setStatusError("Du hast keine Berechtigung, den Meeting-Status zu Ã¤ndern.");
      return;
    }

    try {
      setIsSubmittingStatus(true);
      setStatusError(null);
      await patchMeeting({
        status: selectedStatus,
      });
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Technischer Fehler beim Statuswechsel.");
    } finally {
      setIsSubmittingStatus(false);
    }
  }

  async function saveApprovalStatus() {
    if (!canApproveMeetings) {
      setApprovalError("Du hast keine Berechtigung, den Freigabestatus manuell zu Ã¤ndern.");
      return;
    }

    if (selectedApprovalStatus === "REJECTED" && !approvalNotesInput.trim()) {
      setApprovalError("FÃ¼r eine Ablehnung ist ein Ablehnungsgrund erforderlich.");
      return;
    }

    try {
      setIsSubmittingApproval(true);
      setApprovalError(null);
      await patchMeeting({
        approvalStatus: selectedApprovalStatus,
        approvalNotes: approvalNotesInput.trim(),
      });
      setApprovalNotesInput("");
    } catch (err) {
      setApprovalError(
        err instanceof Error ? err.message : "Technischer Fehler beim Freigabestatus.",
      );
    } finally {
      setIsSubmittingApproval(false);
    }
  }

  async function runQuickApprovalAction(
    nextApprovalStatus: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED",
  ) {
    const requiresApprovePermission =
      nextApprovalStatus === "APPROVED" || nextApprovalStatus === "DRAFT";
    const hasRequiredPermission = requiresApprovePermission
      ? canApproveMeetings
      : canReviewMeetings;

    if (!hasRequiredPermission) {
      setApprovalError("Du hast keine Berechtigung fÃ¼r diese Freigabeaktion.");
      return;
    }

    if (nextApprovalStatus === "REJECTED" && !approvalNotesInput.trim()) {
      setApprovalError("FÃ¼r eine Ablehnung ist ein Ablehnungsgrund erforderlich.");
      return;
    }

    try {
      setIsSubmittingApproval(true);
      setApprovalError(null);
      setSelectedApprovalStatus(nextApprovalStatus);
      await patchMeeting({
        approvalStatus: nextApprovalStatus,
        approvalNotes: approvalNotesInput.trim(),
      });
      setApprovalNotesInput("");
    } catch (err) {
      setApprovalError(
        err instanceof Error ? err.message : "Technischer Fehler bei der Freigabeaktion.",
      );
    } finally {
      setIsSubmittingApproval(false);
    }
  }

  const canSubmit = canReviewMeetings && (approvalStatus === "DRAFT" || approvalStatus === "REJECTED");
  const canApprove = canApproveMeetings && approvalStatus === "SUBMITTED";
  const canReject = canReviewMeetings && approvalStatus === "SUBMITTED";
  const canReopen =
    canApproveMeetings &&
    (approvalStatus === "APPROVED" || approvalStatus === "REJECTED");
  const canManuallyEditApproval = canApproveMeetings;
  const hasAnyApprovalPermission = canReviewMeetings || canApproveMeetings;

  return (
    <section className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
      <div className="h-1.5 w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
              Meeting
            </p>
            <h3 className="mt-2 text-[1.2rem] font-semibold text-slate-900">{title}</h3>
          </div>

          <span
            className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${getTeamsStatusClass(
              teamsSyncStatusLabel,
            )}`}
          >
            Teams: {teamsSyncStatusLabel}
          </span>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-center gap-2">
              <StatusIcon className="h-4.5 w-4.5 text-[#0b4aa2]" />
              <h4 className="text-sm font-semibold text-slate-900">Meeting-Status</h4>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${getStatusBadgeClass(status)}`}>
                {statusLabel}
              </span>

              {canManageMeetings ? (
                <>
                  <select
                    value={selectedStatus}
                    onChange={(event) => setSelectedStatus(event.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={saveStatus}
                    disabled={isSubmittingStatus || selectedStatus === status}
                    className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#083a80] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmittingStatus ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Status speichern
                  </button>
                </>
              ) : (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500">
                  Keine Status-Bearbeitung
                </span>
              )}
            </div>

            {statusError ? (
              <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {statusError}
              </div>
            ) : null}
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-center gap-2">
              <ApprovalIcon className="h-4.5 w-4.5 text-[#0b4aa2]" />
              <h4 className="text-sm font-semibold text-slate-900">Freigabestatus</h4>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${getApprovalBadgeClass(approvalStatus)}`}>
                {approvalStatusLabel}
              </span>

              {isApprovalLocked ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  <Lock className="h-3.5 w-3.5" />
                  Freigabe-Sperre aktiv
                </span>
              ) : null}

              {isDone ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Meeting abgeschlossen
                </span>
              ) : null}

              {canManuallyEditApproval ? (
                <>
                  <select
                    value={selectedApprovalStatus}
                    onChange={(event) => setSelectedApprovalStatus(event.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                  >
                    {approvalStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={saveApprovalStatus}
                    disabled={isSubmittingApproval || selectedApprovalStatus === approvalStatus}
                    className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#083a80] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmittingApproval ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                    Freigabe speichern
                  </button>
                </>
              ) : null}
            </div>

            {approvalLockReasonLabel ? (
              <div className="mt-4 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                {approvalLockReasonLabel}
              </div>
            ) : null}

            <div className="mt-4 rounded-[20px] border border-slate-200 bg-white p-4">
              <label className="block text-sm font-semibold text-slate-900">
                Freigabehinweis / Ablehnungsgrund
              </label>
              <textarea
                value={approvalNotesInput}
                onChange={(event) => setApprovalNotesInput(event.target.value)}
                rows={3}
                placeholder="Optional bei Freigabe, erforderlich bei Ablehnung."
                className="mt-3 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
              />
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Dieser Hinweis wird mit dem separaten Freigabeschritt gespeichert.
              </p>
            </div>

            {hasAnyApprovalPermission ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {canReviewMeetings ? (
                  <button
                    type="button"
                    onClick={() => runQuickApprovalAction("SUBMITTED")}
                    disabled={isSubmittingApproval || !canSubmit}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {isSubmittingApproval && selectedApprovalStatus === "SUBMITTED" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Zur PrÃ¼fung
                  </button>
                ) : null}

                {canApproveMeetings ? (
                  <button
                    type="button"
                    onClick={() => runQuickApprovalAction("APPROVED")}
                    disabled={isSubmittingApproval || !canApprove}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {isSubmittingApproval && selectedApprovalStatus === "APPROVED" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                    Freigeben
                  </button>
                ) : null}

                {canReviewMeetings ? (
                  <button
                    type="button"
                    onClick={() => runQuickApprovalAction("REJECTED")}
                    disabled={isSubmittingApproval || !canReject}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {isSubmittingApproval && selectedApprovalStatus === "REJECTED" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    Ablehnen
                  </button>
                ) : null}

                {canApproveMeetings ? (
                  <button
                    type="button"
                    onClick={() => runQuickApprovalAction("DRAFT")}
                    disabled={isSubmittingApproval || !canReopen}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {isSubmittingApproval && selectedApprovalStatus === "DRAFT" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Undo2 className="h-4 w-4" />
                    )}
                    Zu Entwurf
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                Keine Freigabeaktionen verfÃ¼gbar.
              </div>
            )}

            <p className="mt-4 text-sm leading-6 text-slate-600">
              Freigabeaktionen werden strikt nach Berechtigung angezeigt. Ablehnungen verlangen einen Grund, Freigaben kÃ¶nnen optional dokumentiert werden.
            </p>

            {approvalError ? (
              <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {approvalError}
              </div>
            ) : null}
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4.5 w-4.5 text-[#0b4aa2]" />
              <h4 className="text-sm font-semibold text-slate-900">Meeting-Kontext</h4>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Datum</div>
                <div className="mt-1 font-medium text-slate-800">{dateLabel}</div>
              </div>

              <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Zeit</div>
                <div className="mt-1 font-medium text-slate-800">{timeLabel}</div>
              </div>

              <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Meeting-Typ</div>
                <div className="mt-1 font-medium text-slate-800">{meetingModeLabel}</div>
              </div>

              <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Provider</div>
                <div className="mt-1 font-medium text-slate-800">{meetingProviderLabel}</div>
              </div>

              {location ? (
                <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Ort</div>
                  <div className="mt-1 font-medium text-slate-800">{location}</div>
                </div>
              ) : null}

              {meetingUrl ? (
                <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Meeting-Link</div>
                  <a
                    href={meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block break-all font-medium text-[#0b4aa2] hover:underline"
                  >
                    {meetingUrl}
                  </a>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4.5 w-4.5 text-[#0b4aa2]" />
              <h4 className="text-sm font-semibold text-slate-900">Freigabe-Metadaten</h4>
            </div>

            <div className="mt-4 grid gap-3 text-sm text-slate-700">
              <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                <div className="font-medium text-slate-900">Zur PrÃ¼fung gesendet am</div>
                <div className="mt-1">{approvalSubmittedAtLabel ?? "â€”"}</div>
              </div>

              <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                <div className="font-medium text-slate-900">Freigegeben am</div>
                <div className="mt-1">{approvedAtLabel ?? "â€”"}</div>
              </div>

              <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                <div className="font-medium text-slate-900">Abgelehnt am</div>
                <div className="mt-1">{rejectedAtLabel ?? "â€”"}</div>
              </div>

              <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                <div className="font-medium text-slate-900">Angefordert von</div>
                <div className="mt-1 inline-flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-slate-400" />
                  {getUserIdLabel(approvalRequestedByUserId)}
                </div>
              </div>

              <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                <div className="font-medium text-slate-900">Freigegeben von</div>
                <div className="mt-1 inline-flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-slate-400" />
                  {getUserIdLabel(approvedByUserId)}
                </div>
              </div>

              <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                <div className="font-medium text-slate-900">Abgelehnt von</div>
                <div className="mt-1 inline-flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-slate-400" />
                  {getUserIdLabel(rejectedByUserId)}
                </div>
              </div>

              <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                <div className="font-medium text-slate-900">{getApprovalNoteLabel(approvalStatus)}</div>
                <div className="mt-1 inline-flex items-start gap-2">
                  <FileText className="mt-0.5 h-4 w-4 text-slate-400" />
                  <span>{approvalNotes ?? "â€”"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
