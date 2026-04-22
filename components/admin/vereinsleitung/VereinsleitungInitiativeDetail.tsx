"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilePenLine, Trash2 } from "lucide-react";
import InitiativeInlineEditor from "@/components/admin/vereinsleitung/InitiativeInlineEditor";
import VereinsleitungInitiativeRoadmap from "@/components/admin/vereinsleitung/VereinsleitungInitiativeRoadmap";
import VereinsleitungInitiativeWorkItemsCard from "@/components/admin/vereinsleitung/VereinsleitungInitiativeWorkItemsCard";
import type { PeoplePickerPerson } from "@/components/admin/shared/people-picker/PeoplePicker";

export type InitiativeDetailWorkItem = {
  id: string;
  title: string;
  priority: string;
  storyPoints: number | null;
  assigneeMode: string;
  assigneePersonId: string | null;
  externalAssigneeLabel: string | null;
  assigneeName: string;
  status: string;
  sortOrder: number;
};

type InitiativeDetailData = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  status: string;
  startDateIso: string | null;
  targetDateIso: string | null;
  ownerRoleLabel: string | null;
  ownerName: string;
  ownerPerson: PeoplePickerPerson | null;
};

type VereinsleitungInitiativeDetailProps = {
  initiative: InitiativeDetailData;
  workItems: InitiativeDetailWorkItem[];
};

function formatDateLabel(value: string | null) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function getInitiativeStatusLabel(status: string) {
  switch (status) {
    case "DONE":
      return "Abgeschlossen";
    case "PLANNED":
      return "Geplant";
    default:
      return "In Arbeit";
  }
}

function getInitiativeStatusClass(status: string) {
  switch (status) {
    case "DONE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "PLANNED":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-blue-200 bg-blue-50 text-blue-700";
  }
}

export default function VereinsleitungInitiativeDetail({
  initiative,
  workItems,
}: VereinsleitungInitiativeDetailProps) {
  const router = useRouter();

  const totalWorkItems = workItems.length;
  const resolvedWorkItems = workItems.filter((item) => item.status === "RESOLVED").length;
  const progressPercent =
    totalWorkItems > 0 ? Math.round((resolvedWorkItems / totalWorkItems) * 100) : 0;

  async function handleDelete() {
    const confirmed = confirm('Initiative "' + initiative.title + '" wirklich loeschen?');
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch("/api/vereinsleitung/initiatives/" + initiative.id, {
        method: "DELETE",
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Initiative konnte nicht geloescht werden.");
      }

      router.push("/vereinsleitung/initiativen");
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Loeschen fehlgeschlagen.");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/vereinsleitung/initiativen"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Zur Uebersicht
          </Link>

          <Link
            href={"/vereinsleitung/initiativen/" + initiative.slug + "/edit"}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#0b4aa2]/20 bg-[#0b4aa2]/5 px-4 py-2 text-sm font-semibold text-[#0b4aa2] transition hover:bg-[#0b4aa2]/10"
          >
            <FilePenLine className="h-4 w-4" />
            Bearbeiten
          </Link>

          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
          >
            <Trash2 className="h-4 w-4" />
            Loeschen
          </button>
        </div>

        <form action="/api/vereinsleitung/initiativen" method="POST">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 hover:text-red-700"
          >
            Neue Initiative
          </button>
        </form>
      </div>

      <InitiativeInlineEditor
        initiative={{
          id: initiative.id,
          title: initiative.title,
          subtitle: initiative.subtitle,
          description: initiative.description,
          status: initiative.status as never,
          startDate: initiative.startDateIso,
          targetDate: initiative.targetDateIso,
          ownerRoleLabel: initiative.ownerRoleLabel,
          ownerPerson: initiative.ownerPerson,
        }}
      />

      <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.75fr)]">
          <div>
            <h3 className="text-[1.45rem] font-semibold text-slate-900">
              Projektbeschreibung
            </h3>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-700">
              {initiative.description ?? "Keine Beschreibung hinterlegt."}
            </p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Status</div>

            <div className="mt-3">
              <span
                className={
                  "rounded-full border px-3 py-1.5 text-xs font-semibold " +
                  getInitiativeStatusClass(initiative.status)
                }
              >
                {getInitiativeStatusLabel(initiative.status)}
              </span>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-sm font-semibold text-[#0b4aa2]">
                {initiative.ownerName
                  .split(" ")
                  .slice(0, 2)
                  .map((part) => part.charAt(0).toUpperCase())
                  .join("")}
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-900">{initiative.ownerName}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {initiative.ownerRoleLabel ?? "Ohne Rollenbezeichnung"}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 text-sm text-slate-600">
              <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Start</div>
                <div className="mt-1 font-medium text-slate-800">
                  {formatDateLabel(initiative.startDateIso)}
                </div>
              </div>

              <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Ziel</div>
                <div className="mt-1 font-medium text-slate-800">
                  {formatDateLabel(initiative.targetDateIso)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <VereinsleitungInitiativeRoadmap
        status={initiative.status}
        startDateIso={initiative.startDateIso}
        targetDateIso={initiative.targetDateIso}
        totalWorkItems={totalWorkItems}
        resolvedWorkItems={resolvedWorkItems}
        progressPercent={progressPercent}
      />

      <VereinsleitungInitiativeWorkItemsCard
        initiativeId={initiative.id}
        workItems={workItems}
        totalCount={totalWorkItems}
        resolvedCount={resolvedWorkItems}
        progressPercent={progressPercent}
      />
    </div>
  );
}

