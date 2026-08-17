import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMeetingBySlug, getMeetingSubEntities } from "@/lib/meetings/queries";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import VereinsleitungMeetingDetail from "@/components/admin/vereinsleitung/VereinsleitungMeetingDetail";
import MeetingGovernanceBanner from "@/components/admin/meetings/MeetingGovernanceBanner";
import MeetingDeleteButton from "@/components/admin/meetings/MeetingDeleteButton";
import ReviewStageBadge from "@/components/admin/shared/ReviewStageBadge";
import { PageShell } from "@/components/ui/page";
import { DetailPagePattern } from "@/components/ui/patterns";

type MeetingDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function MeetingDetailPage({ params }: MeetingDetailPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { slug } = await params;
  const actor = await getActorContext(session.user, session.user?.activeTenantId ?? undefined);

  // 404-masking: null if actor cannot see this meeting
  const dbMeeting = await getMeetingBySlug(slug, actor);

  // Fetch sub-entities in parallel once meeting is confirmed visible
  const subEntities = dbMeeting ? await getMeetingSubEntities(dbMeeting.id) : null;

  // Resolve permanent-delete authority for delete button visibility
  const tenantId = session.user?.activeTenantId;
  let canDelete = false;
  if (dbMeeting && tenantId) {
    const resolver = createEffectivePermissionResolver(prisma);
    canDelete = await resolver.hasTenantDeletionAuthority({
      userId: session.user.id,
      permission: PERMISSIONS.MEETINGS_DELETE,
      tenantId,
    });
  }

  const pageTitle = dbMeeting?.title ?? "Sitzung";

  return (
    <PageShell fullWidth>
      <DetailPagePattern
        eyebrow="Vereinsleitung"
        title={pageTitle}
        headerBadge={
          dbMeeting ? (
            <ReviewStageBadge stage={dbMeeting.reviewStage} />
          ) : undefined
        }
        breadcrumbs={[
          { label: "Vereinsleitung", href: "/vereinsleitung" },
          { label: "Sitzungen", href: "/vereinsleitung/meetings" },
          { label: pageTitle },
        ]}
        headerActions={
          <div className="flex items-center gap-2">
            {canDelete && dbMeeting ? (
              <MeetingDeleteButton
                meetingId={dbMeeting.id}
                meetingTitle={dbMeeting.title}
              />
            ) : null}
            <Link
              href="/vereinsleitung/meetings"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-transparent px-3.5 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Zurück zu Sitzungen
            </Link>
          </div>
        }
        summary={
          dbMeeting ? (
            <MeetingGovernanceBanner meeting={dbMeeting} />
          ) : undefined
        }
      >
        <VereinsleitungMeetingDetail dbMeeting={dbMeeting} subEntities={subEntities} />
      </DetailPagePattern>
    </PageShell>
  );
}
