"use client";

import { useMemo, useState, useTransition } from "react";
import { Save } from "lucide-react";

type TeamCategoryRuleEditorItem = {
  id: string;
  category: string;
  minTrainerCount: number;
  requiredDiploma: string;
  allowedBirthYears: number[];
};

type TeamCategoryRulesEditorProps = {
  rules: TeamCategoryRuleEditorItem[];
};

const diplomaOptions = ["D-Diplom", "C-Diplom", "B-Diplom", "A-Diplom"];

function parseBirthYears(value: string) {
  return value
    .split(/[,+\s]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item >= 1900 && item <= 2100);
}

export default function TeamCategoryRulesEditor({ rules }: TeamCategoryRulesEditorProps) {
  const initialRules = useMemo(
    () =>
      rules.map((rule) => ({
        ...rule,
        allowedBirthYearsInput: rule.allowedBirthYears.join(" + "),
      })),
    [rules]
  );

  const [items, setItems] = useState(initialRules);
  const [savingRuleId, setSavingRuleId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateItem(ruleId: string, field: string, value: string | number) {
    setItems((current) =>
      current.map((item) =>
        item.id === ruleId
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }

  function saveRule(ruleId: string) {
    const item = items.find((candidate) => candidate.id === ruleId);
    if (!item) return;

    setSavingRuleId(ruleId);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/team-category-rules/${ruleId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            minTrainerCount: item.minTrainerCount,
            requiredDiploma: item.requiredDiploma,
            allowedBirthYears: parseBirthYears(item.allowedBirthYearsInput),
          }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Speichern fehlgeschlagen.");
        }

        setItems((current) =>
          current.map((candidate) =>
            candidate.id === ruleId
              ? {
                  ...candidate,
                  minTrainerCount: payload.rule.minTrainerCount,
                  requiredDiploma: payload.rule.requiredDiploma,
                  allowedBirthYears: payload.rule.allowedBirthYears,
                  allowedBirthYearsInput: payload.rule.allowedBirthYears.join(" + "),
                }
              : candidate
          )
        );

        setMessage("✅ Teamregel gespeichert.");
      } catch (error) {
        setMessage(error instanceof Error ? `❌ ${error.message}` : "❌ Teamregel konnte nicht gespeichert werden.");
      } finally {
        setSavingRuleId(null);
      }
    });
  }

  return (
    <div className="mt-5 space-y-3">
      {items.map((rule) => (
        <div key={rule.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Kategorie</p>
              <h3 className="mt-1 text-lg font-black text-slate-900">{rule.category}</h3>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[560px]">
              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Trainer</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={rule.minTrainerCount}
                  onChange={(event) => updateItem(rule.id, "minTrainerCount", Number(event.target.value))}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Diplom</span>
                <select
                  value={rule.requiredDiploma}
                  onChange={(event) => updateItem(rule.id, "requiredDiploma", event.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300"
                >
                  {diplomaOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Jahrgänge</span>
                <input
                  value={rule.allowedBirthYearsInput}
                  onChange={(event) => updateItem(rule.id, "allowedBirthYearsInput", event.target.value)}
                  placeholder="2015 + 2016"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => saveRule(rule.id)}
              disabled={isPending || savingRuleId === rule.id}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-5 text-sm font-black text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {savingRuleId === rule.id ? "Speichert..." : "Speichern"}
            </button>
          </div>
        </div>
      ))}

      {message ? (
        <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">
          {message}
        </div>
      ) : null}
    </div>
  );
}
