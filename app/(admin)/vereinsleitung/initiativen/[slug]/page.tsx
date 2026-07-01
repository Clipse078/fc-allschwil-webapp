import Link from "next/link";
import { ArrowLeft, Calendar, Flag, Users } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getInitiativeBySlug } from "@/lib/initiatives/queries";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import InitiativeGovernanceBanner from "@/components/admin/initiatives/InitiativeGovernanceBanner";
import ReviewStageBadge from "@/components/admin/shared/ReviewStageBadge";
import { ShieldCheck } from "lucide-react";
import { PageShell, SectionCard, EmptyState } from "@/components/ui/page";
import { DetailPagePattern } from "@/components/ui/patterns";
import { Badge } from "@/components/ui";
import { PropertyGrid } from "@/components/ui/PropertyGrid";
import { MetadataCard } from "@/components/ui/MetadataCard";
import { TimelinePlaceholder } from "@/components/ui/TimelinePlaceholder";

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

const STATUS_BADGE_VARIANTS: Record<
  string,
  "default" | "primary" | "success" | "warning" | "danger" | "info" | "secondary" | "outline"
> = {
  PLANNED: "default",
  IN_PROGRESS: "primary",
  ON_TRACK: "success",
  ON_HOLD: "warning",
  COMPLETED: "success",
  CANCELLED: "danger",
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

  const pageTitle = dbInitiative?.title ?? slug;
  const statusLabel = dbInitiative?.status
    ? (STATUS_LABELS[dbInitiative.status] ?? dbInitiative.status)
    : undefined;

  return (
    <PageShell fullWidth>
      <DetailPagePattern
        eyebrow="Initiativen"
        title={pageTitle}
        description={dbInitiative?.summary ?? undefined}
        headerBadge={
          dbInitiative?.status ? (
            <Badge
              variant={STATUS_BADGE_VARIANTS[dbInitiative.status] ?? "default"}
            >
              {statusLabel}
            </Badge>
          ) : undefined
        }
        breadcrumbs={[
          { label: "Vereinsleitung", href: "/vereinsleitung" },
          { label: "Initiativen", href: "/vereinsleitung/initiativen" },
          { label: pageTitle },
        ]}
        headerActions={
          <Link
            href="/vereinsleitung/initiativen"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-transparent px-3.5 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Zurück
          </Link>
        }
        summary={
          dbInitiative ? (
            <InitiativeGovernanceBanner initiative={dbInitiative} />
          ) : undefined
        }
        sidebar={
          dbInitiative ? (
            <>
              {/* Details sidebar */}
              <SectionCard title="Details">
                <PropertyGrid
                  items={[
                    {
                      label: "Verantwortlich",
                      value: dbInitiative.owner,
                      icon: <Users className="h-3.5 w-3.5" />,
                      emptyText: "Nicht erfasst",
                    },
                    {
                      label: "Fällig bis",
                      value: dbInitiative.dueDate
                        ? formatSwissDate(dbInitiative.dueDate)
                        : null,
                      icon: <Calendar className="h-3.5 w-3.5" />,
                      emptyText: "Kein Datum",
                    },
                    {
                      label: "Status",
                      value: statusLabel,
                      icon: <Flag className="h-3.5 w-3.5" />,
                    },
                  ]}
                  columns={1}
                />
              </SectionCard>

              {/* Review info */}
              <SectionCard title="Freigabe">
                <div className="flex flex-wrap items-center gap-2">
                  <ReviewStageBadge stage={dbInitiative.reviewStage} />
                  {dbInitiative.requiresFourEyeReview ? (
                    <Badge variant="secondary" size="sm">
                      <ShieldCheck className="h-3 w-3" />
                      4-Augen
                    </Badge>
                  ) : null}
                </div>
              </SectionCard>

              {/* System metadata */}
              <MetadataCard
                fields={[
                  { label: "Erstellt", value: formatSwissDate(dbInitiative.createdAt) },
                ]}
              />

              <TimelinePlaceholder />
            </>
          ) : undefined
        }
      >
        {dbInitiative ? (
          <>
            {/* Description & progress */}
            <SectionCard title="Beschreibung">
              {dbInitiative.description ? (
                <p className="text-sm leading-relaxed text-[var(--text-2)]">
                  {dbInitiative.description}
                </p>
              ) : (
                <p className="text-sm italic text-[var(--muted)]">
                  Noch keine ausführliche Beschreibung erfasst.
                </p>
              )}

              {dbInitiative.progress !== null ? (
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                      Fortschritt
                    </p>
                    <span className="text-sm font-semibold text-[var(--sce-primary)]">
                      {dbInitiative.progress}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--surface-2)]">
                    <div
                      className="h-2 rounded-full bg-[var(--sce-primary)]"
                      style={{
                        width: `${Math.min(100, dbInitiative.progress)}%`,
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </SectionCard>
          </>
        ) : (
          // Graceful fallback for slugs not yet in DB (legacy mock links still work)
          <SectionCard title="Initiative nicht gefunden">
            <EmptyState
              heading="Diese Initiative ist noch nicht erfasst"
              description={`Slug: ${slug}`}
            />
          </SectionCard>
        )}
      </DetailPagePattern>
    </PageShell>
  );
}
