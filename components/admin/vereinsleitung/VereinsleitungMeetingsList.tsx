/**
 * DB-backed meetings list. Data is fetched server-side in meetings/page.tsx
 * and passed as props. When the result set is empty an empty-state is shown.
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
import { Card, StatusIndicator } from "@/components/ui";
import { EmptyState } from "@/components/ui/page";
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

const STATUS_INDICATOR_VARIANT: Record<
  MeetingListItemShape["status"],
  "info" | "success" | "danger"
> = {
  PLANNED: "info",
  COMPLETED: "success",
  CANCELLED: "danger",
};

const STATUS_LABELS: Record<MeetingListItemShape["status"], string> = {
  PLANNED: "Geplant",
  COMPLETED: "Abgeschlossen",
  CANCELLED: "Abgesagt",
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
  if (meetings.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="h-10 w-10" />}
        heading="Keine zugänglichen Meetings"
        description="Noch keine Meetings erfasst oder keine für dich sichtbaren Einträge."
      />
    );
  }

  return (
    <div className="space-y-4">
      {meetings.map((meeting) => (
        <Card
          key={meeting.slug}
          variant="section"
          interactive
          className="relative"
        >
          {/* Transparent overlay link — covers the whole card, sits below interactive children */}
          <Link
            href={`/vereinsleitung/meetings/${meeting.slug}`}
            className="absolute inset-0 rounded-xl"
            aria-label={meeting.title}
          />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-[1.05rem] font-semibold text-[var(--foreground)]">
                {meeting.title}
              </h3>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-[var(--text-2)]">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  {formatSwissDate(meeting.meetingDate)}
                </span>

                {meeting.attendeeCount ? (
                  <span className="inline-flex items-center gap-2">
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
              <StatusIndicator
                variant={STATUS_INDICATOR_VARIANT[meeting.status]}
                label={STATUS_LABELS[meeting.status]}
                size="sm"
              />
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
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--sce-primary)]">
                  Öffnen
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
