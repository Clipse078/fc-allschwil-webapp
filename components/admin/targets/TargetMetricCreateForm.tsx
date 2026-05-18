"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const METRIC_TYPE_OPTIONS = [
  { value: "NUMBER",     label: "Anzahl (Zahl)" },
  { value: "PERCENTAGE", label: "Prozent (%)" },
  { value: "CURRENCY",   label: "Betrag (CHF)" },
  { value: "RATIO",      label: "Verhältnis (pro Periode)" },
  { value: "BOOLEAN",    label: "Ja/Nein" },
  { value: "SCORE",      label: "Punktzahl (1–10)" },
] as const;

const DIRECTION_OPTIONS = [
  { value: "INCREASE", label: "↑ Erhöhen (mehr ist besser)" },
  { value: "DECREASE", label: "↓ Verringern (weniger ist besser)" },
  { value: "MAINTAIN", label: "≈ Halten (innerhalb Bereich)" },
  { value: "ACHIEVE",  label: "✓ Erreichen (Ja/Nein)" },
] as const;

type Props = { targetId: string };

export default function TargetMetricCreateForm({ targetId }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const label = String(form.get("label") ?? "").trim();
    if (!label) { setError("Bezeichnung ist erforderlich."); setSubmitting(false); return; }

    const targetValueRaw = String(form.get("targetValue") ?? "").trim();
    const payload = {
      label,
      metricType:  String(form.get("metricType")  ?? "NUMBER"),
      direction:   String(form.get("direction")   ?? "INCREASE"),
      targetValue: targetValueRaw ? parseFloat(targetValueRaw) : undefined,
      unit:        String(form.get("unit")        ?? "").trim() || undefined,
      notes:       String(form.get("notes")       ?? "").trim() || undefined,
    };

    try {
      const response = await fetch(`/api/targets/${targetId}/metrics`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error ?? "Kennzahl konnte nicht erstellt werden."); setSubmitting(false); return; }
      setSuccess(true);
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch {
      setError("Ein Netzwerkfehler ist aufgetreten.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-[18px] border border-slate-200/80 bg-slate-50 p-4">
      {error   ? <div className="fca-status-box fca-status-box-error mb-3 text-xs">{error}</div>   : null}
      {success ? <div className="fca-status-box fca-status-box-success mb-3 text-xs">Kennzahl hinzugefügt.</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="block"><span className="fca-label text-xs">Bezeichnung <span className="text-red-500">*</span></span>
            <input type="text" name="label" required maxLength={150} placeholder="z.B. Anzahl Frauenteams, Technikanteil Training" className="fca-input mt-1" />
          </label>
        </div>
        <div>
          <label className="block"><span className="fca-label text-xs">Typ</span>
            <select name="metricType" defaultValue="NUMBER" className="fca-select mt-1">
              {METRIC_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
        <div>
          <label className="block"><span className="fca-label text-xs">Richtung</span>
            <select name="direction" defaultValue="INCREASE" className="fca-select mt-1">
              {DIRECTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
        <div className="flex gap-2">
          <label className="min-w-0 flex-1 block"><span className="fca-label text-xs">Zielwert</span>
            <input type="number" name="targetValue" step="any" placeholder="z.B. 3 oder 50" className="fca-input mt-1" />
          </label>
          <label className="w-24 block"><span className="fca-label text-xs">Einheit</span>
            <input type="text" name="unit" maxLength={30} placeholder="%, CHF, …" className="fca-input mt-1" />
          </label>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={submitting} className="inline-flex h-9 items-center gap-2 rounded-full bg-[#0b4aa2] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#08357a] disabled:opacity-60">
          {submitting ? "Wird hinzugefügt…" : "+ Kennzahl hinzufügen"}
        </button>
      </div>
    </form>
  );
}
