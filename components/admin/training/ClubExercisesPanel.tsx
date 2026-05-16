"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Trash2, Check, X } from "lucide-react";
import {
  deleteClubExercise,
  updateClubExercise,
} from "@/app/(admin)/dashboard/training/exercises/actions";
import {
  EXERCISE_DIFFICULTY_LABELS,
  EXERCISE_SPORT_LABELS,
  TRAINING_FOCUS_LABELS,
} from "@/lib/training/labels";
import type { ClubExerciseRow } from "@/lib/training/exercise-queries";
import { ExerciseSport } from "@prisma/client";

const DIFFICULTY_COLORS = {
  BEGINNER: "border-emerald-200 bg-emerald-50 text-emerald-700",
  INTERMEDIATE: "border-amber-200 bg-amber-50 text-amber-700",
  ADVANCED: "border-rose-200 bg-rose-50 text-rose-700",
};

function ExerciseEditForm({
  exercise,
  onCancel,
}: {
  exercise: ClubExerciseRow;
  onCancel: () => void;
}) {
  return (
    <form action={updateClubExercise} className="space-y-3 pt-2">
      <input type="hidden" name="id" value={exercise.id} />
      <input
        name="title"
        defaultValue={exercise.title}
        required
        placeholder="Titel"
        className="w-full rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10"
      />
      <textarea
        name="description"
        defaultValue={exercise.description}
        rows={3}
        placeholder="Beschreibung"
        className="w-full resize-none rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#0b4aa2]"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          name="durationMinutes"
          type="number"
          defaultValue={exercise.durationMinutes ?? ""}
          placeholder="Dauer (Min.)"
          className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#0b4aa2]"
        />
        <input
          name="equipment"
          defaultValue={exercise.equipment ?? ""}
          placeholder="Material"
          className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#0b4aa2]"
        />
      </div>
      <textarea
        name="setup"
        defaultValue={exercise.setup ?? ""}
        rows={2}
        placeholder="Aufbau"
        className="w-full resize-none rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-[#0b4aa2]"
      />
      <textarea
        name="coachingPoints"
        defaultValue={exercise.coachingPoints ?? ""}
        rows={2}
        placeholder="Coaching Points"
        className="w-full resize-none rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-[#0b4aa2]"
      />
      <textarea
        name="variations"
        defaultValue={exercise.variations ?? ""}
        rows={2}
        placeholder="Variationen"
        className="w-full resize-none rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-[#0b4aa2]"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-full bg-[#0b4aa2] px-3 py-1.5 text-[12px] font-semibold text-white"
        >
          <Check className="h-3 w-3" />
          Speichern
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600"
        >
          <X className="h-3 w-3" />
          Abbrechen
        </button>
      </div>
    </form>
  );
}

function ExerciseRow({ exercise }: { exercise: ClubExerciseRow }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <div className="group rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold text-slate-900">
              {exercise.title}
            </p>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${DIFFICULTY_COLORS[exercise.difficulty]}`}
            >
              {EXERCISE_DIFFICULTY_LABELS[exercise.difficulty]}
            </span>
            <span className="rounded-full border border-[#0b4aa2]/20 bg-[#0b4aa2]/5 px-2 py-0.5 text-[10px] font-semibold text-[#0b4aa2]">
              {TRAINING_FOCUS_LABELS[exercise.focus]}
            </span>
          </div>
          {!editing && (
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {exercise.description}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => {
              setEditing(!editing);
              setExpanded(false);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:text-[#0b4aa2]"
            title="Bearbeiten"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <form action={deleteClubExercise}>
            <input type="hidden" name="id" value={exercise.id} />
            <button
              type="submit"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:border-rose-200 hover:text-rose-500"
              title="Löschen"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </form>
          {!editing && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:text-slate-600"
            >
              {expanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
      </div>

      {editing && (
        <ExerciseEditForm exercise={exercise} onCancel={() => setEditing(false)} />
      )}

      {!editing && expanded && (
        <div className="mt-3 space-y-1.5 rounded-[12px] bg-slate-50 p-3">
          {exercise.setup && (
            <p className="text-[11px] leading-relaxed text-slate-600">
              <span className="font-semibold">Aufbau:</span> {exercise.setup}
            </p>
          )}
          {exercise.coachingPoints && (
            <p className="text-[11px] leading-relaxed text-slate-600">
              <span className="font-semibold">Coaching:</span>{" "}
              {exercise.coachingPoints}
            </p>
          )}
          {exercise.variations && (
            <p className="text-[11px] leading-relaxed text-slate-600">
              <span className="font-semibold">Variationen:</span>{" "}
              {exercise.variations}
            </p>
          )}
          <div className="flex flex-wrap gap-3 pt-1">
            {exercise.durationMinutes && (
              <p className="text-[11px] text-slate-400">
                <span className="font-medium text-slate-500">Dauer:</span>{" "}
                {exercise.durationMinutes} Min.
              </p>
            )}
            {exercise.equipment && (
              <p className="text-[11px] text-slate-400">
                <span className="font-medium text-slate-500">Material:</span>{" "}
                {exercise.equipment}
              </p>
            )}
            {exercise.audienceTags.length > 0 && (
              <p className="text-[11px] text-slate-400">
                <span className="font-medium text-slate-500">Zielgruppe:</span>{" "}
                {exercise.audienceTags.join(", ")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type Props = {
  exercises: ClubExerciseRow[];
};

const ALL_SPORTS = Object.values(ExerciseSport) as ExerciseSport[];

export default function ClubExercisesPanel({ exercises }: Props) {
  const bySport = new Map<ExerciseSport, ClubExerciseRow[]>();
  for (const ex of exercises) {
    const existing = bySport.get(ex.sport) ?? [];
    existing.push(ex);
    bySport.set(ex.sport, existing);
  }

  if (exercises.length === 0) {
    return (
      <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <h3 className="text-[1.05rem] font-semibold text-slate-900">
          Meine Übungen
        </h3>
        <p className="mt-4 text-sm text-slate-400">
          Noch keine Übungen importiert. Wähle Übungen aus dem Katalog aus.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[1.05rem] font-semibold text-slate-900">
            Meine Übungen
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {exercises.length} Übung{exercises.length !== 1 ? "en" : ""} importiert
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        {ALL_SPORTS.filter((s) => bySport.has(s)).map((sport) => {
          const sportExercises = bySport.get(sport)!;
          return (
            <div key={sport}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {EXERCISE_SPORT_LABELS[sport]}
              </p>
              <div className="space-y-2">
                {sportExercises.map((ex) => (
                  <ExerciseRow key={ex.id} exercise={ex} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
