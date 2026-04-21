import Link from "next/link";
import { ArrowUpRight, CircleCheckBig, ClipboardList, ListChecks, Lock, ShieldCheck } from "lucide-react";
import { type MeetingMatterItem } from "@/lib/vereinsleitung/meeting-utils";

type VereinsleitungMeetingActionsCardProps = {
  title: string;
  linkedMatters: MeetingMatterItem[];
  meetingUrl: string | null;
  teamsSyncStatusLabel: string;
  isLocked?: boolean;
  approvalStatusLabel?: string;
  isApprovalLocked?: boolean;
};

export default function VereinsleitungMeetingActionsCard({
  title,
  linkedMatters,
  meetingUrl,
  teamsSyncStatusLabel,
  isLocked = false,
  approvalStatusLabel = "Entwurf",
  isApprovalLocked = false,
}: VereinsleitungMeetingActionsCardProps) {
  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2">
        <ListChecks className="h-4.5 w-4.5 text-[#0b4aa2]" />
        <h3 className="text-[1.08rem] font-semibold text-slate-900">{title}</h3>
      </div>

      {isLocked ? (
        <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm font-medium text-amber-800">
            Meeting-Arbeitsbereich ist gesperrt.
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-700">
            Entweder ist das Meeting abgeschlossen oder bereits freigegeben. Änderungen an Vorbereitung,
            Ausführung und Nachbearbeitung sollen künftig kontrolliert über Review- oder Reopen-Workflows laufen.
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-2 text-slate-900">
            <ClipboardList className="h-4 w-4 text-[#0b4aa2]" />
            <h4 className="text-sm font-semibold">Verknüpfte Pendenzen</h4>
          </div>
          <p className="mt-4 text-3xl font-semibold text-slate-900">{linkedMatters.length}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Alle direkt aus diesem Meeting referenzierten Pendenzen.
          </p>
        </article>

        <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-2 text-slate-900">
            <CircleCheckBig className="h-4 w-4 text-[#0b4aa2]" />
            <h4 className="text-sm font-semibold">Teams-Sync</h4>
          </div>
          <p className="mt-4 text-lg font-semibold text-slate-900">{teamsSyncStatusLabel}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Status der Teams-/Online-Meeting-Vorbereitung.
          </p>
        </article>

        <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-2 text-slate-900">
            <ShieldCheck className="h-4 w-4 text-[#0b4aa2]" />
            <h4 className="text-sm font-semibold">Freigabe</h4>
          </div>
          <p className="mt-4 text-lg font-semibold text-slate-900">{approvalStatusLabel}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {isApprovalLocked
              ? "Freigegeben – Approval-Lock aktiv."
              : "Approval-Workflow-Grundlage vorbereitet."}
          </p>
        </article>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-2 text-slate-900">
            <ArrowUpRight className="h-4 w-4 text-[#0b4aa2]" />
            <h4 className="text-sm font-semibold">Schnellzugriff</h4>
          </div>

          {meetingUrl ? (
            <a
              href={meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#083a80]"
            >
              Meeting öffnen
              <ArrowUpRight className="h-4 w-4" />
            </a>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Kein direkter Online-Meeting-Link vorhanden.
            </p>
          )}

          <div className="mt-4">
            <Link
              href="#participants"
              className="text-sm font-medium text-[#0b4aa2] hover:underline"
            >
              Zu Teilnehmern springen
            </Link>
          </div>
        </article>

        <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-2 text-slate-900">
            <Lock className="h-4 w-4 text-[#0b4aa2]" />
            <h4 className="text-sm font-semibold">Workflow-Hinweis</h4>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-500">
            Nächster Schritt: echte Submit-, Review- und Approve-Aktionen auf Basis dieses Freigabestatus und des Approval-Locks.
          </p>
        </article>
      </div>
    </section>
  );
}
