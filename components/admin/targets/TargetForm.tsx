"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2 } from "lucide-react";
import VisibilityScopeSelect, {
  type VisibilityScopeValue,
} from "@/components/admin/shared/VisibilityScopeSelect";

type MetricDraft = {
  id?: string;
  label: string;
  type: "PERCENTAGE" | "NUMERIC" | "CURRENCY" | "BOOLEAN";
  direction: "INCREASE" | "DECREASE" | "MAINTAIN";
  targetValue: string;
  currentValue: string;
  unit: string;
  notes: string;
};

type TargetFormProps = {
  mode: "create" | "edit";
  targetId?: string;
  defaultValues?: {
    title?: string;
    description?: string;
    category?: string;
    status?: string;
    period?: string;
    periodLabel?: string;
    moduleKey?: string;
    sportCategory?: string;
    ageGroupHint?: string;
    visibilityScope?: VisibilityScopeValue;
    startsAt?: string;
    endsAt?: string;
    metrics?: MetricDraft[];
  };
};

const CATEGORIES = [
  { value: "SPORTLICHE_ENTWICKLUNG", label: "Sportliche Entwicklung" },
  { value: "MITGLIEDERWACHSTUM", label: "Mitgliederwachstum" },
  { value: "FINANZEN", label: "Finanzen & Infrastruktur" },
  { value: "AUSBILDUNG", label: "Ausbildung" },
  { value: "MEDIEN_SOZIALES", label: "Medien & Soziales" },
  { value: "GOVERNANCE", label: "Governance" },
] as const;

const STATUSES = [
  { value: "ACTIVE", label: "Aktiv" },
  { value: "DRAFT", label: "Entwurf" },
  { value: "PAUSED", label: "Pausiert" },
  { value: "COMPLETED", label: "Abgeschlossen" },
  { value: "CANCELLED", label: "Abgebrochen" },
] as const;

const PERIODS = [
  { value: "SEASON", label: "Saison" },
  { value: "QUARTER", label: "Quartal" },
  { value: "YEAR", label: "Jahr" },
  { value: "CUSTOM", label: "Benutzerdefiniert" },
] as const;

const METRIC_TYPES = [
  { value: "PERCENTAGE", label: "Prozent (%)" },
  { value: "NUMERIC", label: "Numerisch" },
  { value: "CURRENCY", label: "Währung (CHF)" },
  { value: "BOOLEAN", label: "Ja/Nein" },
] as const;

const DIRECTIONS = [
  { value: "INCREASE", label: "↑ Erhöhen" },
  { value: "DECREASE", label: "↓ Senken" },
  { value: "MAINTAIN", label: "→ Halten" },
] as const;

function emptyMetric(): MetricDraft {
  return {
    label: "",
    type: "PERCENTAGE",
    direction: "INCREASE",
    targetValue: "",
    currentValue: "0",
    unit: "",
    notes: "",
  };
}

