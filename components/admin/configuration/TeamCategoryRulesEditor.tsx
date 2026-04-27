"use client";

import { useMemo, useState, useTransition } from "react";
import { GripVertical, Plus, Save, Trash2, X } from "lucide-react";

type QualificationDefinitionOption = {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
};

type QualificationRequirementItem = {
  id?: string;
  qualificationDefinitionId: string;
  qualificationDefinitionName: string;
  qualificationDefinition?: {
    name: string;
  };
  requiredTrainerCount: number;
  sortOrder: number;
};

type TeamCategoryRuleEditorItem = {
  id: string;
  category: string;
  minTrainerCount: number;
  maxPlayersPerTrainer: number;
  allowedBirthYears: number[];
  sortOrder: number;
  qualificationRequirements: QualificationRequirementItem[];
};

type Props = {
  clubConfigId: string | null;
  qualificationDefinitions: QualificationDefinitionOption[];
  rules: TeamCategoryRuleEditorItem[];
};

type EditableRule = TeamCategoryRuleEditorItem & {
  allowedBirthYearsInput: string;
};

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

function normalizeRequirements(requirements: QualificationRequirementItem[]) {
  return requirements
    .filter((requirement) => requirement.qualificationDefinitionId)
    .map((requirement, index) => ({
      qualificationDefinitionId: requirement.qualificationDefinitionId,
      requiredTrainerCount: requirement.requiredTrainerCount,
      sortOrder: index,
    }));
}

