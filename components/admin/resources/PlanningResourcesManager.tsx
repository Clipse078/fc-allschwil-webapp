"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ResourceType = "PITCH" | "DRESSING_ROOM" | "HALL" | "OTHER";

type PlanningResourceItem = {
  id: string;
  key: string;
  name: string;
  type: ResourceType;
  sortOrder: number;
  isActive: boolean;
  notes: string | null;
};

type PlanningResourcesManagerProps = {
  resources: PlanningResourceItem[];
};

const resourceTypes: { value: ResourceType; label: string }[] = [
  { value: "PITCH", label: "Spielfeld" },
  { value: "DRESSING_ROOM", label: "Garderobe" },
  { value: "HALL", label: "Halle" },
  { value: "OTHER", label: "Sonstige Ressource" },
];

function typeLabel(type: ResourceType) {
  return resourceTypes.find((item) => item.value === type)?.label ?? type;
}

export default function PlanningResourcesManager({ resources }: PlanningResourcesManagerProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [type, setType] = useState<ResourceType>("PITCH");
  const [sortOrder, setSortOrder] = useState("999");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function createResource() {
    if (!name.trim()) {
      setError("Name fehlt.");
      return;
    }

    setPendingId("new");
    setError(null);

    const response = await fetch("/api/planning-resources", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        key,
        type,
        sortOrder,
        notes,
      }),
    });

    setPendingId(null);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error ?? "Ressource konnte nicht erstellt werden.");
      return;
    }

    setName("");
    setKey("");
    setType("PITCH");
    setSortOrder("999");
    setNotes("");
    router.refresh();
  }

  async function patchResource(id: string, body: Record<string, unknown>) {
    setPendingId(id);
    setError(null);

    const response = await fetch(`/api/planning-resources/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    setPendingId(null);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error ?? "Ressource konnte nicht gespeichert werden.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600">
          Infrastruktur
        </p>
        <h2 className="mt-1 text-2xl font-black uppercase tracking-tight text-[#0b4aa2]">
          Neue Ressource
        </h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Spielfelder, Garderoben, Hallen oder sonstige Ressourcen zentral verwalten.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr_0.7fr_0.45fr]">
          <label className="block space-y-2">
            <span className="fca-label">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="fca-input"
              placeholder="z.B. Kunstrasen 4 Feld A"
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Technischer Key</span>
            <input
              value={key}
              onChange={(event) => setKey(event.target.value)}
              className="fca-input"
              placeholder="optional, z.B. kunstrasen-4-feld-a"
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Typ</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as ResourceType)}
              className="fca-select"
            >
              {resourceTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Sortierung</span>
            <input
              type="number"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              className="fca-input"
            />
          </label>

          <label className="block space-y-2 lg:col-span-4">
            <span className="fca-label">Notizen</span>
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="fca-input"
              placeholder="optional"
            />
          </label>
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={createResource}
          disabled={pendingId === "new"}
          className="mt-5 rounded-full bg-[#0b4aa2] px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#083a7d] disabled:opacity-50"
        >
          Ressource hinzufügen
        </button>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600">
            Ressourcenverwaltung
          </p>
          <h2 className="mt-1 text-2xl font-black uppercase tracking-tight text-[#0b4aa2]">
            Spielfelder & Garderoben
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Gebrauchte Ressourcen nie löschen, sondern deaktivieren. So bleiben alte Pläne historisch korrekt.
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {resources.map((resource) => (
            <div
              key={resource.id}
              className="grid gap-4 px-6 py-5 lg:grid-cols-[1.2fr_0.75fr_0.55fr_0.5fr_0.6fr] lg:items-center"
            >
              <div>
                <p className="text-lg font-black text-slate-950">{resource.name}</p>
                <p className="text-xs font-bold text-slate-400">{resource.key}</p>
                {resource.notes ? (
                  <p className="mt-1 text-sm font-medium text-slate-500">{resource.notes}</p>
                ) : null}
              </div>

              <select
                value={resource.type}
                disabled={pendingId === resource.id}
                onChange={(event) => patchResource(resource.id, { type: event.target.value })}
                className="fca-select"
              >
                {resourceTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>

              <input
                type="number"
                defaultValue={resource.sortOrder}
                disabled={pendingId === resource.id}
                onBlur={(event) =>
                  patchResource(resource.id, { sortOrder: Number(event.target.value) })
                }
                className="fca-input"
              />

              <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
                Aktiv
                <input
                  type="checkbox"
                  checked={resource.isActive}
                  disabled={pendingId === resource.id}
                  onChange={(event) =>
                    patchResource(resource.id, { isActive: event.target.checked })
                  }
                  className="h-5 w-5"
                />
              </label>

              <span
                className={[
                  "rounded-full px-4 py-2 text-center text-xs font-black uppercase tracking-[0.14em]",
                  resource.isActive
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border border-slate-200 bg-slate-100 text-slate-500",
                ].join(" ")}
              >
                {resource.isActive ? "Verfügbar" : "Inaktiv"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
