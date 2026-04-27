"use client";

import { useMemo, useState, useTransition } from "react";
import { GripVertical, Plus, Save, Trash2 } from "lucide-react";

type TeamCategoryRuleEditorItem = {
  id: string;
  category: string;
  minTrainerCount: number;
  requiredDiploma: string;
  requiredDiplomaTrainerCount: number;
  allowedBirthYears: number[];
  sortOrder: number;
};

type TeamCategoryRulesEditorProps = {
  clubConfigId: string | null;
  rules: TeamCategoryRuleEditorItem[];
};

type EditableRule = TeamCategoryRuleEditorItem & {
  allowedBirthYearsInput: string;
};

const diplomaOptions = ["D-Diplom", "C-Diplom", "B-Diplom", "A-Diplom"];

function parseBirthYears(value: string) {
  return value
    .split(/[,+\s]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item >= 1900 && item <= 2100);
}

function toEditableRule(rule: TeamCategoryRuleEditorItem): EditableRule {
  return {
    ...rule,
    allowedBirthYearsInput: rule.allowedBirthYears.join(" + "),
  };
}

export default function TeamCategoryRulesEditor({ clubConfigId, rules }: TeamCategoryRulesEditorProps) {
  const initialRules = useMemo(() => rules.map(toEditableRule), [rules]);

  const [items, setItems] = useState(initialRules);
  const [newRule, setNewRule] = useState({
    category: "",
    minTrainerCount: 2,
    requiredDiploma: "D-Diplom",
    requiredDiplomaTrainerCount: 1,
    allowedBirthYearsInput: "",
  });
  const [savingRuleId, setSavingRuleId] = useState<string | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draggedRuleId, setDraggedRuleId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function moveRule(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;

    setItems((current) => {
      const draggedIndex = current.findIndex((item) => item.id === draggedId);
      const targetIndex = current.findIndex((item) => item.id === targetId);

      if (draggedIndex === -1 || targetIndex === -1) return current;

      const next = [...current];
      const [draggedItem] = next.splice(draggedIndex, 1);
      next.splice(targetIndex, 0, draggedItem);

      return next.map((item, index) => ({
        ...item,
        sortOrder: index,
      }));
    });
  }

  function handleRuleDragStart(event: React.DragEvent<HTMLDivElement>, ruleId: string) {
    setDraggedRuleId(ruleId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", ruleId);
  }

  function handleRuleDragEnter(targetRuleId: string) {
    if (!draggedRuleId || draggedRuleId === targetRuleId) return;
    moveRule(draggedRuleId, targetRuleId);
  }

  function saveOrder() {
    setSavingOrder(true);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/team-category-rules", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderedIds: items.map((item) => item.id),
          }),
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error ?? "Sortierung konnte nicht gespeichert werden.");
        }

        setMessage("✅ Sortierung gespeichert.");
      } catch (error) {
        setMessage(error instanceof Error ? `❌ ${error.message}` : "❌ Sortierung konnte nicht gespeichert werden.");
      } finally {
        setSavingOrder(false);
      }
    });
  }

  function updateItem(ruleId: string, field: keyof EditableRule, value: string | number) {
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            minTrainerCount: item.minTrainerCount,
            requiredDiploma: item.requiredDiploma,
            requiredDiplomaTrainerCount: item.requiredDiplomaTrainerCount,
            allowedBirthYears: parseBirthYears(item.allowedBirthYearsInput),
          }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Speichern fehlgeschlagen.");
        }

        setItems((current) =>
          current.map((candidate) =>
            candidate.id === ruleId ? toEditableRule(payload.rule) : candidate
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

  function createRule() {
    if (!clubConfigId) {
      setMessage("❌ ClubConfig fehlt.");
      return;
    }

    setCreating(true);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/team-category-rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clubConfigId,
            category: newRule.category,
            minTrainerCount: newRule.minTrainerCount,
            requiredDiploma: newRule.requiredDiploma,
            requiredDiplomaTrainerCount: newRule.requiredDiplomaTrainerCount,
            allowedBirthYears: parseBirthYears(newRule.allowedBirthYearsInput),
          }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Kategorie konnte nicht erstellt werden.");
        }

        setItems((current) => [...current, toEditableRule({ ...payload.rule, sortOrder: current.length })]);
        setNewRule({
          category: "",
          minTrainerCount: 2,
          requiredDiploma: "D-Diplom",
          requiredDiplomaTrainerCount: 1,
          allowedBirthYearsInput: "",
        });
        setMessage("✅ Teamkategorie erstellt.");
      } catch (error) {
        setMessage(error instanceof Error ? `❌ ${error.message}` : "❌ Teamkategorie konnte nicht erstellt werden.");
      } finally {
        setCreating(false);
      }
    });
  }

  function deleteRule(ruleId: string) {
    const item = items.find((candidate) => candidate.id === ruleId);
    if (!item) return;

    const confirmed = window.confirm(`Teamkategorie "${item.category}" wirklich löschen?`);
    if (!confirmed) return;

    setDeletingRuleId(ruleId);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/team-category-rules/${ruleId}`, {
          method: "DELETE",
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error ?? "Kategorie konnte nicht gelöscht werden.");
        }

        setItems((current) => current.filter((candidate) => candidate.id !== ruleId));
        setMessage("✅ Teamkategorie gelöscht.");
      } catch (error) {
        setMessage(error instanceof Error ? `❌ ${error.message}` : "❌ Teamkategorie konnte nicht gelöscht werden.");
      } finally {
        setDeletingRuleId(null);
      }
    });
  }

  return (
    <div className="mt-5 space-y-3">
      <div className="rounded-[24px] border border-blue-100 bg-blue-50/60 p-5">
        <div className="grid gap-3 xl:grid-cols-[1fr_0.7fr_0.9fr_0.7fr_1fr_auto] xl:items-end">
          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Neue Kategorie</span>
            <input
              value={newRule.category}
              onChange={(event) => setNewRule((current) => ({ ...current, category: event.target.value.toUpperCase() }))}
              placeholder="z.B. FF-17"
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Trainer</span>
            <input
              type="number"
              min={0}
              max={20}
              value={newRule.minTrainerCount}
              onChange={(event) => setNewRule((current) => ({ ...current, minTrainerCount: Number(event.target.value) }))}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Diplom</span>
            <select
              value={newRule.requiredDiploma}
              onChange={(event) => setNewRule((current) => ({ ...current, requiredDiploma: event.target.value }))}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300"
            >
              {diplomaOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Diplom-Anz.</span>
            <input
              type="number"
              min={0}
              max={20}
              value={newRule.requiredDiplomaTrainerCount}
              onChange={(event) => setNewRule((current) => ({ ...current, requiredDiplomaTrainerCount: Number(event.target.value) }))}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Jahrgänge</span>
            <input
              value={newRule.allowedBirthYearsInput}
              onChange={(event) => setNewRule((current) => ({ ...current, allowedBirthYearsInput: event.target.value }))}
              placeholder="2015 + 2016"
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300"
            />
          </label>

          <button
            type="button"
            onClick={createRule}
            disabled={isPending || creating || !newRule.category.trim()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#0b4aa2]/20 bg-white px-5 text-sm font-black text-[#0b4aa2] shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {creating ? "Erstellt..." : "Hinzufügen"}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Reihenfolge</p>
          <p className="mt-1 text-sm font-bold text-slate-600">Kategorien per Drag & Drop sortieren.</p>
        </div>
        <button
          type="button"
          onClick={saveOrder}
          disabled={isPending || savingOrder}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#0b4aa2]/20 bg-white px-5 text-sm font-black text-[#0b4aa2] shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {savingOrder ? "Speichert..." : "Reihenfolge speichern"}
        </button>
      </div>

      {items.map((rule) => (
        <div
          key={rule.id}
          onDragEnter={() => handleRuleDragEnter(rule.id)}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDraggedRuleId(null);
          }}
          className={`rounded-[24px] border border-slate-200 bg-slate-50 p-5 transition ${
            draggedRuleId === rule.id ? "opacity-50" : ""
          }`}
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex items-center gap-3">
              <div
                draggable
                onDragStart={(event) => handleRuleDragStart(event, rule.id)}
                onDragEnd={() => setDraggedRuleId(null)}
                className="flex h-10 w-10 cursor-grab items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 active:cursor-grabbing"
                title="Ziehen zum Sortieren"
              >
                <GripVertical className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Kategorie</p>
                <h3 className="mt-1 text-lg font-black text-slate-900">{rule.category}</h3>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4 xl:min-w-[680px]">
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
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Diplom-Anz.</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={rule.requiredDiplomaTrainerCount}
                  onChange={(event) => updateItem(rule.id, "requiredDiplomaTrainerCount", Number(event.target.value))}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300"
                />
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

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => saveRule(rule.id)}
                disabled={isPending || savingRuleId === rule.id}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-5 text-sm font-black text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {savingRuleId === rule.id ? "Speichert..." : "Speichern"}
              </button>

              <button
                type="button"
                onClick={() => deleteRule(rule.id)}
                disabled={isPending || deletingRuleId === rule.id}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={`${rule.category} löschen`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
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