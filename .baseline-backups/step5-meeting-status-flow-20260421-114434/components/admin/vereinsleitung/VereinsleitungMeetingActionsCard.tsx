import Link from "next/link";
import { ArrowUpRight, CheckCircle2, CircleDashed, CircleOff, ListChecks } from "lucide-react";
import type { MeetingMatterItem } from "@/lib/vereinsleitung/meeting-utils";

type VereinsleitungMeetingActionsCardProps = {
  title: string;
  linkedMatters: MeetingMatterItem[];
  meetingUrl: string | null;
  teamsSyncStatusLabel: string;
};

function getStatusClass(statusLabel: string) {
  switch (statusLabel) {
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

function getMatterStatusClass(status: string) {
  switch (status) {
    case "DONE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "IN_PROGRESS":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default function VereinsleitungMeetingActionsCard({
  title,
  linkedMatters,
  meetingUrl,
  teamsSyncStatusLabel,
}: VereinsleitungMeetingActionsCardProps) {
  const openMatterCount = linkedMatters.filter((matter) => matter.status !== "DONE").length;

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
            Actions
          </p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mt-2 text-sm text-slate-500">
            Direkte Meeting-Aktionen und Ãœberblick Ã¼ber verknÃ¼pfte Pendenzen.
          </p>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${getStatusClass(
            teamsSyncStatusLabel,
          )}`}
        >
          Teams: {teamsSyncStatusLabel}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {meetingUrl ? (
          <a
            href={meetingUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0b4aa2] px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a]"
          >
            <ArrowUpRight className="h-4 w-4" />
            Meeting Ã¶ffnen
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex h-11 cursor-not-allowed items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-400"
          >
            <CircleOff className="h-4 w-4" />
            Kein Meeting-Link
          </button>
        )}

        <Link
          href="#participants"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:bg-slate-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          Teilnehmer ansehen
        </Link>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            VerknÃ¼pft
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {linkedMatters.length}
          </div>
          <div className="mt-1 text-sm text-slate-500">Pendenzen</div>
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Offen
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {openMatterCount}
          </div>
          <div className="mt-1 text-sm text-slate-500">offen / in Arbeit</div>
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Teams
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CircleDashed className="h-4 w-4" />
            {teamsSyncStatusLabel}
          </div>
          <div className="mt-1 text-sm text-slate-500">nur Anzeige, noch keine Live-Synchronisation</div>
        </div>
      </div>

      {linkedMatters.length > 0 ? (
        <div className="mt-5 space-y-3">
          {linkedMatters.map((matter) => (
            <div
              key={matter.linkId}
              className="flex flex-wrap items-start justify-between gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ListChecks className="h-4 w-4 text-slate-400" />
                  {matter.title}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {matter.ownerName ? <span>Verantwortlich: {matter.ownerName}</span> : null}
                  {matter.dueDateLabel ? <span>FÃ¤llig: {matter.dueDateLabel}</span> : null}
                  {matter.sourceMeetingTitle ? (
                    <span>Ãœbernommen aus: {matter.sourceMeetingTitle}</span>
                  ) : null}
                </div>
              </div>

              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getMatterStatusClass(
                  matter.status,
                )}`}
              >
                {matter.statusLabel}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-500">
          Aktuell sind keine Pendenzen mit diesem Meeting verknÃ¼pft.
        </div>
      )}
    </section>
  );
}
