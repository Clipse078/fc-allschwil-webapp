"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type TeamFormProps = {
  mode: "create" | "edit";
  clubId: string;
  teamId?: string;
  defaultValues?: {
    name?: string;
    shortName?: string;
    alternativeName?: string;
    categoryLabel?: string;
  };
};

const fieldClass =
  "w-full rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0b4aa2]/30";
const labelClass = "block text-[12px] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-1.5";

export default function TeamForm({ mode, clubId, teamId, defaultValues }: TeamFormProps) {
  const router = useRouter();
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [shortName, setShortName] = useState(defaultValues?.shortName ?? "");
  const [alternativeName, setAlternativeName] = useState(defaultValues?.alternativeName ?? "");
  const [categoryLabel, setCategoryLabel] = useState(defaultValues?.categoryLabel ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          ? `/api/club-directory/teams/${teamId}`
          : `/api/club-directory/clubs/${clubId}/teams`;
      const method = mode === "edit" ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          shortName: shortName || null,
          alternativeName: alternativeName || null,
          categoryLabel: categoryLabel || null,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error ?? "Fehler beim Speichern.");
        return;
      }

      router.push(`/dashboard/vereine/${clubId}`);
      router.refresh();
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <h3 className="mb-5 text-[1.05rem] font-semibold text-slate-900">Teamdaten</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelClass}>Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. SV Muttenz B1"
              className={fieldClass}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Kurzname</label>
            <input
              type="text"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="z.B. B1"
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Alternativname</label>
            <input
              type="text"
              value={alternativeName}
              onChange={(e) => setAlternativeName(e.target.value)}
              placeholder="Optional"
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Kategorie / Altersgruppe</label>
            <input
              type="text"
              value={categoryLabel}
              onChange={(e) => setCategoryLabel(e.target.value)}
              placeholder="z.B. Junioren B, Herren 1"
              className={fieldClass}
            />
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-6 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60 hover:bg-[#08357a]"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === "create" ? "Team erstellen" : "Änderungen speichern"}
        </button>
      </div>
    </form>
  );
}
