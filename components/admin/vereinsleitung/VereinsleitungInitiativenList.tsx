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
import { ChevronRight, Edit, Flag, Plus, Users } from "lucide-react";
import ReviewStageBadge from "@/components/admin/shared/ReviewStageBadge";
import VisibilityScopeBadge from "@/components/admin/shared/VisibilityScopeBadge";
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

function getStatusClass(status: InitiativeListItemShape["status"]): string {
  switch (status) {
    case "IN_PROGRESS":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "ON_TRACK":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "COMPLETED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "ON_HOLD":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "CANCELLED":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

type VereinsleitungInitiativenListProps = {
  initiatives: InitiativeListItemShape[];
};

export default function VereinsleitungInitiativenList({
  initiatives,
}: VereinsleitungInitiativenListProps) {
  if (initiatives.length === 0) {
    return (
      <div className="rounded-[28px] border border-slate-200/80 bg-white p-10 text-center shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <Flag className="mx-auto mb-4 h-10 w-10 text-slate-300" />
        <h3 className="text-[1.05rem] font-semibold text-slate-900">
          Keine zugänglichen Initiativen
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          Noch keine Initiativen erfasst oder keine für dich sichtbaren Einträge.
        </p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-medium text-slate-500">
          <Plus className="h-3.5 w-3.5" />
          POST /api/initiatives
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {initiatives.map((initiative) => (
        <Link
          key={initiative.slug}
          href={`/initiatives/${initiative.slug}`}
          className="block rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-[1px] hover:shadow-[0_16px_34px_rgba(15,23,42,0.06)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[1.05rem] font-semibold text-slate-900">
                  {initiative.title}
                </h3>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusClass(initiative.status)}`}
                >
                  {STATUS_LABELS[initiative.status]}
                </span>
              </div>

              {initiative.summary ? (
                <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">
                  {initiative.summary}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                {initiative.owner ? (
                  <span className="inline-flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {initiative.owner}
                  </span>
                ) : null}

                {initiative.progress !== null ? (
                  <span className="inline-flex items-center gap-2">
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
              <div className="flex items-center gap-2">
                <Link
                  href={`/initiatives/${initiative.slug}/edit`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-700"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Bearbeiten
                </Link>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#0b4aa2]">
                  Öffnen
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>
            </div>
          </div>

          {initiative.progress !== null ? (
            <div className="mt-4 h-1.5 rounded-full bg-slate-100">
              <div
                className="h-1.5 rounded-full bg-[#0b4aa2]"
                style={{ width: `${Math.min(100, initiative.progress)}%` }}
              />
            </div>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
