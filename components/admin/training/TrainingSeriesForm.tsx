"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, Users } from "lucide-react";
import type { Weekday } from "@/lib/training/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TeamSeasonOption = {
  id: string;
  teamId: string;
  teamName: string;
  seasonName: string;
  trainers: { id: string; name: string; roleLabel: string | null }[];
};

export type TrainingSeriesFormDefaultValues = {
  teamSeasonId: string;
  title: string;
  description: string | null;
  timezone: string;
  /** "YYYY-MM-DD" */
  validFrom: string | null;
  /** "YYYY-MM-DD" */
  validUntil: string | null;
  weekdaySchedules: { weekday: Weekday; startsAt: string; endsAt: string }[];
};

type Props = {
  mode: "create" | "edit";
  seriesId?: string;
  teamSeasons: TeamSeasonOption[];
  defaultValues?: TrainingSeriesFormDefaultValues;
};

type WeekdayRow = {
  weekday: Weekday;
  label: string;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
};

type GenerationResult = {
  occurrencesInWindow: number;
  created: number;
  updated: number;
  unchanged: number;
};

const WEEKDAY_DEFS: { weekday: Weekday; label: string }[] = [
  { weekday: "MONDAY", label: "Montag" },
  { weekday: "TUESDAY", label: "Dienstag" },
  { weekday: "WEDNESDAY", label: "Mittwoch" },
  { weekday: "THURSDAY", label: "Donnerstag" },
  { weekday: "FRIDAY", label: "Freitag" },
  { weekday: "SATURDAY", label: "Samstag" },
  { weekday: "SUNDAY", label: "Sonntag" },
];

