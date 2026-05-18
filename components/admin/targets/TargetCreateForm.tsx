"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUS_OPTIONS = [
  { value: "DRAFT",  label: "Entwurf" },
  { value: "ACTIVE", label: "Aktiv" },
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

function formatDateInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function defaultEndsAt(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return formatDateInput(d);
}

export default function TargetCreateForm() {
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

    const payload: Record<string, unknown> = {
      title,
      description:    String(form.get("description")    ?? "").trim() || undefined,
      status:         String(form.get("status")          ?? "DRAFT"),
      periodType:     String(form.get("periodType")      ?? "") || undefined,
      endsAt:         String(form.get("endsAt")          ?? "") ? new Date(String(form.get("endsAt"))).toISOString() : undefined,
      startsAt:       String(form.get("startsAt")        ?? "") ? new Date(String(form.get("startsAt"))).toISOString() : undefined,
      orgUnitLabel:   String(form.get("orgUnitLabel")    ?? "").trim() || undefined,
      moduleKey:      String(form.get("moduleKey")       ?? "").trim() || undefined,
      targetCategory: String(form.get("targetCategory")  ?? "").trim() || undefined,
      ageGroupHint:   String(form.get("ageGroupHint")    ?? "") || undefined,
    };

    try {
      const response = await fetch("/api/targets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error ?? "Ziel konnte nicht erstellt werden."); setSubmitting(false); return; }
      router.push(`/targets/${data.target.id}`);
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
            <input type="text" name="title" required maxLength={200} placeholder="z.B. Frauenfussball Offensive: +3 Teams in 4 Jahren" className="fca-input mt-2" autoFocus />
          </label>
        </div>
        <div className="lg:col-span-2">
          <label className="block"><span className="fca-label">Beschreibung</span>
            <textarea name="description" rows={2} maxLength={1000} placeholder="Hintergrund und Kontext des Ziels…" className="fca-textarea mt-2" />
          </label>
        </div>

        <div>
          <label className="block"><span className="fca-label">Status</span>
            <select name="status" defaultValue="DRAFT" className="fca-select mt-2">
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
        <div>
          <label className="block"><span className="fca-label">Zeitraum-Typ</span>
            <select name="periodType" defaultValue="" className="fca-select mt-2">
              {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>

        <div>
          <label className="block"><span className="fca-label">Startdatum</span>
            <input type="date" name="startsAt" className="fca-input mt-2" />
          </label>
        </div>
        <div>
          <label className="block"><span className="fca-label">Enddatum / Fälligkeit</span>
            <input type="date" name="endsAt" defaultValue={defaultEndsAt()} className="fca-input mt-2" />
          </label>
        </div>

        <div>
          <label className="block"><span className="fca-label">Org-Einheit</span>
            <input type="text" name="orgUnitLabel" maxLength={100} placeholder="z.B. Vereinsleitung, Mediateam" className="fca-input mt-2" />
          </label>
        </div>
        <div>
          <label className="block"><span className="fca-label">Altersgruppe</span>
            <select name="ageGroupHint" defaultValue="" className="fca-select mt-2">
              {AGE_GROUP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>

        <div>
          <label className="block"><span className="fca-label">Modul-Kontext</span>
            <input type="text" name="moduleKey" maxLength={80} placeholder="z.B. media, training_planner, sponsoring" className="fca-input mt-2" />
            <p className="mt-1 text-xs text-slate-400">Verknüpft das Ziel mit einem Plattform-Modul.</p>
          </label>
        </div>
        <div>
          <label className="block"><span className="fca-label">Zielkategorie</span>
            <input type="text" name="targetCategory" maxLength={80} placeholder="z.B. youth_development, media, sponsoring" className="fca-input mt-2" />
            <p className="mt-1 text-xs text-slate-400">Für Vorlagen und Benchmark-Empfehlungen.</p>
          </label>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={submitting} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0b4aa2] px-6 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a] disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? "Wird erstellt…" : "Ziel erstellen"}
        </button>
        <Link href="/targets" className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:bg-slate-50">Abbrechen</Link>
      </div>
    </form>
  );
}