export default function TeamCategoryRulesEditor({ clubConfigId, qualificationDefinitions, rules }: Props) {
  const activeQualificationDefinitions = qualificationDefinitions.filter((definition) => definition.isActive);
  const firstQualificationId = activeQualificationDefinitions[0]?.id ?? "";
  const initialRules = useMemo(() => rules.map(toEditableRule), [rules]);

  const [items, setItems] = useState(initialRules);
  const [newRule, setNewRule] = useState({
    category: "",
    minTrainerCount: 2,
    maxPlayersPerTrainer: 10,
    allowedBirthYearsInput: "",
    qualificationRequirements: [] as QualificationRequirementItem[],
  });
  const [savingRuleId, setSavingRuleId] = useState<string | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draggedRuleId, setDraggedRuleId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function getQualificationName(id: string) {
    return qualificationDefinitions.find((definition) => definition.id === id)?.name ?? "Qualifikation";
  }

  function addRequirement(ruleId: string) {
    if (!firstQualificationId) {
      setMessage("❌ Bitte zuerst eine Qualifikation erfassen.");
      return;
    }

    setItems((current) =>
      current.map((item) =>
        item.id === ruleId
          ? {
              ...item,
              qualificationRequirements: [
                ...item.qualificationRequirements,
                {
                  qualificationDefinitionId: firstQualificationId,
                  qualificationDefinitionName: getQualificationName(firstQualificationId),
                  requiredTrainerCount: 1,
                  sortOrder: item.qualificationRequirements.length,
                },
              ],
            }
          : item
      )
    );
  }

  function updateRequirement(ruleId: string, index: number, field: "qualificationDefinitionId" | "requiredTrainerCount", value: string | number) {
    setItems((current) =>
      current.map((item) =>
        item.id === ruleId
          ? {
              ...item,
              qualificationRequirements: item.qualificationRequirements.map((requirement, requirementIndex) =>
                requirementIndex === index
                  ? {
                      ...requirement,
                      [field]: value,
                      qualificationDefinitionName: field === "qualificationDefinitionId" ? getQualificationName(String(value)) : requirement.qualificationDefinitionName,
                    }
                  : requirement
              ),
            }
          : item
      )
    );
  }

  function removeRequirement(ruleId: string, index: number) {
    setItems((current) =>
      current.map((item) =>
        item.id === ruleId
          ? {
              ...item,
              qualificationRequirements: item.qualificationRequirements.filter((_, requirementIndex) => requirementIndex !== index),
            }
          : item
      )
    );
  }

  function addNewRuleRequirement() {
    if (!firstQualificationId) {
      setMessage("❌ Bitte zuerst eine Qualifikation erfassen.");
      return;
    }

    setNewRule((current) => ({
      ...current,
      qualificationRequirements: [
        ...current.qualificationRequirements,
        {
          qualificationDefinitionId: firstQualificationId,
          qualificationDefinitionName: getQualificationName(firstQualificationId),
          requiredTrainerCount: 1,
          sortOrder: current.qualificationRequirements.length,
        },
      ],
    }));
  }

  function updateNewRuleRequirement(index: number, field: "qualificationDefinitionId" | "requiredTrainerCount", value: string | number) {
    setNewRule((current) => ({
      ...current,
      qualificationRequirements: current.qualificationRequirements.map((requirement, requirementIndex) =>
        requirementIndex === index
          ? {
              ...requirement,
              [field]: value,
              qualificationDefinitionName: field === "qualificationDefinitionId" ? getQualificationName(String(value)) : requirement.qualificationDefinitionName,
            }
          : requirement
      ),
    }));
  }

  function removeNewRuleRequirement(index: number) {
    setNewRule((current) => ({
      ...current,
      qualificationRequirements: current.qualificationRequirements.filter((_, requirementIndex) => requirementIndex !== index),
    }));
  }

  function updateItem(ruleId: string, field: keyof EditableRule, value: string | number) {
    setItems((current) => current.map((item) => (item.id === ruleId ? { ...item, [field]: value } : item)));
  }

  function mapApiRule(rule: TeamCategoryRuleEditorItem & { qualificationRequirements?: Array<QualificationRequirementItem & { qualificationDefinition?: { name: string } }> }): TeamCategoryRuleEditorItem {
    return {
      id: rule.id,
      category: rule.category,
      minTrainerCount: rule.minTrainerCount,
      maxPlayersPerTrainer: rule.maxPlayersPerTrainer,
      allowedBirthYears: rule.allowedBirthYears,
      sortOrder: rule.sortOrder,
      qualificationRequirements: (rule.qualificationRequirements ?? []).map((requirement, index) => ({
        id: requirement.id,
        qualificationDefinitionId: requirement.qualificationDefinitionId,
        qualificationDefinitionName: requirement.qualificationDefinition?.name ?? requirement.qualificationDefinitionName ?? getQualificationName(requirement.qualificationDefinitionId),
        requiredTrainerCount: requirement.requiredTrainerCount,
        sortOrder: requirement.sortOrder ?? index,
      })),
    };
  }

  function saveOrder() {
    setSavingOrder(true);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/team-category-rules", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedIds: items.map((item) => item.id) }),
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error ?? "Sortierung konnte nicht gespeichert werden.");
        setMessage("✅ Sortierung gespeichert.");
      } catch (error) {
        setMessage(error instanceof Error ? `❌ ${error.message}` : "❌ Sortierung konnte nicht gespeichert werden.");
      } finally {
        setSavingOrder(false);
      }
    });
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
            maxPlayersPerTrainer: item.maxPlayersPerTrainer,
            qualificationRequirements: normalizeRequirements(item.qualificationRequirements),
            allowedBirthYears: parseBirthYears(item.allowedBirthYearsInput),
          }),
        });

        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Speichern fehlgeschlagen.");

        setItems((current) => current.map((candidate) => (candidate.id === ruleId ? toEditableRule(mapApiRule(payload.rule)) : candidate)));
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
            maxPlayersPerTrainer: newRule.maxPlayersPerTrainer,
            qualificationRequirements: normalizeRequirements(newRule.qualificationRequirements),
            allowedBirthYears: parseBirthYears(newRule.allowedBirthYearsInput),
          }),
        });

        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Kategorie konnte nicht erstellt werden.");

        setItems((current) => [...current, toEditableRule({ ...mapApiRule(payload.rule), sortOrder: current.length })]);
        setNewRule({ category: "", minTrainerCount: 2, maxPlayersPerTrainer: 10, allowedBirthYearsInput: "", qualificationRequirements: [] });
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
        const response = await fetch(`/api/admin/team-category-rules/${ruleId}`, { method: "DELETE" });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error ?? "Kategorie konnte nicht gelöscht werden.");

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
        <div className="grid gap-3 xl:grid-cols-[1fr_0.55fr_0.65fr_1fr_auto] xl:items-end">
          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Neue Kategorie</span>
            <input value={newRule.category} onChange={(event) => setNewRule((current) => ({ ...current, category: event.target.value.toUpperCase() }))} placeholder="z.B. FF-17" className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300" />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Trainer</span>
            <input type="number" min={0} max={20} value={newRule.minTrainerCount} onChange={(event) => setNewRule((current) => ({ ...current, minTrainerCount: Number(event.target.value) }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300" />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Spieler / Trainer</span>
            <input type="number" min={1} max={50} value={newRule.maxPlayersPerTrainer} onChange={(event) => setNewRule((current) => ({ ...current, maxPlayersPerTrainer: Number(event.target.value) }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300" />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Jahrgänge</span>
            <input value={newRule.allowedBirthYearsInput} onChange={(event) => setNewRule((current) => ({ ...current, allowedBirthYearsInput: event.target.value }))} placeholder="2015 + 2016" className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300" />
          </label>

          <button type="button" onClick={createRule} disabled={isPending || creating || !newRule.category.trim()} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#0b4aa2]/20 bg-white px-5 text-sm font-black text-[#0b4aa2] shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50">
            <Plus className="h-4 w-4" />
            {creating ? "Erstellt..." : "Hinzufügen"}
          </button>
        </div>

        <div className="mt-4 rounded-[20px] border border-blue-100 bg-white/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Anforderungen neue Kategorie</p>
            <button type="button" onClick={addNewRuleRequirement} className="rounded-full border border-blue-100 bg-white px-3 py-2 text-xs font-black text-[#0b4aa2] hover:bg-blue-50">+ Anforderung</button>
          </div>

          <div className="mt-3 grid gap-2">
            {newRule.qualificationRequirements.map((requirement, index) => (
              <div key={`${requirement.qualificationDefinitionId}-${index}`} className="grid gap-2 md:grid-cols-[1fr_120px_auto]">
                <select value={requirement.qualificationDefinitionId} onChange={(event) => updateNewRuleRequirement(index, "qualificationDefinitionId", event.target.value)} className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900">
                  {activeQualificationDefinitions.map((definition) => <option key={definition.id} value={definition.id}>{definition.name}</option>)}
                </select>
                <input type="number" min={0} max={20} value={requirement.requiredTrainerCount} onChange={(event) => updateNewRuleRequirement(index, "requiredTrainerCount", Number(event.target.value))} className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900" />
                <button type="button" onClick={() => removeNewRuleRequirement(index)} className="h-10 rounded-full border border-slate-200 bg-white px-3 text-slate-400 hover:text-red-600"><X className="h-4 w-4" /></button>
              </div>
            ))}
            {newRule.qualificationRequirements.length === 0 ? <p className="text-sm font-semibold text-slate-500">Keine Qualifikationsanforderung gesetzt.</p> : null}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Reihenfolge</p>
          <p className="mt-1 text-sm font-bold text-slate-600">Kategorien per Drag & Drop sortieren.</p>
        </div>
        <button type="button" onClick={saveOrder} disabled={isPending || savingOrder} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#0b4aa2]/20 bg-white px-5 text-sm font-black text-[#0b4aa2] shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50">
          <Save className="h-4 w-4" />
          {savingOrder ? "Speichert..." : "Reihenfolge speichern"}
        </button>
      </div>

      {items.map((rule) => (
        <div key={rule.id} onDragEnter={() => draggedRuleId && draggedRuleId !== rule.id ? setItems((current) => {
          const draggedIndex = current.findIndex((item) => item.id === draggedRuleId);
          const targetIndex = current.findIndex((item) => item.id === rule.id);
          if (draggedIndex === -1 || targetIndex === -1) return current;
          const next = [...current];
          const [draggedItem] = next.splice(draggedIndex, 1);
          next.splice(targetIndex, 0, draggedItem);
          return next.map((item, index) => ({ ...item, sortOrder: index }));
        }) : null} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => { event.preventDefault(); setDraggedRuleId(null); }} className={`rounded-[24px] border border-slate-200 bg-slate-50 p-5 transition ${draggedRuleId === rule.id ? "opacity-50" : ""}`}>
          <div className="grid gap-4 xl:grid-cols-[44px_140px_minmax(0,1fr)_auto] xl:items-start">
            <div draggable onDragStart={(event) => { setDraggedRuleId(rule.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", rule.id); }} onDragEnd={() => setDraggedRuleId(null)} className="flex h-10 w-10 cursor-grab items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 active:cursor-grabbing" title="Ziehen zum Sortieren">
              <GripVertical className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Kategorie</p>
              <h3 className="mt-1 truncate text-[15px] font-black uppercase tracking-tight text-slate-950" title={rule.category}>{rule.category}</h3>
            </div>

            <div className="grid min-w-0 gap-3">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Trainer</span>
                  <input type="number" min={0} max={20} value={rule.minTrainerCount} onChange={(event) => updateItem(rule.id, "minTrainerCount", Number(event.target.value))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Spieler / Trainer</span>
                  <input type="number" min={1} max={50} value={rule.maxPlayersPerTrainer} onChange={(event) => updateItem(rule.id, "maxPlayersPerTrainer", Number(event.target.value))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Jahrgänge</span>
                  <input value={rule.allowedBirthYearsInput} onChange={(event) => updateItem(rule.id, "allowedBirthYearsInput", event.target.value)} placeholder="2015 + 2016" className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300" />
                </label>
              </div>

              <div className="rounded-[20px] border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Qualifikationsanforderungen</p>
                  <button type="button" onClick={() => addRequirement(rule.id)} className="rounded-full border border-blue-100 bg-white px-3 py-2 text-xs font-black text-[#0b4aa2] hover:bg-blue-50">+ Anforderung</button>
                </div>
                <div className="mt-3 grid gap-2">
                  {rule.qualificationRequirements.map((requirement, index) => (
                    <div key={`${rule.id}-${requirement.qualificationDefinitionId}-${index}`} className="grid gap-2 md:grid-cols-[1fr_120px_auto]">
                      <select value={requirement.qualificationDefinitionId} onChange={(event) => updateRequirement(rule.id, index, "qualificationDefinitionId", event.target.value)} className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900">
                        {activeQualificationDefinitions.map((definition) => <option key={definition.id} value={definition.id}>{definition.name}</option>)}
                      </select>
                      <input type="number" min={0} max={20} value={requirement.requiredTrainerCount} onChange={(event) => updateRequirement(rule.id, index, "requiredTrainerCount", Number(event.target.value))} className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900" />
                      <button type="button" onClick={() => removeRequirement(rule.id, index)} className="h-10 rounded-full border border-slate-200 bg-white px-3 text-slate-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                  {rule.qualificationRequirements.length === 0 ? <p className="text-sm font-semibold text-slate-500">Keine Qualifikationsanforderung gesetzt.</p> : null}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => saveRule(rule.id)} disabled={isPending || savingRuleId === rule.id} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-5 text-sm font-black text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60">
                <Save className="h-4 w-4" />
                {savingRuleId === rule.id ? "Speichert..." : "Speichern"}
              </button>
              <button type="button" onClick={() => deleteRule(rule.id)} disabled={isPending || deletingRuleId === rule.id} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60" aria-label={`${rule.category} löschen`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ))}

      {message ? <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">{message}</div> : null}
    </div>
  );
}



