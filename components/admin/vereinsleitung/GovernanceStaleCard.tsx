import type { ReactNode } from "react";
import Link from "next/link";
import { Target, FileText } from "lucide-react";
import type { StaleTargetItem, TemplateDraftItem } from "@/lib/dashboard/governance-overview";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  SPORTLICHE_ENTWICKLUNG: "Sport",
  MITGLIEDERWACHSTUM: "Mitglieder",
  FINANZEN: "Finanzen",
  AUSBILDUNG: "Ausbildung",
  MEDIEN_SOZIALES: "Medien",
  GOVERNANCE: "Governance",
};

const TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
  MATCH_INVITATION: "Spieleinladung",
  MEETING_FOLLOWUP: "Meeting",
  INITIATIVE_UPDATE: "Initiative",
  TARGET_PROGRESS: "Ziel",
  TOURNAMENT_REMINDER: "Turnier",
  GOVERNANCE_FOLLOWUP: "Governance",
  SPONSOR_OUTREACH: "Sponsor",
  PARENT_COMMUNICATION: "Eltern",
  GENERAL: "Allgemein",
};

function staleDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] border border-dashed border-slate-200 bg-slate-50/60 px-4 py-4 text-sm text-slate-400">
      <span className="shrink-0 text-slate-300">{icon}</span>
      {text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GovernanceStaleCard
// ---------------------------------------------------------------------------

type Props = {
  staleTargets: StaleTargetItem[];
  templateDrafts: TemplateDraftItem[];
};

export default function GovernanceStaleCard({ staleTargets, templateDrafts }: Props) {
  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">

      {/* ── Stale Targets ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[1.08rem] font-semibold text-slate-900">
            Stagnierende Ziele
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-400">Aktiv, seit &gt;30 Tagen nicht aktualisiert</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${staleTargets.length > 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
          {staleTargets.length}
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        {staleTargets.length === 0 ? (
          <EmptyState
            icon={<Target className="h-4 w-4" />}
            text="Alle Ziele sind aktuell."
          />
        ) : (
          staleTargets.slice(0, 4).map((t) => {
            const days = staleDays(t.updatedAt);
            return (
              <Link
                key={t.id}
                href={`/vereinsleitung/targets/${t.id}`}
                className="block rounded-[18px] border border-slate-200/80 bg-white px-4 py-3 shadow-[0_4px_12px_rgba(15,23,42,0.03)] transition hover:-translate-y-[1px] hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium text-slate-800">
                    {t.title}
                  </p>
                  <span className="shrink-0 text-[11px] font-semibold text-amber-600">
                    {days}d
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-slate-400">
                    {CATEGORY_LABELS[t.category] ?? t.category}
                  </span>
                  {t.progress !== null ? (
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-1.5 rounded-full ${t.progress >= 80 ? "bg-emerald-500" : t.progress >= 50 ? "bg-[#3f63b5]" : "bg-amber-400"}`}
                          style={{ width: `${t.progress}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500">
                        {t.progress}%
                      </span>
                    </div>
                  ) : null}
                </div>
              </Link>
            );
          })
        )}
        {staleTargets.length > 4 && (
          <Link
            href="/vereinsleitung/targets"
            className="block pt-1 text-center text-[11px] text-[#3f63b5] hover:underline"
          >
            + {staleTargets.length - 4} weitere anzeigen
          </Link>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="my-5 border-t border-slate-100" />

      {/* ── Template Drafts ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[1.08rem] font-semibold text-slate-900">
            Vorlagen zur Prüfung
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-400">CommunicationTemplates in Prüfungsstufe</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${templateDrafts.length > 0 ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
          {templateDrafts.length}
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        {templateDrafts.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-4 w-4" />}
            text="Keine Vorlagen zur Prüfung."
          />
        ) : (
          templateDrafts.slice(0, 3).map((t) => (
            <Link
              key={t.id}
              href={`/vereinsleitung/templates/${t.id}`}
              className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-200/80 bg-white px-4 py-3 shadow-[0_4px_12px_rgba(15,23,42,0.03)] transition hover:-translate-y-[1px] hover:shadow-md"
            >
              <p className="min-w-0 truncate text-sm font-medium text-slate-800">{t.title}</p>
              <span className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                {TEMPLATE_CATEGORY_LABELS[t.category] ?? t.category}
              </span>
            </Link>
          ))
        )}
        {templateDrafts.length > 3 && (
          <Link
            href="/vereinsleitung/templates"
            className="block pt-1 text-center text-[11px] text-[#3f63b5] hover:underline"
          >
            + {templateDrafts.length - 3} weitere anzeigen
          </Link>
        )}
      </div>

    </section>
  );
}
