"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type OrgUnitOption = { id: string; key: string; name: string; level: number; type: string };

type OrgUnitFormProps = {
  mode: "create" | "edit";
  orgUnitId?: string;
  parentOptions?: OrgUnitOption[];
  defaultValues?: {
    name?: string;
    key?: string;
    type?: string;
    parentId?: string;
    description?: string;
    sortOrder?: number;
    status?: string;
  };
};

const TYPE_OPTIONS = [
  { value: "CLUB", label: "Verein (Club)" },
  { value: "DIVISION", label: "Abteilung (Division)" },
  { value: "DEPARTMENT", label: "Ressort (Department)" },
  { value: "SUB_DEPARTMENT", label: "Unterressort" },
  { value: "TEAM", label: "Mannschaft (Team)" },
  { value: "COMMITTEE", label: "Ausschuss (Committee)" },
  { value: "PROJECT_GROUP", label: "Projektgruppe" },
  { value: "CUSTOM", label: "Benutzerdefiniert" },
] as const;

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Aktiv" },
  { value: "INACTIVE", label: "Inaktiv" },
  { value: "ARCHIVED", label: "Archiviert" },
] as const;

export default function OrgUnitForm({ mode, orgUnitId, parentOptions = [], defaultValues }: OrgUnitFormProps) {
  const router = useRouter();
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [key, setKey] = useState(defaultValues?.key ?? "");
  const [type, setType] = useState(defaultValues?.type ?? "DEPARTMENT");
  const [parentId, setParentId] = useState(defaultValues?.parentId ?? "");
  const [description, setDescription] = useState(defaultValues?.description ?? "");
  const [status, setStatus] = useState(defaultValues?.status ?? "ACTIVE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate key from name
  function handleNameChange(v: string) {
    setName(v);
    if (!defaultValues?.key) {
      setKey(v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Name ist erforderlich."); return; }
    setLoading(true);
    try {
      const url = mode === "edit" ? `/api/org-units/${orgUnitId}` : "/api/org-units";
      const method = mode === "edit" ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, key: key || undefined, type, parentId: parentId || null, description: description || null, status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Fehler beim Speichern.");
        return;
      }
      router.push("/dashboard/org-units");
      router.refresh();
    } catch { setError("Netzwerkfehler."); } finally { setLoading(false); }
  }

  const fieldClass = "w-full rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0b4aa2]/30";
  const labelClass = "block text-[12px] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-1.5";

  // Filter eligible parents (exclude self, max depth 2 for parents)
  const eligibleParents = parentOptions.filter((p) => p.id !== orgUnitId && p.level <= 1);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">{error}</div> : null}

      <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <h3 className="mb-5 text-[1.05rem] font-semibold text-slate-900">Einheit</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelClass}>Name *</label>
            <input type="text" value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="z.B. Vorstand" className={fieldClass} required />
          </div>
          <div>
            <label className={labelClass}>Key (automatisch)</label>
            <input type="text" value={key} onChange={(e) => setKey(e.target.value)} placeholder="z.B. vorstand" className={`${fieldClass} font-mono text-[13px]`} />
          </div>
          <div>
            <label className={labelClass}>Typ</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={fieldClass}>
              {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Übergeordnete Einheit</label>
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={fieldClass}>
              <option value="">— Keine (Haupteinheit) —</option>
              {eligibleParents.map((p) => (
                <option key={p.id} value={p.id}>{" ".repeat(p.level * 2)}{p.name} ({p.key})</option>
              ))}
            </select>
          </div>
          {mode === "edit" ? (
            <div>
              <label className={labelClass}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={fieldClass}>
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          ) : null}
          <div className="md:col-span-2">
            <label className={labelClass}>Beschreibung</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optionale Beschreibung…" className={fieldClass} />
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={() => router.back()} className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Abbrechen</button>
        <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-6 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60 hover:bg-[#08357a]">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === "create" ? "Einheit erstellen" : "Änderungen speichern"}
        </button>
      </div>
    </form>
  );
}
