"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlayCircle, CheckCircle2, CalendarClock, Loader2 } from "lucide-react";
import { getMeetingStatusOptions } from "@/lib/vereinsleitung/meeting-utils";

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

function getMeetingUrl(externalMeetingUrl: string | null, teamsJoinUrl: string | null, onlineMeetingUrl: string | null) {
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
}: VereinsleitungMeetingInfoCardProps) {
  const router = useRouter();
  const meetingUrl = getMeetingUrl(externalMeetingUrl, teamsJoinUrl, onlineMeetingUrl);
  const statusOptions = getMeetingStatusOptions();
  const StatusIcon = getStatusIcon(status);
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveStatus() {
    try {
      setIsSubmitting(true);
      setError(null);

      const response = await fetch("/api/vereinsleitung/meetings/" + meetingId, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: selectedStatus,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Status konnte nicht aktualisiert werden.");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Technischer Fehler beim Statuswechsel.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
            Meeting
          </p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{title}</h3>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${getTeamsStatusClass(
            teamsSyncStatusLabel,
          )}`}
        >
          Teams: {teamsSyncStatusLabel}
        </span>
      </div>

      <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2">
          <StatusIcon className="h-4.5 w-4.5 text-[#0b4aa2]" />
          <h4 className="text-sm font-semibold text-slate-900">Meeting-Status</h4>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(status)}`}>
            {statusLabel}
          </span>

          <select
            value={selectedStatus}
            onChange={(event) => setSelectedStatus(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
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
            disabled={isSubmitting || selectedStatus === status}
            className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#083a80] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Status speichern
          </button>
        </div>

        {error ? (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
      </div>

      <div className="mt-5 space-y-3 text-sm text-slate-600">
        <div className="flex items-start gap-3">
          <CalendarClock className="mt-0.5 h-4 w-4 text-slate-400" />
          <div>
            <div className="font-medium text-slate-900">{dateLabel}</div>
            <div>{timeLabel}</div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <PlayCircle className="mt-0.5 h-4 w-4 text-slate-400" />
          <div>
            <div className="font-medium text-slate-900">Meeting-Typ</div>
            <div>{meetingModeLabel}</div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 text-slate-400" />
          <div>
            <div className="font-medium text-slate-900">Provider</div>
            <div>{meetingProviderLabel}</div>
          </div>
        </div>

        {location ? (
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 h-4 w-4 text-slate-400" />
            <div>
              <div className="font-medium text-slate-900">Ort</div>
              <div>{location}</div>
            </div>
          </div>
        ) : null}

        {meetingUrl ? (
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 h-4 w-4 text-slate-400" />
            <div className="min-w-0">
              <div className="font-medium text-slate-900">Meeting-Link</div>
              <a
                href={meetingUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all text-[#0b4aa2] hover:underline"
              >
                {meetingUrl}
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
