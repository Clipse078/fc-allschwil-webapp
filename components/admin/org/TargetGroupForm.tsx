"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type TargetGroupFormProps = {
  mode: "create" | "edit";
  targetGroupId?: string;
  defaultValues?: {
    name?: string;
    key?: string;
    description?: string;
    status?: string;
  };
};

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Aktiv" },
  { value: "INACTIVE", label: "Inaktiv" },
  { value: "ARCHIVED", label: "Archiviert" },
] as const;

const labelClass =
  "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5";

export default function TargetGroupForm({
  mode,
  targetGroupId,
  defaultValues,
}: TargetGroupFormProps) {
  const router = useRouter();
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [key, setKey] = useState(defaultValues?.key ?? "");
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
    if (!name.trim()) {
      setError("Name ist erforderlich.");
      return;
    }
    setLoading(true);
    try {
      const url =
        mode === "edit"
          ? `/api/target-groups/${targetGroupId}`
          : "/api/target-groups";
      const method = mode === "edit" ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          ...(mode === "create" ? { key: key || undefined } : {}),
          description: description || null,
          status,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Fehler beim Speichern.");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (mode === "create" && data?.targetGroup?.id) {
        router.push(`/dashboard/target-groups/${data.targetGroup.id}`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="sce-form-card space-y-5">
      <div>
        <label className={labelClass}>Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="z.B. Vorstand, Kassier-Ressort"
          required
          className="fca-input"
        />
      </div>

      <div>
        <label className={labelClass}>Key</label>
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="auto-generiert aus Name"
          disabled={mode === "edit"}
          className="fca-input font-mono text-sm"
        />
        <p className="mt-1 text-[11px] text-[var(--muted)]">
          Eindeutiger Bezeichner. Wird automatisch aus dem Namen generiert.
          {mode === "edit" ? " Kann nach Erstellung nicht geändert werden." : ""}
        </p>
      </div>

      <div>
        <label className={labelClass}>Beschreibung</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Optionale Beschreibung dieser Zielgruppe"
          className="fca-input resize-none"
        />
      </div>

      <div>
        <label className={labelClass}>Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="fca-select"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="fca-button-secondary"
        >
          Abbrechen
        </button>
        <button type="submit" disabled={loading} className="fca-button-primary">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading
            ? "Speichern…"
            : mode === "create"
              ? "Zielgruppe erstellen"
              : "Änderungen speichern"}
        </button>
      </div>
    </form>
  );
}
