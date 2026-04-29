"use client";

import { useEffect, useState } from "react";

type RoleOption = { id: string; name: string };
type PersonOption = { id: string; name: string };

type Step = {
  id: string;
  title: string;
  description?: string | null;
  sortOrder: number;
  defaultDueDays: number;
  assignedRole?: { id: string; name: string } | null;
  assignedPerson?: { id: string; firstName: string; lastName: string; displayName?: string | null; email?: string | null } | null;
};

function personName(person?: Step["assignedPerson"]) {
  if (!person) return "—";
  return person.displayName ?? ((`${person.firstName} ${person.lastName}`.trim()) || person.email || "—");
}

export default function RegistrationWorkflowTemplateStepsEditor({
  templateId,
  roles,
  people,
}: {
  templateId: string;
  roles: RoleOption[];
  people: PersonOption[];
}) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [days, setDays] = useState(3);
  const [assignedRoleId, setAssignedRoleId] = useState("");
  const [assignedPersonId, setAssignedPersonId] = useState("");
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const response = await fetch(`/api/admin/registration-workflows/${templateId}/steps`);
    const data = await response.json();
    setSteps(data.steps || []);
  }

  useEffect(() => {
    load();
  }, [templateId]);

  function resetForm() {
    setTitle("");
    setDescription("");
    setDays(3);
    setAssignedRoleId("");
    setAssignedPersonId("");
    setEditingStepId(null);
  }

  function startEdit(step: Step) {
    setEditingStepId(step.id);
    setTitle(step.title);
    setDescription(step.description ?? "");
    setDays(step.defaultDueDays);
    setAssignedRoleId(step.assignedRole?.id ?? "");
    setAssignedPersonId(step.assignedPerson?.id ?? "");
  }

  async function saveStep() {
    if (!title.trim()) return;

    setPending(true);
    setError(null);

    try {
      const response = await fetch(
        editingStepId
          ? `/api/admin/registration-workflows/${templateId}/steps/${editingStepId}`
          : `/api/admin/registration-workflows/${templateId}/steps`,
        {
          method: editingStepId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description, defaultDueDays: days, assignedRoleId, assignedPersonId }),
        },
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Schritt konnte nicht gespeichert werden.");

      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Schritt konnte nicht gespeichert werden.");
    } finally {
      setPending(false);
    }
  }

  async function deleteStep(stepId: string) {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/registration-workflows/${templateId}/steps/${stepId}`, {
        method: "DELETE",
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Schritt konnte nicht gelöscht werden.");

      if (editingStepId === stepId) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Schritt konnte nicht gelöscht werden.");
    } finally {
      setPending(false);
    }
  }

  async function moveStep(step: Step, direction: "up" | "down") {
    const index = steps.findIndex((item) => item.id === step.id);
    const swapWith = direction === "up" ? steps[index - 1] : steps[index + 1];
    if (!swapWith) return;

    setPending(true);
    setError(null);

    try {
      const first = fetch(`/api/admin/registration-workflows/${templateId}/steps/${step.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...step, sortOrder: swapWith.sortOrder }),
      });

      const second = fetch(`/api/admin/registration-workflows/${templateId}/steps/${swapWith.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...swapWith, sortOrder: step.sortOrder }),
      });

      const responses = await Promise.all([first, second]);
      const failed = responses.find((response) => !response.ok);
      if (failed) {
        const payload = await failed.json().catch(() => null);
        throw new Error(payload?.error ?? "Reihenfolge konnte nicht geändert werden.");
      }

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reihenfolge konnte nicht geändert werden.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Schritte</p>
          <h4 className="text-sm font-black text-slate-950">Workflow-Ablauf</h4>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-500">
          {steps.length} Schritte
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {steps.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">
            Noch keine Schritte definiert.
          </div>
        ) : (
          steps.map((step, index) => (
            <div key={step.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-slate-400">#{index + 1}</p>
                  <h5 className="font-black text-slate-950">{step.title}</h5>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{step.description || "—"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={pending || index === 0} onClick={() => moveStep(step, "up")} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-40">Hoch</button>
                  <button type="button" disabled={pending || index === steps.length - 1} onClick={() => moveStep(step, "down")} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-40">Runter</button>
                  <button type="button" disabled={pending} onClick={() => startEdit(step)} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-black text-blue-700 hover:bg-blue-50 disabled:opacity-40">Bearbeiten</button>
                  <button type="button" disabled={pending} onClick={() => deleteStep(step.id)} className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-black text-red-600 hover:bg-red-50 disabled:opacity-40">Löschen</button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-xs font-bold text-slate-500 md:grid-cols-3">
                <p>Frist: <span className="text-slate-900">{step.defaultDueDays} Tage</span></p>
                <p>Rolle: <span className="text-slate-900">{step.assignedRole?.name ?? "—"}</span></p>
                <p>Person: <span className="text-slate-900">{personName(step.assignedPerson)}</span></p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-black text-slate-900">{editingStepId ? "Schritt bearbeiten" : "Neuen Schritt hinzufügen"}</p>
          {editingStepId ? (
            <button type="button" onClick={resetForm} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-black text-slate-600 hover:bg-slate-50">
              Abbrechen
            </button>
          ) : null}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Schritt-Titel" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-blue-300" />
          <input type="number" min={1} max={90} value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-blue-300" />
          <select value={assignedRoleId} onChange={(e) => setAssignedRoleId(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-blue-300">
            <option value="">Rolle automatisch / leer</option>
            {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
          <select value={assignedPersonId} onChange={(e) => setAssignedPersonId(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-blue-300">
            <option value="">Person automatisch / leer</option>
            {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Beschreibung / Aufgabe" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-blue-300 lg:col-span-2" />
        </div>

        {error ? <p className="mt-3 text-sm font-bold text-red-600">{error}</p> : null}

        <button type="button" disabled={pending || !title.trim()} onClick={saveStep} className="mt-4 rounded-full bg-[#0b4aa2] px-5 py-2 text-sm font-black text-white shadow-sm hover:bg-[#073a7f] disabled:opacity-40">
          {pending ? "Speichern..." : editingStepId ? "Änderungen speichern" : "Schritt hinzufügen"}
        </button>
      </div>
    </div>
  );
}

