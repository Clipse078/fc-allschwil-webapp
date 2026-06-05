"use client";

import { Target } from "lucide-react";

export type TargetGroupOption = {
  id: string;
  key: string;
  name: string;
  description: string | null;
};

type Props = {
  selected: string[];
  options: TargetGroupOption[];
  onChange: (ids: string[]) => void;
};

export default function VisibleTargetGroupsSelect({ selected, options, onChange }: Props) {
  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  if (options.length === 0) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-amber-600">
        <Target className="h-3.5 w-3.5 shrink-0" />
        <span>Keine aktiven Zielgruppen vorhanden.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
        <Target className="h-3.5 w-3.5" />
        Zielgruppen
      </p>
      <p className="text-[11px] text-amber-600">
        Mitglieder der gewählten Zielgruppen erhalten Zugriff.
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((tg) => {
          const isSelected = selected.includes(tg.id);
          return (
            <button
              key={tg.id}
              type="button"
              onClick={() => toggle(tg.id)}
              title={tg.description ?? undefined}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition ${
                isSelected
                  ? "border-violet-400 bg-violet-100 text-violet-800"
                  : "border-amber-200 bg-white text-amber-800 hover:border-amber-300 hover:bg-amber-50"
              }`}
            >
              <Target className="h-3 w-3" />
              {tg.name}
              {isSelected ? (
                <span className="ml-0.5 text-violet-600">✓</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {selected.length > 0 ? (
        <p className="text-[11px] text-amber-600">
          {selected.length} Zielgruppe{selected.length !== 1 ? "n" : ""} gewählt
        </p>
      ) : null}
    </div>
  );
}