export default function TargetForm({ mode, targetId, defaultValues }: TargetFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState(defaultValues?.title ?? "");
  const [description, setDescription] = useState(defaultValues?.description ?? "");
  const [category, setCategory] = useState(defaultValues?.category ?? "SPORTLICHE_ENTWICKLUNG");
  const [status, setStatus] = useState(defaultValues?.status ?? "ACTIVE");
  const [period, setPeriod] = useState(defaultValues?.period ?? "SEASON");
  const [periodLabel, setPeriodLabel] = useState(defaultValues?.periodLabel ?? "");
  const moduleKey = defaultValues?.moduleKey ?? "";
  const [visibilityScope, setVisibilityScope] = useState<VisibilityScopeValue>(
    defaultValues?.visibilityScope ?? "ORGANISATION",
  );
  const [sportCategory, setSportCategory] = useState(defaultValues?.sportCategory ?? "");
  const [ageGroupHint, setAgeGroupHint] = useState(defaultValues?.ageGroupHint ?? "");
  const [startsAt, setStartsAt] = useState(defaultValues?.startsAt ?? "");
  const [endsAt, setEndsAt] = useState(defaultValues?.endsAt ?? "");
  const [metrics, setMetrics] = useState<MetricDraft[]>(
    defaultValues?.metrics && defaultValues.metrics.length > 0
      ? defaultValues.metrics
      : [emptyMetric()],
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addMetric() {
    setMetrics((prev) => [...prev, emptyMetric()]);
  }

  function removeMetric(idx: number) {
    setMetrics((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateMetric<K extends keyof MetricDraft>(idx: number, key: K, val: MetricDraft[K]) {
    setMetrics((prev) => prev.map((m, i) => (i === idx ? { ...m, [key]: val } : m)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Titel ist erforderlich.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        category,
        status,
        period,
        periodLabel: periodLabel.trim() || null,
        moduleKey: moduleKey.trim() || null,
        sportCategory: sportCategory.trim() || null,
        ageGroupHint: ageGroupHint.trim() || null,
        startsAt: startsAt || null,
        endsAt: endsAt || null,
        visibilityScope,
        metrics: metrics
          .filter((m) => m.label.trim())
          .map((m, idx) => ({
            label: m.label.trim(),
            type: m.type,
            direction: m.direction,
            targetValue: parseFloat(m.targetValue) || 0,
            currentValue: parseFloat(m.currentValue) || 0,
            unit: m.unit.trim() || null,
            notes: m.notes.trim() || null,
            sortOrder: idx,
          })),
      };

      const url = mode === "edit" ? `/api/targets/${targetId}` : "/api/targets";
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

      const data = await res.json();
      const id = data?.target?.id ?? targetId;
      router.push(`/vereinsleitung/targets/${id}?status=saved`);
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  const fieldClass =
    "w-full rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0b4aa2]/30";
  const labelClass = "block text-[12px] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <h3 className="mb-5 text-[1.05rem] font-semibold text-slate-900">
          Grunddaten
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelClass}>Titel *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. Frauenfussball ausbauen"
              className={fieldClass}
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kurze Beschreibung des Ziels…"
              rows={3}
              className={fieldClass}
            />
          </div>

          <div>
            <label className={labelClass}>Kategorie</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={fieldClass}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={fieldClass}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Zeitraum</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className={fieldClass}
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Zeitraumbezeichnung</label>
            <input
              type="text"
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              placeholder="z.B. Saison 2025/26"
              className={fieldClass}
            />
          </div>

          <div>
            <label className={labelClass}>Start</label>
            <input
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className={fieldClass}
            />
          </div>

          <div>
            <label className={labelClass}>Ende</label>
            <input
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className={fieldClass}
            />
          </div>

          <div>
            <label className={labelClass}>Sportkategorie</label>
            <input
              type="text"
              value={sportCategory}
              onChange={(e) => setSportCategory(e.target.value)}
              placeholder="z.B. Fussball"
              className={fieldClass}
            />
          </div>

          <div>
            <label className={labelClass}>Altersgruppe (Hinweis)</label>
            <input
              type="text"
              value={ageGroupHint}
              onChange={(e) => setAgeGroupHint(e.target.value)}
              placeholder="z.B. U10–U17"
              className={fieldClass}
            />
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="text-[1.05rem] font-semibold text-slate-900">Metriken</h3>
          <button
            type="button"
            onClick={addMetric}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          >
            <Plus className="h-3.5 w-3.5" />
            Metrik hinzufügen
          </button>
        </div>

        <div className="space-y-5">
          {metrics.map((metric, idx) => (
            <div
              key={idx}
              className="rounded-[20px] border border-slate-200/80 bg-slate-50 p-5"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                  Metrik {idx + 1}
                </p>
                {metrics.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeMetric(idx)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-rose-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Metrik entfernen"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className={labelClass}>Bezeichnung *</label>
                  <input
                    type="text"
                    value={metric.label}
                    onChange={(e) => updateMetric(idx, "label", e.target.value)}
                    placeholder="z.B. Aktive Spielerinnen"
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Typ</label>
                  <select
                    value={metric.type}
                    onChange={(e) => updateMetric(idx, "type", e.target.value as MetricDraft["type"])}
                    className={fieldClass}
                  >
                    {METRIC_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Richtung</label>
                  <select
                    value={metric.direction}
                    onChange={(e) => updateMetric(idx, "direction", e.target.value as MetricDraft["direction"])}
                    className={fieldClass}
                  >
                    {DIRECTIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Zielwert</label>
                  <input
                    type="number"
                    step="any"
                    value={metric.targetValue}
                    onChange={(e) => updateMetric(idx, "targetValue", e.target.value)}
                    placeholder="0"
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Aktueller Wert</label>
                  <input
                    type="number"
                    step="any"
                    value={metric.currentValue}
                    onChange={(e) => updateMetric(idx, "currentValue", e.target.value)}
                    placeholder="0"
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Einheit</label>
                  <input
                    type="text"
                    value={metric.unit}
                    onChange={(e) => updateMetric(idx, "unit", e.target.value)}
                    placeholder="z.B. %, CHF, Personen"
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Notizen</label>
                  <input
                    type="text"
                    value={metric.notes}
                    onChange={(e) => updateMetric(idx, "notes", e.target.value)}
                    placeholder="Optionale Erläuterung…"
                    className={fieldClass}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <h3 className="mb-2 text-[1.05rem] font-semibold text-slate-900">Sichtbarkeit</h3>
        <p className="mb-5 text-[12px] text-slate-500">
          Wer kann dieses Ziel sehen? Privat und Eingeschränkt verbergen den Eintrag
          für nicht berechtigte Benutzer.
        </p>
        <VisibilityScopeSelect value={visibilityScope} onChange={setVisibilityScope} />
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
          {mode === "create" ? "Ziel erstellen" : "Änderungen speichern"}
        </button>
      </div>
    </form>
  );
}
