import Link from "next/link";
import { Plus, FileText, Sparkles } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getCommunicationTemplates } from "@/lib/communication/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";

const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: "Allgemein", MATCH_INVITATION: "Spieleinladung", MEETING_FOLLOWUP: "Meeting Nachfass",
  INITIATIVE_UPDATE: "Initiativupdate", TARGET_PROGRESS: "Zielfortschritt",
  TOURNAMENT_REMINDER: "Turniererinnerung", GOVERNANCE_FOLLOWUP: "Governance Nachfass",
  SPONSOR_OUTREACH: "Sponsorenansprache", PARENT_COMMUNICATION: "Elterninformation",
};

const STATUS_CLASSES: Record<string, string> = {
  DRAFT: "border-amber-200 bg-amber-50 text-amber-700",
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ARCHIVED: "border-slate-200 bg-slate-50 text-slate-500",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Entwurf", ACTIVE: "Aktiv", ARCHIVED: "Archiviert",
};

type PageProps = { searchParams?: Promise<{ status?: string }> };

export default async function TemplatesPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = (await searchParams) ?? {};
  const templates = await getCommunicationTemplates();

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Kommunikation"
        title="Vorlagen"
        description="Deterministische Kommunikationsvorlagen mit Variablen für kontextbewusste Clubkommunikation."
        actions={
          <Link
            href="/templates/new"
            className="inline-flex items-center gap-2 rounded-full bg-[#3f63b5] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#2f52a0]"
          >
            <Plus className="h-4 w-4" />Neue Vorlage
          </Link>
        }
      />

      {params.status === "saved" ? (
        <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-800">
          Vorlage gespeichert.
        </div>
      ) : null}

      {templates.length === 0 ? (
        <section className="rounded-[30px] border border-slate-200/80 bg-white p-10 text-center shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <Sparkles className="mx-auto mb-4 h-10 w-10 text-slate-300" />
          <h3 className="text-[1.05rem] font-semibold text-slate-900">Noch keine Vorlagen</h3>
          <p className="mt-2 text-sm text-slate-500">Erstelle die erste kontextbewusste Kommunikationsvorlage.</p>
          <Link
            href="/templates/new"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#3f63b5] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2f52a0]"
          >
            <Plus className="h-4 w-4" />Erste Vorlage erstellen
          </Link>
        </section>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {templates.map((t) => (
            <Link
              key={t.id}
              href={`/templates/${t.id}`}
              className="block rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-[1px] hover:shadow-[0_16px_34px_rgba(15,23,42,0.06)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-[#3f63b5]" />
                    <p className="truncate text-[1.02rem] font-semibold text-slate-900">{t.title}</p>
                  </div>
                  <p className="mt-1.5 truncate text-sm text-slate-500">{t.subject}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                      {CATEGORY_LABELS[t.category] ?? t.category}
                    </span>
                    {t.moduleKey ? (
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                        {t.moduleKey}
                      </span>
                    ) : null}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_CLASSES[t.status] ?? STATUS_CLASSES.DRAFT}`}>
                  {STATUS_LABELS[t.status] ?? t.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