function buildInitialWeekdayRows(
  defaultValues: TrainingSeriesFormDefaultValues | undefined,
): WeekdayRow[] {
  const byWeekday = new Map(
    (defaultValues?.weekdaySchedules ?? []).map((s) => [s.weekday, s]),
  );
  return WEEKDAY_DEFS.map(({ weekday, label }) => {
    const existing = byWeekday.get(weekday);
    return {
      weekday,
      label,
      enabled: !!existing,
      startsAt: existing?.startsAt ?? "17:00",
      endsAt: existing?.endsAt ?? "18:00",
    };
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TrainingSeriesForm({ mode, seriesId, teamSeasons, defaultValues }: Props) {
  const router = useRouter();

  const [teamSeasonId, setTeamSeasonId] = useState(defaultValues?.teamSeasonId ?? "");
  const [title, setTitle] = useState(defaultValues?.title ?? "");
  const [description, setDescription] = useState(defaultValues?.description ?? "");
  const [timezone, setTimezone] = useState(defaultValues?.timezone ?? "Europe/Zurich");
  const [validFrom, setValidFrom] = useState(defaultValues?.validFrom ?? "");
  const [validUntil, setValidUntil] = useState(defaultValues?.validUntil ?? "");
  const [weekdayRows, setWeekdayRows] = useState<WeekdayRow[]>(
    buildInitialWeekdayRows(defaultValues),
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ seriesId: string; generation: GenerationResult } | null>(
    null,
  );

  const selectedTeamSeason = useMemo(
    () => teamSeasons.find((ts) => ts.id === teamSeasonId) ?? null,
    [teamSeasons, teamSeasonId],
  );

  function toggleWeekday(weekday: Weekday) {
    setWeekdayRows((rows) =>
      rows.map((r) => (r.weekday === weekday ? { ...r, enabled: !r.enabled } : r)),
    );
  }

  function updateWeekdayTime(weekday: Weekday, field: "startsAt" | "endsAt", value: string) {
    setWeekdayRows((rows) =>
      rows.map((r) => (r.weekday === weekday ? { ...r, [field]: value } : r)),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "create" && !teamSeasonId) {
      setError("Team / Saison ist erforderlich.");
      return;
    }
    if (!title.trim()) {
      setError("Name der Trainingsserie ist erforderlich.");
      return;
    }
    if (!validFrom || !validUntil) {
      setError("Gültig ab und Gültig bis sind erforderlich.");
      return;
    }

    const enabledRows = weekdayRows.filter((r) => r.enabled);
    if (enabledRows.length === 0) {
      setError("Mindestens ein Wochentag ist erforderlich.");
      return;
    }
    for (const row of enabledRows) {
      if (row.startsAt >= row.endsAt) {
        setError(`${row.label}: Beginn muss vor Ende liegen.`);
        return;
      }
    }

    const weekdaySchedules = enabledRows.map((r) => ({
      weekday: r.weekday,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
    }));

    setLoading(true);
    try {
      const url = mode === "edit" ? `/api/training-series/${seriesId}` : "/api/training-series";
      const method = mode === "edit" ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(mode === "create" ? { teamSeasonId } : {}),
          title: title.trim(),
          description: description.trim() || null,
          timezone: timezone.trim() || "Europe/Zurich",
          validFrom,
          validUntil,
          weekdaySchedules,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Fehler beim Speichern.");
        return;
      }

      setResult({ seriesId: data.series.id, generation: data.generation });
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  const fieldClass =
    "w-full rounded-[14px] border border-[var(--border)] bg-white px-4 py-2.5 text-sm text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/30";
  const labelClass =
    "block text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] mb-1.5";

  if (result) {
    return (
      <div className="space-y-6 rounded-[24px] border border-emerald-200 bg-emerald-50/60 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <div>
          <p className="text-lg font-semibold text-[var(--foreground)]">
            {mode === "edit" ? "Trainingsserie aktualisiert" : "Trainingsserie erstellt"}
          </p>
          <p className="mt-1 text-sm text-[var(--text-2)]">
            {result.generation.occurrencesInWindow} Termine im gewählten Zeitraum — {result.generation.created} neu
            generiert, {result.generation.updated} aktualisiert, {result.generation.unchanged} unverändert.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`/dashboard/training/series/${result.seriesId}/allocations`}
            className="fca-button-primary text-sm"
          >
            Ressourcen zuweisen
          </Link>
          <Link href="/dashboard/training" className="fca-button-secondary text-sm">
            Zur Übersicht
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-sm">
        <h3 className="mb-5 text-[1.05rem] font-semibold text-[var(--foreground)]">Team &amp; Serie</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelClass}>Team / Saison *</label>
            {mode === "create" ? (
              <select
                value={teamSeasonId}
                onChange={(e) => setTeamSeasonId(e.target.value)}
                className={fieldClass}
                required
              >
                <option value="">— Auswählen —</option>
                {teamSeasons.map((ts) => (
                  <option key={ts.id} value={ts.id}>
                    {ts.teamName} · {ts.seasonName}
                  </option>
                ))}
              </select>
            ) : (
              <div className={`${fieldClass} bg-[var(--surface-2)] text-[var(--text-2)]`}>
                {selectedTeamSeason
                  ? `${selectedTeamSeason.teamName} · ${selectedTeamSeason.seasonName}`
                  : "—"}
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Name der Trainingsserie *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. E1 Dienstagstraining"
              className={fieldClass}
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optionale Beschreibung…"
              className={fieldClass}
            />
          </div>

          <div>
            <label className={labelClass}>Gültig ab *</label>
            <input
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className={fieldClass}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Gültig bis *</label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className={fieldClass}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Zeitzone</label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Europe/Zurich"
              className={fieldClass}
            />
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-sm">
        <h3 className="mb-1 text-[1.05rem] font-semibold text-[var(--foreground)]">Wochentage &amp; Zeiten</h3>
        <p className="mb-5 text-sm text-[var(--text-2)]">
          Wähle einen oder mehrere Wochentage. Jeder Wochentag kann eine eigene Start- und Endzeit haben
          (z.&nbsp;B. Montag 17:00–18:00, Mittwoch 16:00–17:00).
        </p>
        <div className="space-y-2">
          {weekdayRows.map((row) => (
            <div
              key={row.weekday}
              className={`flex flex-wrap items-center gap-3 rounded-[14px] border px-4 py-3 transition ${
                row.enabled
                  ? "border-[var(--blue)]/30 bg-[var(--blue-light)]"
                  : "border-[var(--border)] bg-[var(--surface-2)]"
              }`}
            >
              <label className="flex w-36 shrink-0 items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={() => toggleWeekday(row.weekday)}
                  className="h-4 w-4 rounded border-[var(--border)]"
                />
                {row.label}
              </label>
              {row.enabled ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <input
                    type="time"
                    value={row.startsAt}
                    onChange={(e) => updateWeekdayTime(row.weekday, "startsAt", e.target.value)}
                    className="rounded-[10px] border border-[var(--border)] bg-white px-3 py-1.5"
                    required
                  />
                  <span className="text-[var(--muted)]">–</span>
                  <input
                    type="time"
                    value={row.endsAt}
                    onChange={(e) => updateWeekdayTime(row.weekday, "endsAt", e.target.value)}
                    className="rounded-[10px] border border-[var(--border)] bg-white px-3 py-1.5"
                    required
                  />
                </div>
              ) : (
                <span className="text-sm text-[var(--muted)]">Nicht aktiv</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-sm">
        <h3 className="mb-1 flex items-center gap-2 text-[1.05rem] font-semibold text-[var(--foreground)]">
          <Users className="h-4 w-4 text-[var(--blue)]" />
          Trainer
        </h3>
        <p className="mb-4 text-sm text-[var(--text-2)]">
          Trainer werden auf Stufe Mannschaft verwaltet und hier nur angezeigt.
        </p>
        {selectedTeamSeason && selectedTeamSeason.trainers.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {selectedTeamSeason.trainers.map((t) => (
              <li
                key={t.id}
                className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-xs font-medium text-[var(--foreground)]"
              >
                {t.name}
                {t.roleLabel ? <span className="ml-1 text-[var(--muted)]">({t.roleLabel})</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            {selectedTeamSeason
              ? "Keine Trainer für dieses Team hinterlegt."
              : "Team auswählen, um zugewiesene Trainer zu sehen."}
          </p>
        )}
        {selectedTeamSeason ? (
          <Link
            href={`/dashboard/teams/${selectedTeamSeason.teamId}`}
            className="mt-3 inline-block text-xs text-[var(--blue)] hover:underline"
          >
            Trainer für dieses Team verwalten
          </Link>
        ) : null}
      </section>

      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full border border-[var(--border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)]"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={loading}
          className="fca-button-primary inline-flex items-center gap-2 text-sm disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === "create" ? "Trainingsserie erstellen" : "Änderungen speichern"}
        </button>
      </div>
    </form>
  );
}
