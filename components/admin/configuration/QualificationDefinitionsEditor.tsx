"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Save } from "lucide-react";

type QualificationDefinitionItem = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
};

type Props = {
  clubConfigId: string | null;
  definitions: QualificationDefinitionItem[];
};

const qualificationTypes = [
  { value: "DIPLOMA", label: "Diplom" },
  { value: "CERTIFICATE", label: "Zertifikat" },
  { value: "COURSE", label: "Kurs" },
  { value: "WORKSHOP", label: "Workshop" },
  { value: "FIRST_AID", label: "First Aid" },
  { value: "OTHER", label: "Andere" },
];

export default function QualificationDefinitionsEditor({ clubConfigId, definitions }: Props) {
  const initialItems = useMemo(() => definitions, [definitions]);
  const [items, setItems] = useState(initialItems);
  const [newItem, setNewItem] = useState({
    name: "",
    type: "DIPLOMA",
    description: "",
  });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateItem(id: string, field: keyof QualificationDefinitionItem, value: string | boolean) {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }

  function createDefinition() {
    if (!clubConfigId) {
      setMessage("❌ ClubConfig fehlt.");
      return;
    }

    setCreating(true);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/qualification-definitions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clubConfigId,
            name: newItem.name,
            type: newItem.type,
            description: newItem.description,
          }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Qualifikation konnte nicht erstellt werden.");
        }

        setItems((current) => [...current, payload.definition]);
        setNewItem({ name: "", type: "DIPLOMA", description: "" });
        setMessage("✅ Qualifikation erstellt.");
      } catch (error) {
        setMessage(error instanceof Error ? `❌ ${error.message}` : "❌ Qualifikation konnte nicht erstellt werden.");
      } finally {
        setCreating(false);
      }
    });
  }

  function saveDefinition(id: string) {
    const item = items.find((candidate) => candidate.id === id);
    if (!item) return;

    setSavingId(id);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/qualification-definitions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: item.name,
            type: item.type,
            description: item.description ?? "",
            isActive: item.isActive,
          }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Qualifikation konnte nicht gespeichert werden.");
        }

        setItems((current) =>
          current.map((candidate) => (candidate.id === id ? payload.definition : candidate))
        );
        setMessage("✅ Qualifikation gespeichert.");
      } catch (error) {
        setMessage(error instanceof Error ? `❌ ${error.message}` : "❌ Qualifikation konnte nicht gespeichert werden.");
      } finally {
        setSavingId(null);
      }
    });
  }

  return (
    <div className="mt-5 space-y-3">
      <div className="rounded-[24px] border border-blue-100 bg-blue-50/60 p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_1fr_auto] lg:items-end">
          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Neue Qualifikation</span>
            <input
              value={newItem.name}
              onChange={(event) => setNewItem((current) => ({ ...current, name: event.target.value }))}
              placeholder="z.B. First Aid"
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Typ</span>
            <select
              value={newItem.type}
              onChange={(event) => setNewItem((current) => ({ ...current, type: event.target.value }))}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300"
            >
              {qualificationTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Beschreibung</span>
            <input
              value={newItem.description}
              onChange={(event) => setNewItem((current) => ({ ...current, description: event.target.value }))}
              placeholder="Optional"
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300"
            />
          </label>

          <button
            type="button"
            onClick={createDefinition}
            disabled={isPending || creating || !newItem.name.trim()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#0b4aa2]/20 bg-white px-5 text-sm font-black text-[#0b4aa2] shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {creating ? "Erstellt..." : "Hinzufügen"}
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="grid gap-3 lg:grid-cols-[1fr_200px_1fr_140px_auto] lg:items-end">
              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Name</span>
                <input
                  value={item.name}
                  onChange={(event) => updateItem(item.id, "name", event.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Typ</span>
                <select
                  value={item.type}
                  onChange={(event) => updateItem(item.id, "type", event.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300"
                >
                  {qualificationTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Beschreibung</span>
                <input
                  value={item.description ?? ""}
                  onChange={(event) => updateItem(item.id, "description", event.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300"
                />
              </label>

              <label className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={item.isActive}
                  onChange={(event) => updateItem(item.id, "isActive", event.target.checked)}
                  className="h-4 w-4"
                />
                Aktiv
              </label>

              <button
                type="button"
                onClick={() => saveDefinition(item.id)}
                disabled={isPending || savingId === item.id}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-5 text-sm font-black text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {savingId === item.id ? "Speichert..." : "Speichern"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {message ? (
        <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">
          {message}
        </div>
      ) : null}
    </div>
  );
}
