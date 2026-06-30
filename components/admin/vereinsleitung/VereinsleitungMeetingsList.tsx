/**
 * DB-backed meetings list. Data is fetched server-side in meetings/page.tsx
 * and passed as props.
 *
 * VISIBILITY NOTE: The meetings array passed here is currently UNFILTERED —
 * every authenticated user sees every meeting. Once VisibilityScope is added
 * to the Meeting model (Phase 2), the server page must pass a visibility-filtered
 * list so that RESTRICTED and PRIVATE meetings are silently excluded.
 * The empty state MUST NOT reveal whether hidden meetings exist.
 *
 * TODO: Cross-Module Linking — Meeting detail integration
 * When this component is wired to real Meeting records, the detail page
 * should surface linked Targets (reverse query on Target.linkedMeetingRefs).
 * See lib/linking/stubs.ts for the migration path from static stubs to real
 * DB queries, and VereinsleitungMeetingDetail.tsx for the traceability TODOs.
 */

import Link from "next/link";
import { CalendarDays, ChevronRight, Edit, Users } from "lucide-react";
import ReviewStageBadge from "@/components/admin/shared/ReviewStageBadge";
import VisibilityScopeBadge from "@/components/admin/shared/VisibilityScopeBadge";
import { Badge } from "@/components/ui";
import type { ReviewWorkflowStage } from "@prisma/client";
import type { VisibilityScopeValue } from "@/components/admin/shared/VisibilityScopeSelect";

export type MeetingListItemShape = {
  id: string;
  slug: string;
  title: string;
  meetingDate: Date;
  location: string | null;
  attendeeCount: number | null;
  status: "PLANNED" | "COMPLETED" | "CANCELLED";
  reviewStage: ReviewWorkflowStage;
  visibilityScope: VisibilityScopeValue;
};

const STATUS_LABELS: Record<MeetingListItemShape["status"], string> = {
  PLANNED: "Geplant",
  COMPLETED: "Abgeschlossen",
  CANCELLED: "Abgesagt",
};

type StatusVariant = "default" | "success" | "danger";

const STATUS_VARIANTS: Record<MeetingListItemShape["status"], StatusVariant> = {
  PLANNED: "default",
  COMPLETED: "success",
  CANCELLED: "danger",
};

function formatSwissDate(date: Date) {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

type VereinsleitungMeetingsListProps = {
  meetings: MeetingListItemShape[];
};

export default function VereinsleitungMeetingsList({
  meetings,
}: VereinsleitungMeetingsListProps) {
  return (
    <div className="space-y-3">
      {meetings.map((meeting) => (
        <div
          key={meeting.slug}
          className="relative rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
        >
          {/* Transparent overlay link — covers the whole card, sits below interactive children */}
          <Link
            href={`/vereinsleitung/meetings/${meeting.slug}`}
            className="absolute inset-0 rounded-xl"
            aria-label={meeting.title}
          />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                {meeting.title}
              </h3>

              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-[var(--text-2)]">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {formatSwissDate(meeting.meetingDate)}
                </span>

                {meeting.attendeeCount ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    {meeting.attendeeCount} Teilnehmer
                  </span>
                ) : null}

                {meeting.location ? (
                  <span className="text-[var(--muted)]">{meeting.location}</span>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Badge variant={STATUS_VARIANTS[meeting.status]} size="sm">
                {STATUS_LABELS[meeting.status]}
              </Badge>
              <div className="flex items-center gap-1.5">
                <ReviewStageBadge stage={meeting.reviewStage} size="sm" />
                <VisibilityScopeBadge scope={meeting.visibilityScope} />
              </div>
              <div className="relative z-10 flex items-center gap-2">
                <Link
                  href={`/vereinsleitung/meetings/${meeting.slug}/edit`}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Bearbeiten
                </Link>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--blue)]">
                  Öffnen
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
