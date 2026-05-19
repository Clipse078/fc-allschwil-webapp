import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTargetById } from "@/lib/targets/queries";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import TargetMetricProgress from "@/components/admin/targets/TargetMetricProgress";
import TargetDataPointForm from "@/components/admin/targets/TargetDataPointForm";
import TargetStageActions from "@/components/admin/targets/TargetStageActions";
import TargetLinksPanel from "@/components/admin/targets/TargetLinksPanel";
import ReviewStageBadge from "@/components/admin/shared/ReviewStageBadge";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { Edit, ArrowLeft, Calendar, Tag, ShieldCheck } from "lucide-react";

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

function formatSwissDate(value: Date | string) {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ status?: string }>;
};

export default async function TargetDetailPage({ params, searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const qp = (await searchParams) ?? {};
  const actor = await getActorContext(session.user);
  const target = await getTargetById(id, actor);

  if (!target) notFound();

  const statusInfo = STATUS_LABELS[target.status] ?? STATUS_LABELS.DRAFT;
  const categoryLabel = CATEGORY_LABELS[target.category] ?? target.category;

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Ziele"
        title={target.title}
        description={target.description ?? ""}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/vereinsleitung/targets"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Zurück
            </Link>
            <Link
              href={`/vereinsleitung/targets/${id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#3f63b5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#08357a]"
            >
              <Edit className="h-4 w-4" />
              Bearbeiten
            </Link>
          </div>
        }
      />

      {qp.status === "saved" ? (
        <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-800">
          Änderungen wurden gespeichert.
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${statusInfo.classes}`}
              >
                {statusInfo.label}
              </span>
              <ReviewStageBadge stage={target.reviewStage} />
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-600">
                {categoryLabel}
              </span>
              {target.periodLabel ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-600">
                  {target.periodLabel}
                </span>
              ) : null}
              {target.ageGroupHint ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-600">
                  {target.ageGroupHint}
                </span>
              ) : null}
              {target.requiresFourEyeReview ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700">
                  <ShieldCheck className="h-3 w-3" />
                  4-Augen
                </span>
              ) : null}
            </div>

            {target.metrics.length === 0 ? (
              <p className="text-sm text-slate-500">Noch keine Metriken erfasst.</p>
            ) : (
              <div className="space-y-8">
                {target.metrics.map((metric) => (
                  <div key={metric.id}>
                    <TargetMetricProgress
                      label={metric.label}
                      type={metric.type}
                      direction={metric.direction}
                      targetValue={metric.targetValue}
                      currentValue={metric.currentValue}
                      unit={metric.unit}
                    />

                    {metric.notes ? (
                      <p className="mt-2 text-[11px] text-slate-500">{metric.notes}</p>
                    ) : null}

                    <div className="mt-3">
                      <TargetDataPointForm
                        targetId={id}
                        metricId={metric.id}
                        metricLabel={metric.label}
                        metricType={metric.type}
                        unit={metric.unit}
                      />
                    </div>

                    {metric.dataPoints.length > 0 ? (
                      <div className="mt-3 space-y-1.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                          Letzte Messwerte
                        </p>
                        {metric.dataPoints.slice(0, 5).map((dp) => (
                          <div
                            key={dp.id}
                            className="flex items-center justify-between rounded-[14px] border border-slate-100 bg-slate-50 px-3 py-2"
                          >
                            <span className="text-[12px] font-semibold text-slate-900">
                              {dp.value}
                              {metric.unit ? ` ${metric.unit}` : ""}
                            </span>
                            <div className="flex items-center gap-3 text-[11px] text-slate-500">
                              {dp.note ? <span>{dp.note}</span> : null}
                              <span>{formatSwissDate(dp.measuredAt)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Details
            </h3>
            <dl className="space-y-3">
              <div className="flex items-start gap-3">
                <Tag className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div>
                  <dt className="text-[11px] text-slate-400">Kategorie</dt>
                  <dd className="text-sm font-medium text-slate-900">{categoryLabel}</dd>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div>
                  <dt className="text-[11px] text-slate-400">Zeitraum</dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {target.periodLabel ?? target.period}
                    {target.startsAt && target.endsAt ? (
                      <span className="block text-[11px] font-normal text-slate-500">
                        {formatSwissDate(target.startsAt)} – {formatSwissDate(target.endsAt)}
                      </span>
                    ) : null}
                  </dd>
                </div>
              </div>

              {target.sportCategory ? (
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-slate-400 text-[13px]">⚽</span>
                  <div>
                    <dt className="text-[11px] text-slate-400">Sportkategorie</dt>
                    <dd className="text-sm font-medium text-slate-900">{target.sportCategory}</dd>
                  </div>
                </div>
              ) : null}

              <div>
                <dt className="text-[11px] text-slate-400 mb-1">Erstellt</dt>
                <dd className="text-sm font-medium text-slate-900">
                  {formatSwissDate(target.createdAt)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-400" />
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Governance
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-[11px] text-slate-400 mb-1.5">Prüfstatus</p>
                <ReviewStageBadge stage={target.reviewStage} />
              </div>

              {target.reviewedAt ? (
                <div>
                  <p className="text-[11px] text-slate-400 mb-0.5">Geprüft am</p>
                  <p className="text-sm font-medium text-slate-900">
                    {formatSwissDate(target.reviewedAt)}
                  </p>
                </div>
              ) : null}

              <div>
                <p className="text-[11px] text-slate-400 mb-2">Statuswechsel</p>
                <TargetStageActions
                  targetId={id}
                  currentStage={target.reviewStage}
                />
              </div>
            </div>
          </section>

          {target.metrics.length > 0 ? (
            <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Fortschritt
              </h3>
              <div className="space-y-4">
                {target.metrics.map((metric) => (
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
              </div>
            </section>
          ) : null}

          <TargetLinksPanel
            targetId={id}
            linkedInitiativeRefsRaw={target.linkedInitiativeRefs}
            linkedMeetingRefsRaw={target.linkedMeetingRefs}
          />
        </aside>
      </div>
    </div>
  );
}
