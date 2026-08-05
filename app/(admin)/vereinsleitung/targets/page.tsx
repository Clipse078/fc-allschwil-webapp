import Link from "next/link";
import { Plus, Target, TrendingUp } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTargets } from "@/lib/targets/queries";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import TargetMetricProgress from "@/components/admin/targets/TargetMetricProgress";
import ReviewStageBadge from "@/components/admin/shared/ReviewStageBadge";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";

const CATEGORY_LABELS: Record<string, string> = {
  SPORTLICHE_ENTWICKLUNG: "Sportliche Entwicklung",
  MITGLIEDERWACHSTUM: "Mitgliederwachstum",
  FINANZEN: "Finanzen & Infrastruktur",
  AUSBILDUNG: "Ausbildung",
  MEDIEN_SOZIALES: "Medien & Soziales",
  GOVERNANCE: "Governance",
};

const STATUS_LABELS: Record<string, { label: string; classes: string }> = {
  ACTIVE: { label: "Aktiv", classes: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  DRAFT: { label: "Entwurf", classes: "border-amber-200 bg-amber-50 text-amber-700" },
  PAUSED: { label: "Pausiert", classes: "border-slate-200 bg-slate-50 text-slate-600" },
  COMPLETED: { label: "Abgeschlossen", classes: "border-blue-200 bg-blue-50 text-blue-700" },
  CANCELLED: { label: "Abgebrochen", classes: "border-rose-200 bg-rose-50 text-rose-700" },
};

type PageProps = {
  searchParams?: Promise<{ status?: string }>;
};

export default async function TargetsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = (await searchParams) ?? {};
  const actor = await getActorContext(session.user, session.user?.activeTenantId ?? undefined);
  const targets = await getTargets(actor);

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Ziele"
        title="Vereinsziele"
        description="Strategische Ziele und messbare Fortschrittskennzahlen für den Verein."
        actions={
          <Link
            href="/vereinsleitung/targets/new"
            className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a]"
          >
            <Plus className="h-4 w-4" />
            Neues Ziel
          </Link>
        }
      />

      {params.status === "saved" ? (
        <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-800">
          Ziel wurde erfolgreich gespeichert.
        </div>
      ) : null}

      {targets.length === 0 ? (
        <section className="rounded-[30px] border border-slate-200/80 bg-white p-10 shadow-[0_10px_30px_rgba(15,23,42,0.04)] text-center">
          <Target className="mx-auto mb-4 h-10 w-10 text-slate-300" />
          <h3 className="text-[1.05rem] font-semibold text-slate-900">
            Noch keine Ziele erfasst
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Erstelle das erste strategische Vereinsziel.
          </p>
          <Link
            href="/vereinsleitung/targets/new"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#08357a]"
          >
            <Plus className="h-4 w-4" />
            Erstes Ziel erstellen
          </Link>
        </section>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {targets.map((target) => {
            const statusInfo = STATUS_LABELS[target.status] ?? STATUS_LABELS.DRAFT;
            const categoryLabel = CATEGORY_LABELS[target.category] ?? target.category;
            const firstMetrics = target.metrics.slice(0, 2);

            return (
              <Link
                key={target.id}
                href={`/vereinsleitung/targets/${target.id}`}
                className="block rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-[2px] hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      {categoryLabel}
                    </p>
                    <h3 className="mt-1 text-[1.05rem] font-semibold leading-6 text-slate-900">
                      {target.title}
                    </h3>
                    {target.description ? (
                      <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">
                        {target.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusInfo.classes}`}
                    >
                      {statusInfo.label}
                    </span>
                    <ReviewStageBadge stage={target.reviewStage} size="sm" />
                  </div>
                </div>

                {firstMetrics.length > 0 ? (
                  <div className="mt-5 space-y-4">
                    {firstMetrics.map((metric) => (
                      <TargetMetricProgress
                        key={metric.id}
                        label={metric.label}
                        type={metric.type}
                        direction={metric.direction}
                        targetValue={metric.targetValue}
                        currentValue={metric.currentValue}
                        unit={metric.unit}
                      />
                    ))}

                    {target.metrics.length > 2 ? (
                      <p className="text-[11px] text-slate-400">
                        +{target.metrics.length - 2} weitere Metrik
                        {target.metrics.length - 2 === 1 ? "" : "en"}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-5 flex items-center gap-2 text-[11px] text-slate-400">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>{target.metrics.length} Metrik{target.metrics.length !== 1 ? "en" : ""}</span>
                  {target.periodLabel ? (
                    <>
                      <span>·</span>
                      <span>{target.periodLabel}</span>
                    </>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
