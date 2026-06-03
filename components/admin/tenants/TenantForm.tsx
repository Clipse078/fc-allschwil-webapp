"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type TenantFormProps = {
  mode: "create" | "edit";
  tenantKey?: string;
  defaultValues?: {
    name?: string;
    status?: string;
  };
};

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Aktiv" },
  { value: "INACTIVE", label: "Inaktiv" },
] as const;

export default function TenantForm({ mode, tenantKey, defaultValues }: TenantFormProps) {
  const router = useRouter();
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [key, setKey] = useState("");
  const [status, setStatus] = useState(defaultValues?.status ?? "ACTIVE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNameChange(v: string) {
    setName(v);
    if (mode === "create") {
      setKey(v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let res: Response;
      if (mode === "create") {
        res = await fetch("/api/tenants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), key: key.trim() }),
        });
      } else {
        res = await fetch(`/api/tenants/${tenantKey}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), status }),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Unbekannter Fehler.");
        return;
      }

      router.push("/dashboard/admin/tenants");
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  const labelClass = "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="sce-detail-section">
        <div className="sce-detail-section-body space-y-5">

          <div>
            <label htmlFor="tenant-name" className={labelClass}>Name *</label>
            <input
              id="tenant-name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="z.B. FC Allschwil"
              required
              className="fca-input"
            />
          </div>

          {mode === "create" && (
            <div>
              <label htmlFor="tenant-key" className={labelClass}>Key (URL-Slug)</label>
              <input
                id="tenant-key"
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="z.B. fc-allschwil"
                className="fca-input font-mono"
              />
              <p className="mt-1.5 text-[11px] text-[var(--muted)]">
                Nur Kleinbuchstaben, Ziffern und Bindestriche. Wird automatisch aus dem Namen abgeleitet.
              </p>
            </div>
          )}

          {mode === "edit" && (
            <div>
              <label htmlFor="tenant-status" className={labelClass}>Status</label>
              <select
                id="tenant-status"
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
          )}

        </div>
      </div>

      {error && (
        <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="fca-button-primary"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading
            ? mode === "create"
              ? "Erstellen…"
              : "Speichern…"
            : mode === "create"
              ? "Tenant erstellen"
              : "Änderungen speichern"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="fca-button-secondary"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
