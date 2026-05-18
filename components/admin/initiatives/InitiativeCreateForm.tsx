"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUS_OPTIONS = [
  { value: "DRAFT",  label: "Entwurf" },
  { value: "ACTIVE", label: "Aktiv" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "LOW",      label: "Niedrig" },
  { value: "MEDIUM",   label: "Mittel" },
  { value: "HIGH",     label: "Hoch" },
  { value: "CRITICAL", label: "Kritisch" },
] as const;

function formatDateInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function defaultDueDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return formatDateInput(d);
}

export default function InitiativeCreateForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const title       = String(form.get("title")       ?? "").trim();
    const summary     = String(form.get("summary")     ?? "").trim() || null;
    const description = String(form.get("description") ?? "").trim() || null;
    const status      = String(form.get("status")      ?? "DRAFT");
    const priority    = String(form.get("priority")    ?? "MEDIUM");
    const orgUnitLabel = String(form.get("orgUnitLabel") ?? "").trim() || null;
    const ownerName    = String(form.get("ownerName")    ?? "").trim() || null;
    const dueDate      = String(form.get("dueDate")      ?? "").trim() || null;

    if (!title) { setError("Titel ist erforderlich."); setSubmitting(false); return; }

    try {
      const response = await fetch("/api/initiatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, summary, description, status, priority,
          orgUnitLabel, ownerName,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error ?? "Initiative konnte nicht erstellt werden."); setSubmitting(false); return; }
      router.push(`/initiatives/${data.initiative.id}`);
    } catch {
      setError("Ein Netzwerkfehler ist aufgetreten.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error ? <div className="fca-status-box fca-status-box-error mb-6">{error}</div> : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <label className="block">
            <span className="fca-label">Titel <span className="text-red-500">*</span></span>
            <input type="text" name="title" required maxLength={200} placeholder="z.B. Frauenfussball Offensive" className="fca-input mt-2" autoFocus />
          </label>
        </div>

        <div className="lg:col-span-2">
          <label className="block">
            <span className="fca-label">Kurzbeschreibung</span>
            <input type="text" name="summary" maxLength={300} placeholder="Ein-Satz-Zusammenfassung für Listenansichten" className="fca-input mt-2" />
          </label>
        </div>

        <div>
          <label className="block">
            <span className="fca-label">Status</span>
            <select name="status" defaultValue="DRAFT" className="fca-select mt-2">
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>

        <div>
          <label className="block">
            <span className="fca-label">Priorität</span>
            <select name="priority" defaultValue="MEDIUM" className="fca-select mt-2">
              {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>

        <div>
          <label className="block">
            <span className="fca-label">Org-Einheit</span>
            <input type="text" name="orgUnitLabel" maxLength={100} placeholder="z.B. Vereinsleitung" className="fca-input mt-2" />
          </label>
        </div>

        <div>
          <label className="block">
            <span className="fca-label">Verantwortlich</span>
            <input type="text" name="ownerName" maxLength={100} placeholder="Name der verantwortlichen Person" className="fca-input mt-2" />
          </label>
        </div>

        <div>
          <label className="block">
            <span className="fca-label">Fälligkeit</span>
            <input type="date" name="dueDate" defaultValue={defaultDueDate()} className="fca-input mt-2" />
          </label>
        </div>

        <div className="lg:col-span-2">
          <label className="block">
            <span className="fca-label">Beschreibung</span>
            <textarea name="description" rows={3} maxLength={2000} placeholder="Ausführliche Beschreibung der Initiative…" className="fca-textarea mt-2" />
          </label>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={submitting}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0b4aa2] px-6 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a] disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? "Wird erstellt…" : "Initiative erstellen"}
        </button>
        <Link href="/initiatives"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:bg-slate-50">
          Abbrechen
        </Link>
      </div>
    </form>
  );
}
