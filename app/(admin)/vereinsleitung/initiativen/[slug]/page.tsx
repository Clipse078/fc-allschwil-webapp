import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getInitiativeBySlug } from "@/lib/initiatives/queries";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import InitiativeGovernanceBanner from "@/components/admin/initiatives/InitiativeGovernanceBanner";
import ReviewStageBadge from "@/components/admin/shared/ReviewStageBadge";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { ArrowLeft, Calendar, Flag, ShieldCheck, Users } from "lucide-react";

type PageProps = {
  params: Promise<{ slug: string }>;
};

const STATUS_LABELS: Record<string, string> = {
  PLANNED: "Geplant",
  IN_PROGRESS: "In Arbeit",
  ON_TRACK: "On Track",
  ON_HOLD: "Pausiert",
  COMPLETED: "Abgeschlossen",
  CANCELLED: "Abgesagt",
};

function formatSwissDate(date: Date | string) {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export default async function InitiativeDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { slug } = await params;
  const actor = await getActorContext(session.user, session.user?.tenantId ?? undefined);

  // 404-masking: getInitiativeBySlug returns null if actor cannot see the record.
  // The "not in DB" fallback card renders identically — no 403 leakage.
  const dbInitiative = await getInitiativeBySlug(slug, actor);

  return (
    <div className="space-y-5">
      <AdminSectionHeader
        eyebrow="Initiativen"
        title={dbInitiative?.title ?? slug}
        description={dbInitiative?.summary ?? "Initiative Details"}
        actions={
          <Link
            href="/vereinsleitung/initiativen"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Link>
        }
      />

      {dbInitiative ? (
        <>
          <InitiativeGovernanceBanner initiative={dbInitiative} />

          <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
            <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                {dbInitiative.status ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700">
                    {STATUS_LABELS[dbInitiative.status] ?? dbInitiative.status}
                  </span>
                ) : null}
                <ReviewStageBadge stage={dbInitiative.reviewStage} />
                {dbInitiative.requiresFourEyeReview ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700">
                    <ShieldCheck className="h-3 w-3" />
                    4-Augen
                  </span>
                ) : null}
              </div>

              {dbInitiative.description ? (
                <div className="prose prose-sm max-w-none text-slate-700">
                  <p>{dbInitiative.description}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">
                  Noch keine ausführliche Beschreibung erfasst.
                </p>
              )}

              {dbInitiative.progress !== null ? (
                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      Fortschritt
                    </p>
                    <span className="text-sm font-semibold text-[#0b4aa2]">
                      {dbInitiative.progress}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-[#0b4aa2]"
                      style={{ width: `${Math.min(100, dbInitiative.progress)}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </section>

            <aside className="space-y-5">
              <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Details
                </h3>
                <dl className="space-y-3">
                  {dbInitiative.owner ? (
                    <div className="flex items-start gap-3">
                      <Users className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <div>
                        <dt className="text-[11px] text-slate-400">Verantwortlich</dt>
                        <dd className="text-sm font-medium text-slate-900">
                          {dbInitiative.owner}
                        </dd>
                      </div>
                    </div>
                  ) : null}

                  {dbInitiative.dueDate ? (
                    <div className="flex items-start gap-3">
                      <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <div>
                        <dt className="text-[11px] text-slate-400">Fällig bis</dt>
                        <dd className="text-sm font-medium text-slate-900">
                          {formatSwissDate(dbInitiative.dueDate)}
                        </dd>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-start gap-3">
                    <Flag className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div>
                      <dt className="text-[11px] text-slate-400">Status</dt>
                      <dd className="text-sm font-medium text-slate-900">
                        {STATUS_LABELS[dbInitiative.status] ?? dbInitiative.status}
                      </dd>
                    </div>
                  </div>

                  <div>
                    <dt className="text-[11px] text-slate-400 mb-1">Erstellt</dt>
                    <dd className="text-sm font-medium text-slate-900">
                      {formatSwissDate(dbInitiative.createdAt)}
                    </dd>
                  </div>
                </dl>
              </section>
            </aside>
          </div>
        </>
      ) : (
        // Graceful fallback for slugs not yet in DB (legacy mock links still work)
        <section className="rounded-[28px] border border-slate-200/80 bg-white p-8 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <p className="text-sm font-medium text-slate-500">
            Diese Initiative ist noch nicht in der Datenbank erfasst.
          </p>
          <p className="mt-2 text-[12px] text-slate-400">
            Slug: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">{slug}</code>
          </p>
          <p className="mt-4 text-[12px] text-slate-400">
            Erstelle diese Initiative via{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">
              POST /api/initiatives
            </code>{" "}
            mit dem Slug{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">{slug}</code>.
          </p>
        </section>
      )}
    </div>
  );
}
