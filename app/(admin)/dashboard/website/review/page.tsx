/**
 * /dashboard/website/review
 *
 * Editorial Review Queue — CMS V2 Slice 6.
 *
 * Shows all homepage sections that need editorial attention:
 *   - IN_REVIEW:          awaiting reviewer decision
 *   - CHANGES_REQUESTED:  changes requested; editor must re-submit
 *   - DRAFT:              not yet submitted for review
 *
 * Also shows recently approved sections for context.
 *
 * This is a foundation dashboard — not a full assignment workflow.
 * Approve/reject actions are available from here or from the Homepage Builder.
 *
 * Serialization note:
 *   React Server Components cannot pass functions or class instances to
 *   Client Components. All data forwarded to <ReviewQueueClient> must be
 *   JSON-safe. Dates are converted to ISO strings here; icon components
 *   (STATUS_CONFIG) are defined inside ReviewQueueClient, never here.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  XCircle,
  FileEdit,
  ArrowLeft,
} from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { CMS_ROUTES } from "@/lib/cms/routes";
import {
  listSectionsForReview,
  listRecentlyApprovedSections,
  type HomepageSectionAdminItem,
} from "@/lib/homepage/admin-queries";
import {
  APPROVAL_STATUS,
  APPROVAL_STATUS_LABELS,
} from "@/lib/homepage/approval-constants";
import {
  PageShell,
  PageBreadcrumbs,
  PageHeader,
} from "@/components/ui/page";
import {
  ReviewQueueClient,
  type ReviewQueueItem,
} from "@/components/admin/homepage/ReviewQueueClient";

// ---------------------------------------------------------------------------
// Serialization helper — converts all Date fields to ISO strings so the
// data is fully JSON-safe when passed to the Client Component.
// ---------------------------------------------------------------------------

function toReviewItem(s: HomepageSectionAdminItem): ReviewQueueItem {
  return {
    id: s.id,
    tenantId: s.tenantId,
    type: s.type,
    label: s.label,
    sortOrder: s.sortOrder,
    isEnabled: s.isEnabled,
    config: s.config as Record<string, unknown>,
    publishStatus: s.publishStatus,
    publishedAt: s.publishedAt ? s.publishedAt.toISOString() : null,
    unpublishedAt: s.unpublishedAt ? s.unpublishedAt.toISOString() : null,
    lastPublishedAt: s.lastPublishedAt ? s.lastPublishedAt.toISOString() : null,
    scheduledPublishAt: s.scheduledPublishAt
      ? s.scheduledPublishAt.toISOString()
      : null,
    approvalStatus: s.approvalStatus,
    reviewerUserId: s.reviewerUserId,
    reviewRequestedAt: s.reviewRequestedAt
      ? s.reviewRequestedAt.toISOString()
      : null,
    reviewedAt: s.reviewedAt ? s.reviewedAt.toISOString() : null,
    approvedAt: s.approvedAt ? s.approvedAt.toISOString() : null,
    rejectedAt: s.rejectedAt ? s.rejectedAt.toISOString() : null,
    approvalNote: s.approvalNote,
    approvedByUserId: s.approvedByUserId,
    rejectedByUserId: s.rejectedByUserId,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ReviewQueuePage() {
  const session = await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);
  const tenantId = session.user?.activeTenantId;
  if (!tenantId) notFound();

  const [queue, recentlyApproved] = await Promise.all([
    listSectionsForReview(tenantId),
    listRecentlyApprovedSections(tenantId, 10),
  ]);

  // Serialize to plain JSON-safe objects before crossing the RSC boundary
  const queueItems = queue.map(toReviewItem);
  const recentlyApprovedItems = recentlyApproved.map(toReviewItem);

  const inReview = queueItems.filter(
    (s) => s.approvalStatus === APPROVAL_STATUS.IN_REVIEW,
  );
  const changesRequested = queueItems.filter(
    (s) => s.approvalStatus === APPROVAL_STATUS.CHANGES_REQUESTED,
  );
  const drafts = queueItems.filter(
    (s) => s.approvalStatus === APPROVAL_STATUS.DRAFT,
  );

  return (
    <PageShell fullWidth>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Website", href: CMS_ROUTES.overview },
          { label: "Redaktionelle Freigabe" },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <PageHeader
          eyebrow="Website"
          title="Redaktionelle Freigabe"
          description="Überprüfungsqueue für Homepage-Sektionen. Sektionen im Status «In Überprüfung» können hier freigegeben oder abgelehnt werden."
          className="mb-0"
        />
      </div>

      {/* Architecture note */}
      <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "rgba(139,92,246,0.10)", color: "#8B5CF6" }}
          >
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Redaktionelle Freigabe Foundation (CMS V2 Slice 6)
            </p>
            <p className="mt-1 text-xs text-[var(--text-2)]">
              Sektionen können zur Überprüfung eingereicht, freigegeben oder
              abgelehnt werden. Nur{" "}
              <strong>Freigegebene</strong> oder{" "}
              <strong>Freigabefreie</strong> Sektionen können veröffentlicht
              werden.
            </p>
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              Deferred:{" "}
              <span className="text-amber-600">
                Vollständige Zuweisung · E-Mail-Benachrichtigungen ·
                Rollenbasierte Reviewer · Vier-Augen-Policy-Engine
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={CMS_ROUTES.homepage} className="fca-button-secondary text-xs">
          <ArrowLeft className="h-3.5 w-3.5" />
          Homepage Builder
        </Link>
        <Link href={CMS_ROUTES.overview} className="fca-button-secondary text-xs">
          ← CMS Übersicht
        </Link>
      </div>

      {/* Summary counters — rendered server-side, icon refs stay in Server Component */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          label="In Überprüfung"
          count={inReview.length}
          icon={Clock}
          colorClass="text-blue-600"
          bgClass="bg-blue-50"
        />
        <SummaryCard
          label="Änderungen nötig"
          count={changesRequested.length}
          icon={XCircle}
          colorClass="text-red-600"
          bgClass="bg-red-50"
        />
        <SummaryCard
          label="Entwürfe"
          count={drafts.length}
          icon={FileEdit}
          colorClass="text-amber-600"
          bgClass="bg-amber-50"
        />
        <SummaryCard
          label="Zuletzt freigegeben"
          count={recentlyApprovedItems.length}
          icon={CheckCircle2}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-50"
        />
      </div>

      {/* Review queue — Client Component receives only JSON-safe data; no icon refs */}
      <ReviewQueueClient
        queue={queueItems}
        recentlyApproved={recentlyApprovedItems}
        approvalStatusLabels={APPROVAL_STATUS_LABELS}
      />
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// SummaryCard — server-side only; icon refs never cross the RSC boundary
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  count,
  icon: Icon,
  colorClass,
  bgClass,
}: {
  label: string;
  count: number;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${bgClass} ${colorClass}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs text-[var(--text-2)]">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${colorClass}`}>{count}</p>
    </div>
  );
}
