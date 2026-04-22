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
        },
      },
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <AdminSectionHeader
          eyebrow="Vereinsleitung"
          title="Initiativen"
          description="Alle Initiativen im Überblick und direkt per Detailseite aufrufbar."
        />

        <form action="/api/vereinsleitung/initiativen" method="POST" className="lg:pb-1">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 hover:text-red-700"
          >
            Neue Initiative
          </button>
        </form>
      </div>

      {initiatives.length === 0 ? (
        <section className="rounded-[30px] border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          Es wurde noch keine Initiative erfasst.
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
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
            const progressPercent =
              totalWorkItems > 0 ? Math.round((resolvedWorkItems / totalWorkItems) * 100) : 0;

            return (
              <Link
                key={initiative.id}
                href={"/vereinsleitung/initiativen/" + initiative.slug}
                className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[1.1rem] font-semibold text-slate-900">
                      {initiative.title}
                    </div>
                    <div className="mt-2 text-sm text-slate-500">
                      {initiative.subtitle ?? "Keine Kurzbeschreibung hinterlegt."}
                    </div>
                  </div>

                  <span
                    className={"rounded-full border px-3 py-1 text-[11px] font-semibold " + getStatusClass(initiative.status)}
                  >
                    {getInitiativeStatusLabel(initiative.status)}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Verantwortlich</div>
                    <div className="mt-1 font-medium text-slate-800">{ownerName}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Zeitraum</div>
                    <div className="mt-1 font-medium text-slate-800">
                      {formatDateLabel(initiative.startDate)} – {formatDateLabel(initiative.targetDate)}
                    </div>
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
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}
