"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUS_OPTIONS = [
  { value: "DRAFT",     label: "Entwurf" },
  { value: "ACTIVE",    label: "Aktiv" },
  { value: "PAUSED",    label: "Pausiert" },
  { value: "COMPLETED", label: "Abgeschlossen" },
  { value: "CANCELLED", label: "Abgesagt" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "LOW",      label: "Niedrig" },
  { value: "MEDIUM",   label: "Mittel" },
  { value: "HIGH",     label: "Hoch" },
  { value: "CRITICAL", label: "Kritisch" },
] as const;

function formatDateInput(date: Date | null | undefined): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type InitiativeEditInitialValues = {
  title:        string;
  summary:      string | null;
  description:  string | null;
  status:       string;
  priority:     string;
  orgUnitLabel: string | null;
  ownerName:    string | null;
  dueDate:      Date | null;
  startsAt:     Date | null;
  completedAt:  Date | null;
};

type Props = { id: string; initialValues: InitiativeEditInitialValues };

export default function InitiativeEditForm({ id, initialValues }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const title       = String(form.get("title")       ?? "").trim();
    if (!title) { setError("Titel ist erforderlich."); setSubmitting(false); return; }

    const dueDateRaw    = String(form.get("dueDate")    ?? "").trim();
    const startsAtRaw   = String(form.get("startsAt")   ?? "").trim();
    const completedAtRaw = String(form.get("completedAt") ?? "").trim();

    const payload: Record<string, unknown> = {
      title,
      summary:      String(form.get("summary")      ?? "").trim() || null,
      description:  String(form.get("description")  ?? "").trim() || null,
      status:       String(form.get("status")        ?? "").trim(),
      priority:     String(form.get("priority")      ?? "").trim(),
      orgUnitLabel: String(form.get("orgUnitLabel")  ?? "").trim() || null,
      ownerName:    String(form.get("ownerName")     ?? "").trim() || null,
      dueDate:      dueDateRaw    ? new Date(dueDateRaw).toISOString()    : null,
      startsAt:     startsAtRaw   ? new Date(startsAtRaw).toISOString()   : null,
      completedAt:  completedAtRaw ? new Date(completedAtRaw).toISOString() : null,
    };

    try {
      const response = await fetch(`/api/initiatives/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error ?? "Änderungen konnten nicht gespeichert werden."); setSubmitting(false); return; }
      router.push(`/initiatives/${id}`);
      router.refresh();
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
            <input type="text" name="title" required maxLength={200} defaultValue={initialValues.title} className="fca-input mt-2" />
          </label>
        </div>

        <div className="lg:col-span-2">
          <label className="block">
            <span className="fca-label">Kurzbeschreibung</span>
            <input type="text" name="summary" maxLength={300} defaultValue={initialValues.summary ?? ""} className="fca-input mt-2" />
          </label>
        </div>

        <div>
          <label className="block">
            <span className="fca-label">Status</span>
            <select name="status" defaultValue={initialValues.status} className="fca-select mt-2">
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>

        <div>
          <label className="block">
            <span className="fca-label">Priorität</span>
            <select name="priority" defaultValue={initialValues.priority} className="fca-select mt-2">
              {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>

        <div>
          <label className="block">
            <span className="fca-label">Org-Einheit</span>
            <input type="text" name="orgUnitLabel" maxLength={100} defaultValue={initialValues.orgUnitLabel ?? ""} className="fca-input mt-2" />
          </label>
        </div>

        <div>
          <label className="block">
            <span className="fca-label">Verantwortlich</span>
            <input type="text" name="ownerName" maxLength={100} defaultValue={initialValues.ownerName ?? ""} className="fca-input mt-2" />
          </label>
        </div>

        <div>
          <label className="block">
            <span className="fca-label">Startdatum</span>
            <input type="date" name="startsAt" defaultValue={formatDateInput(initialValues.startsAt)} className="fca-input mt-2" />
          </label>
        </div>

        <div>
          <label className="block">
            <span className="fca-label">Fälligkeit</span>
            <input type="date" name="dueDate" defaultValue={formatDateInput(initialValues.dueDate)} className="fca-input mt-2" />
          </label>
        </div>

        <div>
          <label className="block">
            <span className="fca-label">Abschlussdatum</span>
            <input type="date" name="completedAt" defaultValue={formatDateInput(initialValues.completedAt)} className="fca-input mt-2" />
            <p className="mt-1 text-xs text-slate-400">Nur setzen wenn Initiative abgeschlossen ist.</p>
          </label>
        </div>

        <div className="lg:col-span-2">
          <label className="block">
            <span className="fca-label">Beschreibung</span>
            <textarea name="description" rows={4} maxLength={2000} defaultValue={initialValues.description ?? ""} className="fca-textarea mt-2" />
          </label>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={submitting}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0b4aa2] px-6 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a] disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? "Wird gespeichert…" : "Änderungen speichern"}
        </button>
        <Link href={`/initiatives/${id}`}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:bg-slate-50">
          Abbrechen
        </Link>
      </div>
    </form>
  );
}
