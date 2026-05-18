"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUS_OPTIONS = [
  { value: "DRAFT",     label: "Entwurf" },
  { value: "ACTIVE",    label: "Aktiv" },
  { value: "PAUSED",    label: "Pausiert" },
  { value: "ACHIEVED",  label: "Erreicht" },
  { value: "MISSED",    label: "Verfehlt" },
  { value: "CANCELLED", label: "Abgesagt" },
] as const;

const PERIOD_OPTIONS = [
  { value: "",           label: "— kein Zeitraum —" },
  { value: "ONCE",       label: "Einmalig" },
  { value: "MONTHLY",    label: "Monatlich" },
  { value: "QUARTERLY",  label: "Quartalsweise" },
  { value: "SEASONAL",   label: "Saisonweise" },
  { value: "ANNUAL",     label: "Jährlich" },
  { value: "MULTI_YEAR", label: "Mehrjährig" },
] as const;

const AGE_GROUP_OPTIONS = [
  { value: "",               label: "— keine Altersgruppe —" },
  { value: "Kinderfussball", label: "Kinderfussball" },
  { value: "Junioren",       label: "Junioren" },
  { value: "Frauen",         label: "Frauen" },
  { value: "Aktive",         label: "Aktive" },
  { value: "Senioren",       label: "Senioren" },
] as const;

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type TargetEditInitialValues = {
  title: string; description: string | null; status: string; periodType: string | null;
  startsAt: Date | null; endsAt: Date | null; orgUnitLabel: string | null;
  moduleKey: string | null; targetCategory: string | null; sportCategory: string | null;
  ageGroupHint: string | null;
};

type Props = { id: string; initialValues: TargetEditInitialValues };

export default function TargetEditForm({ id, initialValues }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    if (!title) { setError("Titel ist erforderlich."); setSubmitting(false); return; }

    const raw = (k: string) => String(form.get(k) ?? "").trim() || null;
    const rawDate = (k: string) => { const v = String(form.get(k) ?? "").trim(); return v ? new Date(v).toISOString() : null; };

    const payload = {
      title, description: raw("description"), status: String(form.get("status") ?? "").trim(),
      periodType: String(form.get("periodType") ?? "").trim() || null,
      startsAt: rawDate("startsAt"), endsAt: rawDate("endsAt"),
      orgUnitLabel: raw("orgUnitLabel"), moduleKey: raw("moduleKey"),
      targetCategory: raw("targetCategory"), ageGroupHint: String(form.get("ageGroupHint") ?? "").trim() || null,
    };

    try {
      const response = await fetch(`/api/targets/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error ?? "Ziel konnte nicht gespeichert werden."); setSubmitting(false); return; }
      router.push(`/targets/${id}`);
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
          <label className="block"><span className="fca-label">Titel <span className="text-red-500">*</span></span>
            <input type="text" name="title" required maxLength={200} defaultValue={initialValues.title} className="fca-input mt-2" />
          </label>
        </div>
        <div className="lg:col-span-2">
          <label className="block"><span className="fca-label">Beschreibung</span>
            <textarea name="description" rows={2} maxLength={1000} defaultValue={initialValues.description ?? ""} className="fca-textarea mt-2" />
          </label>
        </div>

        <div>
          <label className="block"><span className="fca-label">Status</span>
            <select name="status" defaultValue={initialValues.status} className="fca-select mt-2">
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
        <div>
          <label className="block"><span className="fca-label">Zeitraum-Typ</span>
            <select name="periodType" defaultValue={initialValues.periodType ?? ""} className="fca-select mt-2">
              {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>

        <div>
          <label className="block"><span className="fca-label">Startdatum</span>
            <input type="date" name="startsAt" defaultValue={fmtDate(initialValues.startsAt)} className="fca-input mt-2" />
          </label>
        </div>
        <div>
          <label className="block"><span className="fca-label">Enddatum / Fälligkeit</span>
            <input type="date" name="endsAt" defaultValue={fmtDate(initialValues.endsAt)} className="fca-input mt-2" />
          </label>
        </div>

        <div>
          <label className="block"><span className="fca-label">Org-Einheit</span>
            <input type="text" name="orgUnitLabel" maxLength={100} defaultValue={initialValues.orgUnitLabel ?? ""} className="fca-input mt-2" />
          </label>
        </div>
        <div>
          <label className="block"><span className="fca-label">Altersgruppe</span>
            <select name="ageGroupHint" defaultValue={initialValues.ageGroupHint ?? ""} className="fca-select mt-2">
              {AGE_GROUP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>

        <div>
          <label className="block"><span className="fca-label">Modul-Kontext</span>
            <input type="text" name="moduleKey" maxLength={80} defaultValue={initialValues.moduleKey ?? ""} className="fca-input mt-2" />
          </label>
        </div>
        <div>
          <label className="block"><span className="fca-label">Zielkategorie</span>
            <input type="text" name="targetCategory" maxLength={80} defaultValue={initialValues.targetCategory ?? ""} className="fca-input mt-2" />
          </label>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={submitting} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0b4aa2] px-6 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a] disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? "Wird gespeichert…" : "Änderungen speichern"}
        </button>
        <Link href={`/targets/${id}`} className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:bg-slate-50">Abbrechen</Link>
      </div>
    </form>
  );
}
