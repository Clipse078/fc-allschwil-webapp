"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { deleteClubGoal, updateClubGoalTitle } from "@/app/(admin)/dashboard/strategy/actions";
import type { ClubGoalRow } from "@/lib/strategy/club-goal-queries";

type Props = {
  goal: ClubGoalRow;
};

export default function GoalRow({ goal }: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description ?? "");
  const [metricLabel, setMetricLabel] = useState(goal.metricLabel ?? "");
  const [metricValue, setMetricValue] = useState(goal.metricValue ?? "");
  const [pending, setPending] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setPending(true);
    const fd = new FormData();
    fd.append("id", goal.id);
    fd.append("title", title);
    fd.append("description", description);
    fd.append("metricLabel", metricLabel);
    fd.append("metricValue", metricValue);
    await updateClubGoalTitle(fd);
    setPending(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="rounded-[18px] border border-[#0b4aa2]/20 bg-blue-50/40 p-4">
        <input
          className="w-full rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Zielbezeichnung"
          autoFocus
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            className="rounded-[12px] border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-[#0b4aa2]"
            value={metricValue}
            onChange={(e) => setMetricValue(e.target.value)}
            placeholder="Zielwert (z.B. 30)"
          />
          <input
            className="rounded-[12px] border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-[#0b4aa2]"
            value={metricLabel}
            onChange={(e) => setMetricLabel(e.target.value)}
            placeholder="Einheit (z.B. % der Trainings)"
          />
        </div>
        <textarea
          className="mt-2 w-full resize-none rounded-[12px] border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 outline-none focus:border-[#0b4aa2]"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Beschreibung (optional)"
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={pending || !title.trim()}
            className="flex items-center gap-1.5 rounded-full bg-[#0b4aa2] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            <Check className="h-3 w-3" />
            Speichern
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600"
          >
            <X className="h-3 w-3" />
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start justify-between gap-3 rounded-[18px] border border-slate-200/80 bg-white px-4 py-3 shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{goal.title}</p>
        {goal.metricValue && goal.metricLabel && (
          <p className="mt-0.5 text-xs text-[#0b4aa2] font-semibold">
            Ziel: {goal.metricValue} {goal.metricLabel}
          </p>
        )}
        {goal.description && (
          <p className="mt-0.5 text-xs text-slate-400">{goal.description}</p>
        )}
        {goal.teamName && (
          <p className="mt-0.5 text-[11px] text-slate-400">Team: {goal.teamName}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:text-[#0b4aa2]"
          title="Bearbeiten"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <form action={deleteClubGoal}>
          <input type="hidden" name="id" value={goal.id} />
          <button
            type="submit"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:border-rose-200 hover:text-rose-500"
            title="Löschen"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </form>
      </div>
    </div>
  );
}
