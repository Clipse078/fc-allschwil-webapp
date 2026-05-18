"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import VisibilityScopeSelect, {
  type VisibilityScopeValue,
} from "@/components/admin/shared/VisibilityScopeSelect";
import AllowlistPanel from "@/components/admin/shared/visibility/AllowlistPanel";

type InitiativeFormProps = {
  mode: "create" | "edit";
  initiativeId?: string;
  defaultValues?: {
    title?: string;
    summary?: string;
    description?: string;
    status?: string;
    owner?: string;
    progress?: string;
    dueDate?: string;
    visibilityScope?: VisibilityScopeValue;
    visibleRoleRefs?: string[];
    visibleUserRefs?: string[];
  };
};

const STATUS_OPTIONS = [
  { value: "PLANNED", label: "Geplant" },
  { value: "IN_PROGRESS", label: "In Arbeit" },
  { value: "ON_TRACK", label: "On Track" },
  { value: "ON_HOLD", label: "Pausiert" },
  { value: "COMPLETED", label: "Abgeschlossen" },
  { value: "CANCELLED", label: "Abgesagt" },
] as const;

export default function InitiativeForm({ mode, initiativeId, defaultValues }: InitiativeFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState(defaultValues?.title ?? "");
  const [summary, setSummary] = useState(defaultValues?.summary ?? "");
  const [description, setDescription] = useState(defaultValues?.description ?? "");
  const [status, setStatus] = useState(defaultValues?.status ?? "PLANNED");
  const [owner, setOwner] = useState(defaultValues?.owner ?? "");
  const [progress, setProgress] = useState(defaultValues?.progress ?? "");
  const [dueDate, setDueDate] = useState(defaultValues?.dueDate ?? "");
  const [visibilityScope, setVisibilityScope] = useState<VisibilityScopeValue>(
    defaultValues?.visibilityScope ?? "ORGANISATION",
  );
  const [visibleRoleRefs, setVisibleRoleRefs] = useState<string[]>(
    defaultValues?.visibleRoleRefs ?? [],
  );
  const [visibleUserRefs, setVisibleUserRefs] = useState<string[]>(
    defaultValues?.visibleUserRefs ?? [],
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Titel ist erforderlich.");
      return;
    }

    setLoading(true);
    try {
      const rawProgress = progress !== "" ? Number(progress) : null;
      const payload = {
        title: title.trim(),
        summary: summary.trim() || null,
        description: description.trim() || null,
        status,
        owner: owner.trim() || null,
        progress: rawProgress !== null && rawProgress >= 0 && rawProgress <= 100 ? rawProgress : null,
        dueDate: dueDate || null,
        visibilityScope,
        visibleRoleRefs: visibilityScope === "RESTRICTED" ? visibleRoleRefs : [],
        visibleUserRefs: visibilityScope === "RESTRICTED" ? visibleUserRefs : [],
      };

      const url = mode === "edit" ? `/api/initiatives/${initiativeId}` : "/api/initiatives";
      const method = mode === "edit" ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Fehler beim Speichern.");
        return;
      }

      router.push("/vereinsleitung/initiativen?status=saved");
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  const fieldClass =
    "w-full rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0b4aa2]/30";
  const labelClass =
    "block text-[12px] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <h3 className="mb-5 text-[1.05rem] font-semibold text-slate-900">Grunddaten</h3>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelClass}>Titel *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. Website Relaunch"
              className={fieldClass}
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Zusammenfassung</label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Kurze Zusammenfassung…"
              className={fieldClass}
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ausführliche Beschreibung…"
              rows={4}
              className={fieldClass}
            />
          </div>

          <div>
            <label className={labelClass}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={fieldClass}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Verantwortlich</label>
            <input
              type="text"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="z.B. Michael Weber"
              className={fieldClass}
            />
          </div>

          <div>
            <label className={labelClass}>Fortschritt (0–100)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(e.target.value)}
              placeholder="z.B. 65"
              className={fieldClass}
            />
          </div>

          <div>
            <label className={labelClass}>Fällig bis</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={fieldClass}
            />
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <h3 className="mb-2 text-[1.05rem] font-semibold text-slate-900">Sichtbarkeit</h3>
        <p className="mb-5 text-[12px] text-slate-500">
          Wer kann diese Initiative sehen? Privat und Eingeschränkt
          verbergen diesen Eintrag für nicht berechtigte Benutzer.
        </p>
        <VisibilityScopeSelect value={visibilityScope} onChange={setVisibilityScope} />
        <AllowlistPanel
          visibilityScope={visibilityScope}
          visibleRoleRefs={visibleRoleRefs}
          visibleUserRefs={visibleUserRefs}
          onRolesChange={setVisibleRoleRefs}
          onUsersChange={setVisibleUserRefs}
        />
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
          {mode === "create" ? "Initiative erstellen" : "Änderungen speichern"}
        </button>
      </div>
    </form>
  );
}
