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
  const confirmed = confirm(`Meeting "${meetingTitle}" wirklich löschen?`);
  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch("/api/vereinsleitung/meetings/" + meetingId, {
      method: "DELETE",
    });

    const raw = await response.text();
    const payload = raw ? JSON.parse(raw) : null;

    if (!response.ok) {
      throw new Error(
        payload && typeof payload.error === "string"
          ? payload.error
          : "Meeting konnte nicht gelöscht werden.",
      );
    }

    router.refresh();
  } catch (error) {
    alert(error instanceof Error ? error.message : "Löschen fehlgeschlagen.");
  }
}

  if (meetings.length === 0) {
    return (
      <section className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />
        <div className="p-10 text-center">
          <h3 className="text-lg font-semibold text-slate-900">
            Noch keine Meetings vorhanden
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Sobald Meetings erfasst werden, erscheinen sie hier automatisch inklusive verknüpfter Pendenzen.
          </p>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {meetings.map((meeting) => (
        <section
          key={meeting.id}
          className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-[2px] hover:shadow-[0_24px_52px_rgba(15,23,42,0.09)]"
        >
          <div className="h-1.5 w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />

          <div className="p-6 md:p-7">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-[1.45rem] font-semibold tracking-tight text-slate-900">
                    {meeting.title}
                  </h3>

                  <span
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${getStatusClass(
                      meeting.status,
                    )}`}
                  >
                    {meeting.statusLabel ?? meeting.status}
                  </span>

                  <span
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${getApprovalStatusClass(
                      meeting.approvalStatus,
                    )}`}
                  >
                    Freigabe: {meeting.approvalStatusLabel}
                  </span>

                  {meeting.isApprovalLocked ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
                      <Lock className="h-3.5 w-3.5" />
                      Freigabe-Sperre aktiv
                    </span>
                  ) : null}
                </div>

                {meeting.subtitle ? (
                  <p className="mt-3 max-w-3xl text-[15px] leading-7 text-slate-600">
                    {meeting.subtitle}
                  </p>
                ) : null}

                <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-slate-400" />
                    {meeting.dateLabel} · {meeting.timeLabel}
                  </span>

                  {meeting.location ? (
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      {meeting.location}
                    </span>
                  ) : null}

                  <span className="inline-flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-slate-400" />
                    {meeting.linkedMatterCount} verknüpfte Pendenzen
                  </span>

                  <span className="inline-flex items-center gap-2">
                    <CircleCheckBig className="h-4 w-4 text-slate-400" />
                    {meeting.openMatterCount} offen / in Arbeit
                  </span>

                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-slate-400" />
                    {meeting.approvalStatusLabel}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                <Link
                  href={`/vereinsleitung/meetings/${meeting.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <ExternalLink className="h-4 w-4" />
                  Öffnen
                </Link>

                <Link
                  href={`/vereinsleitung/meetings/${meeting.slug}/edit`}
                  className="inline-flex items-center gap-2 rounded-full border border-[#0b4aa2]/20 bg-[#0b4aa2]/5 px-4 py-2.5 text-sm font-semibold text-[#0b4aa2] transition hover:bg-[#0b4aa2]/10"
                >
                  <FilePenLine className="h-4 w-4" />
                  Bearbeiten
                </Link>

                <button
                  type="button"
                  onClick={() => handleDelete(meeting.id, meeting.title)}
                  className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  <Trash2 className="h-4 w-4" />
                  Löschen
                </button>
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}