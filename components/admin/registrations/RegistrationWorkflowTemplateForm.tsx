"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type RoleOption = { id: string; name: string };
type PersonOption = { id: string; name: string };

const targetGroups = [
  ["KINDERFUSSBALL", "Kinderfussball"],
  ["JUNIOREN", "Junioren"],
  ["FRAUEN", "Frauen"],
  ["AKTIVE", "Aktive"],
  ["TRAININGSGRUPPE", "Trainingsgruppe"],
  ["TRAINERSTAFF", "Trainerstaff"],
  ["OTHER", "Andere"],
];

const registrationTypes = [
  ["", "Alle Typen"],
  ["PLAYER", "Spieler"],
  ["TRAINER", "Trainer"],
  ["STAFF", "Staff"],
  ["EXTERNAL", "Extern"],
];

export default function RegistrationWorkflowTemplateForm({
  roles,
  people,
}: {
  roles: RoleOption[];
  people: PersonOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);

    try {
      const payload = {
        name: String(formData.get("name") ?? ""),
        targetGroup: String(formData.get("targetGroup") ?? ""),
        registrationType: String(formData.get("registrationType") ?? ""),
        responsibleRoleId: String(formData.get("responsibleRoleId") ?? ""),
        responsiblePersonId: String(formData.get("responsiblePersonId") ?? ""),
        defaultDueDays: Number(formData.get("defaultDueDays") ?? 7),
      };

      const response = await fetch("/api/admin/registration-workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Workflow konnte nicht gespeichert werden.");
      }

      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Workflow konnte nicht gespeichert werden.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={submit} className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
      <div className="grid gap-4 lg:grid-cols-3">
        <input name="name" required placeholder="Name" className="input" />
        <select name="targetGroup">{targetGroups.map(([v,l])=>(<option key={v} value={v}>{l}</option>))}</select>
        <select name="registrationType">{registrationTypes.map(([v,l])=>(<option key={v} value={v}>{l}</option>))}</select>
        <select name="responsibleRoleId"><option value="">Rolle</option>{roles.map(r=>(<option key={r.id} value={r.id}>{r.name}</option>))}</select>
        <select name="responsiblePersonId"><option value="">Person</option>{people.map(p=>(<option key={p.id} value={p.id}>{p.name}</option>))}</select>
        <input name="defaultDueDays" type="number" defaultValue={7} />
      </div>

      <div className="mt-4">
        <button disabled={pending} className="btn-primary">
          {pending ? "Speichern..." : "Template erstellen"}
        </button>
      </div>
    </form>
  );
}
