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
    visibleOrgUnitRefs?: string[];
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
  const [visibleOrgUnitRefs, setVisibleOrgUnitRefs] = useState<string[]>(
    defaultValues?.visibleOrgUnitRefs ?? [],
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
        visibleOrgUnitRefs: visibilityScope === "RESTRICTED" ? visibleOrgUnitRefs : [],
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
    "sce-form-field";
  const labelClass =
    "sce-kicker mb-1.5 block";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="fca-status-box fca-status-box-error px-5 py-4 font-medium">
          {error}
        </div>
      ) : null}

      <section className="sce-page-card p-6">
        <h3 className="sce-section-title mb-5">Grunddaten</h3>

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

      <section className="sce-page-card p-6">
        <h3 className="sce-section-title mb-2">Sichtbarkeit</h3>
        <p className="mb-5 text-[12px] text-[var(--sce-muted)]">
          Wer kann diese Initiative sehen? Privat und Eingeschränkt
          verbergen diesen Eintrag für nicht berechtigte Benutzer.
        </p>
        <VisibilityScopeSelect value={visibilityScope} onChange={setVisibilityScope} />
        <AllowlistPanel
          visibilityScope={visibilityScope}
          visibleOrgUnitRefs={visibleOrgUnitRefs}
          visibleRoleRefs={visibleRoleRefs}
          visibleUserRefs={visibleUserRefs}
          onOrgUnitsChange={setVisibleOrgUnitRefs}
          onRolesChange={setVisibleRoleRefs}
          onUsersChange={setVisibleUserRefs}
        />
      </section>

      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="sce-action-secondary px-5 py-2.5 text-sm font-medium"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={loading}
          className="sce-action-primary px-6 py-2.5 text-sm disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === "create" ? "Initiative erstellen" : "Änderungen speichern"}
        </button>
      </div>
    </form>
  );
}
