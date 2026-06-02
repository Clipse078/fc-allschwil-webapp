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

const labelClass =
  "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5";

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

  function handleNameChange(v: string) {
    setName(v);
    if (mode === "create" && !defaultValues?.key) {
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
        body: JSON.stringify({
          name,
          ...(mode === "create" ? { key: key || undefined } : {}),
          type,
          parentId: parentId || null,
          description: description || null,
          status,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Fehler beim Speichern.");
        return;
      }
      router.push(mode === "edit" && orgUnitId ? `/dashboard/org-units/${orgUnitId}` : "/dashboard/org-units");
      router.refresh();
    } catch { setError("Netzwerkfehler."); } finally { setLoading(false); }
  }

  const eligibleParents = parentOptions.filter((p) => p.id !== orgUnitId && p.level <= 1);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            Einheit
          </p>
        </div>
        <div className="sce-detail-section-body">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={labelClass}>Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="z.B. Vorstand"
                className="fca-input"
                required
              />
            </div>

            <div>
              <label className={labelClass}>
                {mode === "edit" ? "Key (unveränderlich)" : "Key (automatisch)"}
              </label>
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="z.B. vorstand"
                readOnly={mode === "edit"}
                aria-readonly={mode === "edit"}
                className={`fca-input font-mono text-[13px]${mode === "edit" ? " cursor-not-allowed" : ""}`}
              />
            </div>

            <div>
              <label className={labelClass}>Typ</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="fca-select"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Übergeordnete Einheit</label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="fca-select"
              >
                <option value="">— Keine (Haupteinheit) —</option>
                {eligibleParents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {"\u00A0".repeat(p.level * 4)}{p.name} ({p.key})
                  </option>
                ))}
              </select>
            </div>

            {mode === "edit" ? (
              <div>
                <label className={labelClass}>Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="fca-select"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="md:col-span-2">
              <label className={labelClass}>Beschreibung</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Optionale Beschreibung der Organisationseinheit…"
                className="fca-textarea"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={() => router.back()} className="fca-button-secondary">
          Abbrechen
        </button>
        <button type="submit" disabled={loading} className="fca-button-primary">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === "create" ? "Einheit erstellen" : "Änderungen speichern"}
        </button>
      </div>
    </form>
  );
}
