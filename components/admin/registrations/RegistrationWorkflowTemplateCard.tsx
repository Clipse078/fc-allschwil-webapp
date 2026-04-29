"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import RegistrationWorkflowTemplateStepsEditor from "./RegistrationWorkflowTemplateStepsEditor";

type RoleOption = { id: string; name: string };
type PersonOption = { id: string; name: string };

type Template = {
  id: string;
  name: string;
  targetGroup: string;
  registrationType?: string | null;
  isActive: boolean;
  defaultDueDays: number;
  responsibleRole?: { id: string; name: string } | null;
  responsiblePerson?: { id: string; firstName: string; lastName: string; displayName?: string | null; email?: string | null } | null;
};

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

function personName(person?: Template["responsiblePerson"]) {
  if (!person) return "—";
  return person.displayName ?? `${person.firstName} ${person.lastName}`.trim() ?? person.email ?? "—";
}

export default function RegistrationWorkflowTemplateCard({
  template,
  roles,
  people,
}: {
  template: Template;
  roles: RoleOption[];
  people: PersonOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggleActive() {
    setPending(true);
    try {
      const response = await fetch(`/api/admin/registration-workflows/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name,
          targetGroup: template.targetGroup,
          registrationType: template.registrationType ?? "",
          defaultDueDays: template.defaultDueDays,
          responsibleRoleId: template.responsibleRole?.id ?? "",
          responsiblePersonId: template.responsiblePerson?.id ?? "",
          isActive: !template.isActive,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Template konnte nicht aktualisiert werden.");
      }

      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Template konnte nicht aktualisiert werden.");
    } finally {
      setPending(false);
    }
  }

  async function deleteTemplate() {
    setPending(true);
    try {
      const response = await fetch(`/api/admin/registration-workflows/${template.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Template konnte nicht gelöscht werden.");
      }

      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Template konnte nicht gelöscht werden.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-slate-950">{template.name}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {targetGroupLabels[template.targetGroup] ?? template.targetGroup}
            {template.registrationType ? ` · ${typeLabels[template.registrationType] ?? template.registrationType}` : " · Alle Typen"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={toggleActive} className={`rounded-full border px-3 py-1 text-xs font-black ${template.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
            {template.isActive ? "Aktiv" : "Inaktiv"}
          </button>
          <button type="button" disabled={pending} onClick={deleteTemplate} className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-black text-red-600 hover:bg-red-50 disabled:opacity-40">
            Löschen
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm font-semibold text-slate-600 md:grid-cols-3">
        <p>Standardfrist: <span className="font-black text-slate-900">{template.defaultDueDays} Tage</span></p>
        <p>Rolle: <span className="font-black text-slate-900">{template.responsibleRole?.name ?? "—"}</span></p>
        <p>Person: <span className="font-black text-slate-900">{personName(template.responsiblePerson)}</span></p>
      </div>

      <RegistrationWorkflowTemplateStepsEditor templateId={template.id} roles={roles} people={people} />
    </div>
  );
}
