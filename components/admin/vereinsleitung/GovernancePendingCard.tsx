import type { ReactNode } from "react";
import Link from "next/link";
import { ClipboardList, Clock } from "lucide-react";
import type { PendingApprovalItem, OverdueActionItem } from "@/lib/dashboard/governance-overview";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MODULE_BADGE: Record<PendingApprovalItem["module"], { label: string; cls: string }> = {
  meeting:   { label: "Meeting",    cls: "border-blue-200   bg-blue-50   text-blue-700" },
  initiative:{ label: "Initiative", cls: "border-violet-200 bg-violet-50 text-violet-700" },
  target:    { label: "Ziel",       cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  template:  { label: "Vorlage",    cls: "border-amber-200  bg-amber-50  text-amber-700" },
};

function relativeAge(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return "heute";
  if (diffDays === 1) return "gestern";
  if (diffDays < 7) return `vor ${diffDays} Tagen`;
  const weeks = Math.floor(diffDays / 7);
  if (weeks === 1) return "vor 1 Woche";
  return `vor ${weeks} Wochen`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] border border-dashed border-slate-200 bg-slate-50/60 px-4 py-4 text-sm text-slate-400">
      <span className="shrink-0 text-slate-300">{icon}</span>
      {text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GovernancePendingCard
// ---------------------------------------------------------------------------

type Props = {
  pendingApprovals: PendingApprovalItem[];
  overdueActions: OverdueActionItem[];
};

export default function GovernancePendingCard({ pendingApprovals, overdueActions }: Props) {
  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">

      {/* ── Pending Approvals ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[1.08rem] font-semibold text-slate-900">
            Ausstehende Genehmigungen
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Elemente in Stufe &ldquo;Zur Prüfung&rdquo;
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${pendingApprovals.length > 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
          {pendingApprovals.length}
        </span>
      </div>

      <div className="mt-5 space-y-2.5">
        {pendingApprovals.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-4 w-4" />}
            text="Keine ausstehenden Genehmigungen."
          />
        ) : (
          pendingApprovals.slice(0, 6).map((item) => {
            const badge = MODULE_BADGE[item.module];
            return (
              <Link
                key={`${item.module}-${item.id}`}
                href={item.href}
                className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-200/80 bg-white px-4 py-3 shadow-[0_4px_12px_rgba(15,23,42,0.03)] transition hover:-translate-y-[1px] hover:shadow-md"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                    {badge.label}
                  </span>
                  <span className="truncate text-sm font-medium text-slate-800">
                    {item.title}
                  </span>
                </div>
                <span className="shrink-0 text-[11px] text-slate-400">
                  {relativeAge(item.updatedAt)}
                </span>
              </Link>
            );
          })
        )}
        {pendingApprovals.length > 6 && (
          <p className="pt-1 text-center text-[11px] text-slate-400">
            + {pendingApprovals.length - 6} weitere
          </p>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="my-7 border-t border-slate-100" />

      {/* ── Overdue Actions ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[1.08rem] font-semibold text-slate-900">
            Überfällige Massnahmen
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Offene Meeting-Aktionen mit abgelaufenem Datum
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${overdueActions.length > 0 ? "border-rose-200 bg-rose-50 text-rose-600" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
          {overdueActions.length}
        </span>
      </div>

      <div className="mt-5 space-y-2.5">
        {overdueActions.length === 0 ? (
          <EmptyState
            icon={<Clock className="h-4 w-4" />}
            text="Keine überfälligen Massnahmen."
          />
        ) : (
          overdueActions.slice(0, 5).map((action) => (
            <Link
              key={action.id}
              href={`/meetings/${action.meetingSlug}`}
              className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-200/80 bg-white px-4 py-3 shadow-[0_4px_12px_rgba(15,23,42,0.03)] transition hover:-translate-y-[1px] hover:shadow-md"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{action.title}</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-400">
                  {action.meetingTitle}
                  {action.owner ? ` · ${action.owner}` : ""}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
                {formatDate(action.dueDate)}
              </span>
            </Link>
          ))
        )}
        {overdueActions.length > 5 && (
          <p className="pt-1 text-center text-[11px] text-slate-400">
            + {overdueActions.length - 5} weitere
          </p>
        )}
      </div>

    </section>
  );
}
