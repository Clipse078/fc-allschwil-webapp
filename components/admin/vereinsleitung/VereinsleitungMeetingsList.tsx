"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CircleCheckBig,
  ExternalLink,
  FilePenLine,
  ListChecks,
  Lock,
  MapPin,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { MeetingListItem } from "@/lib/vereinsleitung/meeting-utils";

type VereinsleitungMeetingsListProps = {
  meetings: MeetingListItem[];
};

function getStatusClass(status: string) {
  switch (status) {
    case "DONE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "IN_PROGRESS":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getApprovalStatusClass(status: string) {
  switch (status) {
    case "APPROVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "SUBMITTED":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "REJECTED":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default function VereinsleitungMeetingsList({
  meetings,
}: VereinsleitungMeetingsListProps) {
  const router = useRouter();

  async function handleDelete(meetingId: string, meetingTitle: string) {
    const confirmed = confirm('Meeting "' + meetingTitle + '" wirklich loeschen?');
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch("/api/vereinsleitung/meetings/" + meetingId, {
        method: "DELETE",
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Meeting konnte nicht geloescht werden.");
      }

      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Loeschen fehlgeschlagen.");
    }
  }

  if (meetings.length === 0) {
    return (
      <section className="rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <h3 className="text-base font-semibold text-slate-900">
          Noch keine Meetings vorhanden
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          Sobald Meetings erfasst werden, erscheinen sie hier automatisch inklusive
          verknuepfter Pendenzen.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {meetings.map((meeting) => (
        <section
          key={meeting.id}
          className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-[1px] hover:shadow-[0_16px_34px_rgba(15,23,42,0.06)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-[1.05rem] font-semibold text-slate-900">
                  {meeting.title}
                </h3>

                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusClass(
                    meeting.status,
                  )}`}
                >
                  {meeting.statusLabel ?? meeting.status}
                </span>

                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getApprovalStatusClass(
                    meeting.approvalStatus,
                  )}`}
                >
                  Freigabe: {meeting.approvalStatusLabel}
                </span>

                {meeting.isApprovalLocked ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    <Lock className="h-3.5 w-3.5" />
                    Approval-Lock aktiv
                  </span>
                ) : null}
              </div>

              {meeting.subtitle ? (
                <p className="mt-2 text-sm text-slate-600">{meeting.subtitle}</p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  {meeting.dateLabel} • {meeting.timeLabel}
                </span>

                {meeting.location ? (
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {meeting.location}
                  </span>
                ) : null}

                <span className="inline-flex items-center gap-2">
                  <ListChecks className="h-4 w-4" />
                  {meeting.linkedMatterCount} verknuepfte Pendenzen
                </span>

                <span className="inline-flex items-center gap-2">
                  <CircleCheckBig className="h-4 w-4" />
                  {meeting.openMatterCount} offen / in Arbeit
                </span>

                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  {meeting.approvalStatusLabel}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link
                href={`/vereinsleitung/meetings/${meeting.slug}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Oeffnen
              </Link>

              <Link
                href={`/vereinsleitung/meetings/${meeting.slug}/edit`}
                className="inline-flex items-center gap-2 rounded-full border border-[#0b4aa2]/20 bg-[#0b4aa2]/5 px-3 py-2 text-xs font-semibold text-[#0b4aa2] transition hover:bg-[#0b4aa2]/10"
              >
                <FilePenLine className="h-3.5 w-3.5" />
                Bearbeiten
              </Link>

              <button
                type="button"
                onClick={() => handleDelete(meeting.id, meeting.title)}
                className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Loeschen
              </button>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}