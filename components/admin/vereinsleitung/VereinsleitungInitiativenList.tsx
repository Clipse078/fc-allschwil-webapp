/**
 * DB-backed initiatives list. Data is fetched server-side in
 * initiativen/page.tsx and passed as props.
 *
 * VISIBILITY NOTE: The initiatives array passed here is currently UNFILTERED —
 * every authenticated user sees every initiative. Once VisibilityScope is added
 * to the Initiative model (Phase 2), the server page must pass a
 * visibility-filtered list so that RESTRICTED and PRIVATE initiatives are
 * silently excluded. The empty state MUST NOT reveal whether hidden items exist
 * (no "X hidden initiatives" counter).
 *
 * Example use case: the board chair and Kassier create a PRIVATE initiative for
 * a confidential financial matter. Other roles must see an identical empty/normal
 * list — they must not learn that a private entry exists.
 *
 * TODO: Cross-Module Linking — Initiative ↔ Target FK promotion
 * When ready, replace Target.linkedInitiativeRefs JSONB with a proper
 * TargetInitiative junction table. The slug-based INITIATIVE_STUBS in
 * lib/linking/stubs.ts documents the async DB migration path.
 *
 * TODO: Initiative contribution scoring
 * Each initiative may later carry a contributionWeight toward a parent
 * Target; aggregate on the Target detail page as a secondary progress signal.
 */

import Link from "next/link";
import { ChevronRight, Edit, Flag, Users } from "lucide-react";
import ReviewStageBadge from "@/components/admin/shared/ReviewStageBadge";
import VisibilityScopeBadge from "@/components/admin/shared/VisibilityScopeBadge";
import { Badge } from "@/components/ui";
import type { ReviewWorkflowStage } from "@prisma/client";
import type { VisibilityScopeValue } from "@/components/admin/shared/VisibilityScopeSelect";

export type InitiativeListItemShape = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  status: "PLANNED" | "IN_PROGRESS" | "ON_TRACK" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  owner: string | null;
  progress: number | null;
  dueDate: Date | null;
  reviewStage: ReviewWorkflowStage;
  visibilityScope: VisibilityScopeValue;
};

const STATUS_LABELS: Record<InitiativeListItemShape["status"], string> = {
  PLANNED: "Geplant",
  IN_PROGRESS: "In Arbeit",
  ON_TRACK: "On Track",
  ON_HOLD: "Pausiert",
  COMPLETED: "Abgeschlossen",
  CANCELLED: "Abgesagt",
};

type BadgeVariant = "default" | "info" | "success" | "warning" | "danger";

const STATUS_VARIANTS: Record<InitiativeListItemShape["status"], BadgeVariant> = {
  PLANNED: "default",
  IN_PROGRESS: "info",
  ON_TRACK: "success",
  ON_HOLD: "warning",
  COMPLETED: "success",
  CANCELLED: "danger",
};

type VereinsleitungInitiativenListProps = {
  initiatives: InitiativeListItemShape[];
};

export default function VereinsleitungInitiativenList({
  initiatives,
}: VereinsleitungInitiativenListProps) {
  return (
    <div className="space-y-3">
      {initiatives.map((initiative) => (
        <div
          key={initiative.slug}
          className="relative rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
        >
          {/* Transparent overlay link — covers the whole card, sits below interactive children */}
          <Link
            href={`/vereinsleitung/initiativen/${initiative.slug}`}
            className="absolute inset-0 rounded-xl"
            aria-label={initiative.title}
          />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--foreground)]">
                  {initiative.title}
                </h3>
                <Badge variant={STATUS_VARIANTS[initiative.status]} size="sm">
                  {STATUS_LABELS[initiative.status]}
                </Badge>
              </div>

              {initiative.summary ? (
                <p className="mt-1.5 line-clamp-2 text-sm text-[var(--text-2)]">
                  {initiative.summary}
                </p>
              ) : null}

              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-[var(--text-2)]">
                {initiative.owner ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    {initiative.owner}
                  </span>
                ) : null}

                {initiative.progress !== null ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Flag className="h-4 w-4" />
                    {initiative.progress}% Fortschritt
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <div className="flex items-center gap-1.5">
                <ReviewStageBadge stage={initiative.reviewStage} size="sm" />
                <VisibilityScopeBadge scope={initiative.visibilityScope} />
              </div>
              <div className="relative z-10 flex items-center gap-2">
                <Link
                  href={`/vereinsleitung/initiativen/${initiative.slug}/edit`}
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

          {initiative.progress !== null ? (
            <div className="relative mt-4 h-1.5 rounded-full bg-[var(--surface-2)]">
              <div
                className="h-1.5 rounded-full bg-[var(--sce-primary)]"
                style={{ width: `${Math.min(100, initiative.progress)}%` }}
              />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
