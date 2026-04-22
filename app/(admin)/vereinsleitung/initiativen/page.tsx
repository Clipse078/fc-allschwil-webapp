import Link from "next/link";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { prisma } from "@/lib/db/prisma";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";

function formatDateLabel(value: Date | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
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

function getStatusClass(status: string) {
  switch (status) {
    case "DONE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "PLANNED":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-blue-200 bg-blue-50 text-blue-700";
  }
}

export default async function VereinsleitungInitiativenPage() {
  await requireAnyPermission(ROUTE_PERMISSION_SETS.VEREINSLEITUNG_INITIATIVES_READ);

  const initiatives = await prisma.vereinsleitungInitiative.findMany({
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
        },
      },
      workItems: {
        select: {
          id: true,
          status: true,
          sourceMeetingId: true,
        },
      },
    },
  });

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Vereinsleitung"
        title="Initiativen"
        description="Alle Initiativen im Überblick – mit Status, Fortschritt, Verantwortlichkeit und direktem Einstieg in die Detailansicht."
        actions={
          <form action="/api/vereinsleitung/initiativen" method="POST">
            <button
              type="submit"
              className="fca-button-primary"
            >
              Neue Initiative
            </button>
          </form>
        }
      />

      {initiatives.length === 0 ? (
        <section className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="h-1.5 w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />
          <div className="p-10 text-center">
            <h3 className="text-lg font-semibold text-slate-900">
              Noch keine Initiativen vorhanden
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Sobald Initiativen erfasst werden, erscheinen sie hier automatisch mit Fortschritt, Verantwortlichkeit und Work-Item-Status.
            </p>
          </div>
        </section>
      ) : (
        <section className="grid gap-5 xl:grid-cols-2">
          {initiatives.map((initiative) => {
            const ownerName =
              initiative.owner?.displayName ??
              ([initiative.owner?.firstName, initiative.owner?.lastName]
                .filter(Boolean)
                .join(" ") || "Nicht zugewiesen");

            const totalWorkItems = initiative.workItems.length;
            const resolvedWorkItems = initiative.workItems.filter(
              (item) => item.status === "RESOLVED",
            ).length;
            const sourcedWorkItems = initiative.workItems.filter(
              (item) => Boolean(item.sourceMeetingId),
            ).length;
            const progressPercent =
              totalWorkItems > 0 ? Math.round((resolvedWorkItems / totalWorkItems) * 100) : 0;

            return (
              <Link
                key={initiative.id}
                href={"/vereinsleitung/initiativen/" + initiative.slug}
                className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-[2px] hover:shadow-[0_24px_52px_rgba(15,23,42,0.09)]"
              >
                <div className="h-1.5 w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />

                <div className="p-6 md:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-[1.35rem] font-semibold tracking-tight text-slate-900">
                        {initiative.title}
                      </h3>
                      <p className="mt-3 text-[15px] leading-7 text-slate-600">
                        {initiative.subtitle ?? "Keine Kurzbeschreibung hinterlegt."}
                      </p>
                    </div>

                    <span
                      className={
                        "rounded-full border px-3 py-1.5 text-[11px] font-semibold " +
                        getStatusClass(initiative.status)
                      }
                    >
                      {getInitiativeStatusLabel(initiative.status)}
                    </span>
                  </div>

                  <div className="mt-6 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                        Verantwortlich
                      </div>
                      <div className="mt-1 font-medium text-slate-800">{ownerName}</div>
                    </div>

                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                        Zeitraum
                      </div>
                      <div className="mt-1 font-medium text-slate-800">
                        {formatDateLabel(initiative.startDate)} – {formatDateLabel(initiative.targetDate)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                        Work Items
                      </div>
                      <div className="mt-1 font-semibold text-slate-900">{totalWorkItems}</div>
                    </div>

                    <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                        Erledigt
                      </div>
                      <div className="mt-1 font-semibold text-slate-900">{resolvedWorkItems}</div>
                    </div>

                    <div className="rounded-[22px] border border-blue-100 bg-blue-50/70 px-4 py-4">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-blue-500">
                        Aus Meetings
                      </div>
                      <div className="mt-1 font-semibold text-blue-900">{sourcedWorkItems}</div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-slate-900">Fortschritt</span>
                      <span className="text-slate-500">
                        {resolvedWorkItems}/{totalWorkItems} erledigt
                      </span>
                    </div>

                    <div className="mt-2 h-3 rounded-full bg-slate-100">
                      <div
                        className="h-3 rounded-full bg-[#7eb241]"
                        style={{ width: progressPercent + "%" }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}