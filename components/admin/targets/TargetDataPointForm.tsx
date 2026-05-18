"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, X, Loader2 } from "lucide-react";

type TargetDataPointFormProps = {
  targetId: string;
  metricId: string;
  metricLabel: string;
  metricType: "PERCENTAGE" | "NUMERIC" | "CURRENCY" | "BOOLEAN";
  unit?: string | null;
};

export default function TargetDataPointForm({
  targetId,
  metricId,
  metricLabel,
  metricType,
  unit,
}: TargetDataPointFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [measuredAt, setMeasuredAt] = useState(
    () => new Date().toISOString().substring(0, 10),
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const numValue =
      metricType === "BOOLEAN" ? (value === "true" ? 1 : 0) : parseFloat(value);

    if (!Number.isFinite(numValue)) {
      setError("Bitte gib einen gültigen Wert ein.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/targets/${targetId}/metrics/${metricId}/datapoints`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            value: numValue,
            note: note.trim() || null,
            measuredAt: measuredAt || null,
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Fehler beim Speichern.");
        return;
      }

      setSuccess(true);
      setValue("");
      setNote("");
      setMeasuredAt(new Date().toISOString().substring(0, 10));
      setOpen(false);
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  const unitLabel = unit ?? (metricType === "PERCENTAGE" ? "%" : metricType === "CURRENCY" ? "CHF" : "");

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        {success ? (
          <span className="text-[11px] font-medium text-emerald-600">
            ✓ Gespeichert
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => { setSuccess(false); setOpen(true); }}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          Wert erfassen
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 rounded-[18px] border border-slate-200 bg-slate-50 p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12px] font-semibold text-slate-700">
          Neuer Messwert: {metricLabel}
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Schliessen"
          className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {error ? (
        <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Wert {unitLabel ? `(${unitLabel})` : ""}
          </label>
          {metricType === "BOOLEAN" ? (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b4aa2]/30"
              required
            >
              <option value="">Wählen…</option>
              <option value="true">Ja</option>
              <option value="false">Nein</option>
            </select>
          ) : (
            <input
              type="number"
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0b4aa2]/30"
              required
            />
          )}
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Datum
          </label>
          <input
            type="date"
            value={measuredAt}
            onChange={(e) => setMeasuredAt(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b4aa2]/30"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Notiz (optional)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Kurze Notiz…"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0b4aa2]/30"
          />
        </div>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#0b4aa2] px-4 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60 hover:bg-[#08357a]"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Speichern
        </button>
      </div>
    </form>
  );
}
