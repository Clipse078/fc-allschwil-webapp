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
  DRAFT: "sce-chip-warning",
  ACTIVE: "sce-chip-success",
  ARCHIVED: "sce-chip",
};

const STATUS_LABELS: Record<string, string> = { DRAFT: "Entwurf", ACTIVE: "Aktiv", ARCHIVED: "Archiviert" };

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
          <Link href="/vereinsleitung/templates/new" className="sce-action-primary px-4 py-2.5 text-sm">
            <Plus className="h-4 w-4" />Neue Vorlage
          </Link>
        }
      />

      {params.status === "saved" ? (
        <div className="rounded-[20px] fca-status-box fca-status-box-success px-5 py-3 text-sm font-medium">Vorlage gespeichert.</div>
      ) : null}

      {templates.length === 0 ? (
        <section className="sce-empty-state p-10">
          <Sparkles className="mx-auto mb-4 h-10 w-10 text-[var(--sce-subtle)]" />
          <h3 className="sce-section-title">Noch keine Vorlagen</h3>
          <p className="mt-2 text-sm text-[var(--sce-muted)]">Erstelle die erste kontextbewusste Kommunikationsvorlage.</p>
          <Link href="/vereinsleitung/templates/new" className="sce-action-primary mt-5 px-5 py-2.5 text-sm">
            <Plus className="h-4 w-4" />Erste Vorlage erstellen
          </Link>
        </section>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {templates.map((t) => (
            <Link key={t.id} href={`/vereinsleitung/templates/${t.id}`}
              className="sce-list-card block p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-[var(--sce-primary-strong)]" />
                    <p className="truncate text-[1.02rem] font-semibold text-[var(--sce-heading)]">{t.title}</p>
                  </div>
                  <p className="mt-1.5 truncate text-sm text-[var(--sce-muted)]">{t.subject}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="sce-chip px-2.5 py-1 text-[11px]">{CATEGORY_LABELS[t.category] ?? t.category}</span>
                    {t.moduleKey ? <span className="sce-chip sce-chip-primary px-2.5 py-1 text-[11px]">{t.moduleKey}</span> : null}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_CLASSES[t.status] ?? STATUS_CLASSES.DRAFT}`}>{STATUS_LABELS[t.status] ?? t.status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
