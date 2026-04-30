import Link from "next/link";
import { notFound } from "next/navigation";
import VereinsleitungMeetingDetail from "@/components/admin/vereinsleitung/VereinsleitungMeetingDetail";
import { PageHeader, PageShell } from "@/components/shared/page";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";
import { getMeetingDetailItem } from "@/lib/vereinsleitung/meeting-detail";

type VereinsleitungMeetingSlugPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function VereinsleitungMeetingSlugPage({
  params,
}: VereinsleitungMeetingSlugPageProps) {
  const session = await requireAnyPermission(
    ROUTE_PERMISSION_SETS.VEREINSLEITUNG_MEETINGS_READ,
  );

  const permissionKeys = Array.isArray(session.user.permissionKeys)
    ? session.user.permissionKeys
    : [];

  const canManageMeetings = permissionKeys.includes(
    PERMISSIONS.VEREINSLEITUNG_MEETINGS_MANAGE,
  );
  const canReviewMeetings = permissionKeys.includes(
    PERMISSIONS.VEREINSLEITUNG_MEETINGS_REVIEW,
  );
  const canApproveMeetings = permissionKeys.includes(
    PERMISSIONS.VEREINSLEITUNG_MEETINGS_APPROVE,
  );

  const resolvedParams = await params;
  const meeting = await getMeetingDetailItem(resolvedParams.slug);

  if (!meeting) {
    notFound();
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Meeting Detail"
        title={meeting.title}
        description="DB-basierte Meeting-Ansicht mit Pendenzen, Teilnehmern, Protokoll und vorbereitetem Beschlussbereich."
        breadcrumbs={[
          { label: "Vereinsleitung", href: "/vereinsleitung" },
          { label: "Meetings", href: "/vereinsleitung/meetings" },
          { label: meeting.title },
        ]}
        actions={
          <Link href="/vereinsleitung/meetings" className="fca-button-secondary">
            Zurück zur Übersicht
          </Link>
        }
      />

      <VereinsleitungMeetingDetail
        meeting={meeting}
        canManageMeetings={canManageMeetings}
        canReviewMeetings={canReviewMeetings}
        canApproveMeetings={canApproveMeetings}
      />
    </PageShell>
  );
}
