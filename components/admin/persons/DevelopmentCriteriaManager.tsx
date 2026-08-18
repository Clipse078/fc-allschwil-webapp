"use client";

/**
 * PERSON-UX-06: Development criteria management UI.
 *
 * Compact premium management surface for authorized managers.
 * No hardcoded sport-specific abilities — all free-text.
 *
 * Features:
 *   - List all criteria (active + inactive)
 *   - Create criterion (name, category, description, rating mode,
 *     benchmark settings, qualitative labels override)
 *   - Edit criterion inline
 *   - Toggle active/inactive
 *   - Reorder with up/down controls
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  ChevronUp,
  ChevronDown,
  Check,
  X,
  ToggleLeft,
  ToggleRight,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { TenantCriterionAdmin } from "@/lib/people/queries";
import {
  RATING_MODES,
  DEFAULT_QUALITATIVE_5_LABELS,
  ALL_RATING_MODES,
  type RatingMode,
} from "@/lib/people/rating-modes";

// ── Mode labels ───────────────────────────────────────────────────────────────

const MODE_LABELS: Record<string, string> = {
  SCORE_0_100: "0–100",
  QUALITATIVE_5: "5 Stufen",
  SCORE_1_10: "1–10",
  PERCENTAGE: "Prozent (0–100 %)",
};

// ── Inline form ───────────────────────────────────────────────────────────────

type CriterionFormValues = {
  name: string;
  description: string;
  category: string;
  ratingMode: RatingMode;
  showTeamBenchmark: boolean;
  showJahrgangBenchmark: boolean;
  customLabels: boolean;
  label1: string;
  label2: string;
  label3: string;
  label4: string;
  label5: string;
};

function defaultFormValues(criterion?: TenantCriterionAdmin): CriterionFormValues {
  const labels = Array.isArray(criterion?.qualitativeLabels)
    ? (criterion.qualitativeLabels as string[])
    : DEFAULT_QUALITATIVE_5_LABELS;
  return {
    name: criterion?.name ?? "",
    description: criterion?.description ?? "",
    category: criterion?.category ?? "",
    ratingMode: (criterion?.ratingMode as RatingMode) ?? RATING_MODES.SCORE_0_100,
    showTeamBenchmark: criterion?.showTeamBenchmark ?? false,
    showJahrgangBenchmark: criterion?.showJahrgangBenchmark ?? false,
    customLabels: Array.isArray(criterion?.qualitativeLabels),
    label1: labels[0] ?? DEFAULT_QUALITATIVE_5_LABELS[0],
    label2: labels[1] ?? DEFAULT_QUALITATIVE_5_LABELS[1],
    label3: labels[2] ?? DEFAULT_QUALITATIVE_5_LABELS[2],
    label4: labels[3] ?? DEFAULT_QUALITATIVE_5_LABELS[3],
    label5: labels[4] ?? DEFAULT_QUALITATIVE_5_LABELS[4],
  };
}

function CriterionForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: TenantCriterionAdmin;
  onSave: (values: CriterionFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<CriterionFormValues>(defaultFormValues(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof CriterionFormValues>(key: K, value: CriterionFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-[var(--sce-primary)] bg-[var(--sce-accent)] p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[var(--foreground)]">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            required
            placeholder="z.B. Ballkontrolle"
            className="block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--sce-primary)] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[var(--foreground)]">
            Kategorie / Gruppe
          </label>
          <input
            type="text"
            value={values.category}
            onChange={(e) => set("category", e.target.value)}
            placeholder="z.B. Technik"
            className="block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--sce-primary)] focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-medium text-[var(--foreground)]">
          Beschreibung
        </label>
        <textarea
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          rows={2}
          placeholder="Optionale Beschreibung…"
          className="block w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--sce-primary)] focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-medium text-[var(--foreground)]">
          Bewertungsmodus
        </label>
        <select
          value={values.ratingMode}
          onChange={(e) => set("ratingMode", e.target.value as RatingMode)}
          className="block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:border-[var(--sce-primary)] focus:outline-none"
        >
          {ALL_RATING_MODES.map((m) => (
            <option key={m} value={m}>
              {MODE_LABELS[m] ?? m}
            </option>
          ))}
        </select>
      </div>

      {values.ratingMode === RATING_MODES.QUALITATIVE_5 ? (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[11px] font-medium text-[var(--foreground)]">
            <input
              type="checkbox"
              checked={values.customLabels}
              onChange={(e) => set("customLabels", e.target.checked)}
              className="rounded"
            />
            Eigene Stufen-Bezeichnungen
          </label>
          {values.customLabels ? (
            <div className="grid grid-cols-5 gap-1">
              {([1, 2, 3, 4, 5] as const).map((n) => {
                const key = `label${n}` as keyof CriterionFormValues;
                return (
                  <div key={n}>
                    <span className="mb-0.5 block text-[10px] text-[var(--muted)]">Stufe {n}</span>
                    <input
                      type="text"
                      value={String(values[key])}
                      onChange={(e) => set(key, e.target.value)}
                      className="block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--foreground)] focus:border-[var(--sce-primary)] focus:outline-none"
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[10px] text-[var(--muted)]">
              Standard: {DEFAULT_QUALITATIVE_5_LABELS.map((l, i) => `${i + 1}. ${l}`).join(" · ")}
            </p>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-[11px] text-[var(--foreground)]">
          <input
            type="checkbox"
            checked={values.showTeamBenchmark}
            onChange={(e) => set("showTeamBenchmark", e.target.checked)}
            className="rounded"
          />
          Team-Benchmark anzeigen
        </label>
        <label className="flex items-center gap-2 text-[11px] text-[var(--foreground)]">
          <input
            type="checkbox"
            checked={values.showJahrgangBenchmark}
            onChange={(e) => set("showJahrgangBenchmark", e.target.checked)}
            className="rounded"
          />
          Jahrgang-Benchmark anzeigen
        </label>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700">{error}</p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
          <X className="mr-1 h-3 w-3" />
          Abbrechen
        </Button>
        <Button type="submit" size="sm" disabled={saving}>
          <Check className="mr-1 h-3 w-3" />
          {saving ? "Speichern…" : initial ? "Aktualisieren" : "Kriterium erstellen"}
        </Button>
      </div>
    </form>
  );
}

// ── Criterion row ─────────────────────────────────────────────────────────────

function CriterionRow({
  criterion,
  isFirst,
  isLast,
  onEdit,
  onToggleActive,
  onMoveUp,
  onMoveDown,
}: {
  criterion: TenantCriterionAdmin;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition ${
        criterion.isActive
          ? "border-[var(--border)] bg-[var(--surface)]"
          : "border-[var(--border)] bg-[var(--surface-2)] opacity-60"
      }`}
    >
      <div className="flex shrink-0 flex-col gap-0.5">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          className="rounded p-0.5 text-[var(--muted)] transition hover:bg-[var(--surface-3)] disabled:opacity-30"
          aria-label="Nach oben"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          className="rounded p-0.5 text-[var(--muted)] transition hover:bg-[var(--surface-3)] disabled:opacity-30"
          aria-label="Nach unten"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[var(--foreground)]">{criterion.name}</span>
          {criterion.category ? (
            <span className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[10px] text-[var(--muted)]">
              {criterion.category}
            </span>
          ) : null}
          <span className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
            {MODE_LABELS[criterion.ratingMode] ?? criterion.ratingMode}
          </span>
          {criterion.showTeamBenchmark ? (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
              Team ⌀
            </span>
          ) : null}
          {criterion.showJahrgangBenchmark ? (
            <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-600">
              Jahrgang ⌀
            </span>
          ) : null}
          {!criterion.isActive ? (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
              Inaktiv
            </span>
          ) : null}
        </div>
        {criterion.description ? (
          <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{criterion.description}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]"
          aria-label="Bearbeiten"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onToggleActive}
          className={`rounded-lg p-1.5 transition ${
            criterion.isActive
              ? "text-emerald-600 hover:bg-red-50 hover:text-red-500"
              : "text-gray-400 hover:bg-emerald-50 hover:text-emerald-600"
          }`}
          aria-label={criterion.isActive ? "Deaktivieren" : "Aktivieren"}
          title={criterion.isActive ? "Deaktivieren" : "Aktivieren"}
        >
          {criterion.isActive ? (
            <ToggleRight className="h-4 w-4" />
          ) : (
            <ToggleLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  initialCriteria: TenantCriterionAdmin[];
};

export default function DevelopmentCriteriaManager({ initialCriteria }: Props) {
  const router = useRouter();
  const [criteria, setCriteria] = useState<TenantCriterionAdmin[]>(initialCriteria);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  function buildPayload(values: CriterionFormValues) {
    const payload: Record<string, unknown> = {
      name: values.name.trim(),
      description: values.description.trim() || null,
      category: values.category.trim() || null,
      ratingMode: values.ratingMode,
      showTeamBenchmark: values.showTeamBenchmark,
      showJahrgangBenchmark: values.showJahrgangBenchmark,
    };
    if (values.ratingMode === RATING_MODES.QUALITATIVE_5 && values.customLabels) {
      payload.qualitativeLabels = [
        values.label1.trim(),
        values.label2.trim(),
        values.label3.trim(),
        values.label4.trim(),
        values.label5.trim(),
      ];
    } else if (values.ratingMode === RATING_MODES.QUALITATIVE_5) {
      payload.qualitativeLabels = null;
    }
    return payload;
  }

  async function handleCreate(values: CriterionFormValues) {
    const res = await fetch("/api/people/criteria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(values)),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "Fehler beim Erstellen.");
    }
    setShowCreate(false);
    router.refresh();
    const data = (await res.json()) as { criterion: TenantCriterionAdmin };
    setCriteria((prev) => [...prev, data.criterion]);
  }

  async function handleUpdate(id: string, values: CriterionFormValues) {
    const res = await fetch(`/api/people/criteria/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(values)),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "Fehler beim Speichern.");
    }
    const data = (await res.json()) as { criterion: TenantCriterionAdmin };
    setCriteria((prev) =>
      prev.map((c) => (c.id === id ? data.criterion : c)),
    );
    setEditId(null);
  }

  async function handleToggleActive(criterion: TenantCriterionAdmin) {
    setGlobalError(null);
    const newActive = !criterion.isActive;
    // Optimistic
    setCriteria((prev) =>
      prev.map((c) => (c.id === criterion.id ? { ...c, isActive: newActive } : c)),
    );
    const res = await fetch(`/api/people/criteria/${criterion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: newActive }),
    });
    if (!res.ok) {
      // Revert
      setCriteria((prev) =>
        prev.map((c) => (c.id === criterion.id ? { ...c, isActive: criterion.isActive } : c)),
      );
      setGlobalError("Status konnte nicht geändert werden.");
    }
  }

  async function handleMove(id: string, direction: "up" | "down") {
    const idx = criteria.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= criteria.length) return;

    const reordered = [...criteria];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    // Re-assign sortOrder positions
    const withOrders = reordered.map((c, i) => ({ ...c, sortOrder: i }));
    setCriteria(withOrders);

    const entries = withOrders.map((c) => ({ id: c.id, sortOrder: c.sortOrder }));
    await fetch(`/api/people/criteria/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reorder: entries }),
    }).catch(() => {
      // Non-fatal; order may resync on next reload
    });
  }

  return (
    <div className="space-y-4">
      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[var(--muted)]">
          <Settings2 className="h-4 w-4" />
          <span className="text-xs">
            {criteria.length} {criteria.length === 1 ? "Kriterium" : "Kriterien"}
            {" · "}
            {criteria.filter((c) => c.isActive).length} aktiv
          </span>
        </div>
        {!showCreate ? (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Kriterium hinzufügen
          </Button>
        ) : null}
      </div>

      {/* ── Create form ───────────────────────────────────────────────────────── */}
      {showCreate ? (
        <CriterionForm
          onSave={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      ) : null}

      {/* ── Global error ─────────────────────────────────────────────────────── */}
      {globalError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{globalError}</p>
      ) : null}

      {/* ── List ─────────────────────────────────────────────────────────────── */}
      {criteria.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] px-6 py-10 text-center">
          <Settings2 className="mx-auto mb-3 h-8 w-8 text-[var(--muted)]" />
          <p className="text-sm font-medium text-[var(--foreground)]">Noch keine Kriterien</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Fügen Sie das erste Bewertungs-Kriterium für Ihren Verein hinzu.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {criteria.map((c, idx) =>
            editId === c.id ? (
              <div key={c.id}>
                <CriterionForm
                  initial={c}
                  onSave={(values) => handleUpdate(c.id, values)}
                  onCancel={() => setEditId(null)}
                />
              </div>
            ) : (
              <CriterionRow
                key={c.id}
                criterion={c}
                isFirst={idx === 0}
                isLast={idx === criteria.length - 1}
                onEdit={() => setEditId(c.id)}
                onToggleActive={() => handleToggleActive(c)}
                onMoveUp={() => handleMove(c.id, "up")}
                onMoveDown={() => handleMove(c.id, "down")}
              />
            ),
          )}
        </div>
      )}

      <p className="mt-2 text-[11px] text-[var(--muted)]">
        Deaktivierte Kriterien werden bei neuen Bewertungen nicht mehr angeboten.
        Bestehende Bewertungen bleiben vollständig lesbar.
      </p>
    </div>
  );
}
