import Link from "next/link";
import { ArrowLeft, Workflow } from "lucide-react";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import RegistrationWorkflowTemplateForm from "@/components/admin/registrations/RegistrationWorkflowTemplateForm";
import RegistrationWorkflowTemplateStepsEditor from "@/components/admin/registrations/RegistrationWorkflowTemplateStepsEditor";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

const targetGroupLabels: Record<string, string> = {
  KINDERFUSSBALL: "Kinderfussball",
  JUNIOREN: "Junioren",
  FRAUEN: "Frauen",
  AKTIVE: "Aktive",
  TRAININGSGRUPPE: "Trainingsgruppe",
  TRAINERSTAFF: "Trainerstaff",
  OTHER: "Andere",
};

const typeLabels: Record<string, string> = {
  PLAYER: "Spieler",
  TRAINER: "Trainer",
  STAFF: "Staff",
  EXTERNAL: "Extern",
};

export default async function RegistrationWorkflowsAdminPage() {
  await requirePermission(PERMISSIONS.USERS_MANAGE);

  const [templates, roles, people] = await Promise.all([
    prisma.registrationWorkflowTemplate.findMany({
      orderBy: [{ targetGroup: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      include: {
        responsibleRole: { select: { id: true, key: true, name: true } },
        responsiblePerson: { select: { id: true, firstName: true, lastName: true, displayName: true, email: true } },
      },
    }),
    prisma.role.findMany({
      orderBy: [{ name: "asc" }],
      select: { id: true, key: true, name: true },
    }),
    prisma.person.findMany({
      where: { isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, displayName: true, email: true },
    }),
  ]);

  function personName(person: { firstName: string; lastName: string; displayName?: string | null; email?: string | null } | null) {
    if (!person) return "—";
    return person.displayName ?? (`${person.firstName} ${person.lastName}`.trim() || person.email || "—");
  }

  const peopleOptions = people.map((person) => ({
    id: person.id,
    name: person.displayName ?? (`${person.firstName} ${person.lastName}`.trim() || person.email || "Unbekannt"),
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <AdminSectionHeader
          eyebrow="Admin · Workflows"
          title="Anmelde-Workflows"
          description="Steuere Zielgruppen, Zuständigkeiten und Standard-Fristen für neue Anmeldungen. Diese Konfiguration ersetzt später hardcodierte Regeln."
        />

        <Link
          href="/dashboard/admin"
          className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zur Admin-Übersicht
        </Link>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Templates</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{templates.length}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Regeln pro Zielgruppe und Anmeldungstyp.</p>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Rollen</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{roles.length}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Für automatische Zuständigkeit nutzbar.</p>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Personen</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{people.length}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Direkte Zuweisung als Fallback.</p>
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="fca-eyebrow">Workflow Templates</p>
            <h2 className="mt-2 text-xl font-black text-slate-900">Zielgruppen-Konfiguration</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              Templates und Schritte steuern, wer neue Anmeldungen weiterbearbeitet und welche Aufgaben automatisch entstehen.
            </p>
          </div>
          <Workflow className="h-6 w-6 text-[#0b4aa2]" />
        </div>

        <RegistrationWorkflowTemplateForm roles={roles} people={peopleOptions} />

        <div className="mt-6 grid gap-4">
          {templates.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-6">
              <p className="font-black text-slate-900">Noch keine Workflow-Templates definiert.</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                Bis Templates existieren, nutzt die Anmeldung weiterhin die sichere Standardlogik aus der Registrierungsklassifikation.
              </p>
            </div>
          ) : (
            templates.map((template) => (
              <div key={template.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-slate-950">{template.name}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {targetGroupLabels[template.targetGroup] ?? template.targetGroup}
                      {template.registrationType ? ` · ${typeLabels[template.registrationType] ?? template.registrationType}` : " · Alle Typen"}
                    </p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${template.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                    {template.isActive ? "Aktiv" : "Inaktiv"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 text-sm font-semibold text-slate-600 md:grid-cols-3">
                  <p>Standardfrist: <span className="font-black text-slate-900">{template.defaultDueDays} Tage</span></p>
                  <p>Rolle: <span className="font-black text-slate-900">{template.responsibleRole?.name ?? "—"}</span></p>
                  <p>Person: <span className="font-black text-slate-900">{personName(template.responsiblePerson)}</span></p>
                </div>

                <div className="mt-5">
                  <RegistrationWorkflowTemplateStepsEditor templateId={template.id} />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
