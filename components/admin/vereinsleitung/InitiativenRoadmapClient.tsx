"use client";

import { useMemo, useState } from "react";

type SubtaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

type RoadmapMode = "QUARTER" | "MONTH";

type Subtask = {
  id: string;
  title: string;
  status: SubtaskStatus;
};

type Initiative = {
  id: string;
  title: string;
  owner: string;
  ownerInitials: string;
  roadmapMode: RoadmapMode;
  quarter: "Q1" | "Q2" | "Q3" | "Q4" | null;
  month: number | null;
  year: number;
  deadline: string;
  status: "GEPLANT" | "IN_ARBEIT" | "ON_TRACK" | "BLOCKIERT";
  subtasks: Subtask[];
};

const INITIAL_INITIATIVES: Initiative[] = [
  {
    id: "initiative-1",
    title: "Website Relaunch",
    owner: "Michael S.",
    ownerInitials: "MS",
    roadmapMode: "QUARTER",
    quarter: "Q2",
    month: null,
    year: 2026,
    deadline: "15.06.2026",
    status: "IN_ARBEIT",
    subtasks: [
      { id: "sub-1", title: "Design finalisieren", status: "DONE" },
      { id: "sub-2", title: "Content migrieren", status: "IN_PROGRESS" },
      { id: "sub-3", title: "Go-Live vorbereiten", status: "TODO" },
    ],
  },
  {
    id: "initiative-2",
    title: "Sponsorenlauf 2026",
    owner: "Thomas K.",
    ownerInitials: "TK",
    roadmapMode: "QUARTER",
    quarter: "Q3",
    month: null,
    year: 2026,
    deadline: "20.08.2026",
    status: "ON_TRACK",
    subtasks: [
      { id: "sub-4", title: "Location sichern", status: "DONE" },
      { id: "sub-5", title: "Kommunikation starten", status: "TODO" },
    ],
  },
  {
    id: "initiative-3",
    title: "Clubhaus Konzept",
    owner: "Sarah W.",
    ownerInitials: "SW",
    roadmapMode: "MONTH",
    quarter: null,
    month: 10,
    year: 2026,
    deadline: "30.10.2026",
    status: "GEPLANT",
    subtasks: [
      { id: "sub-6", title: "Anforderungen sammeln", status: "TODO" },
      { id: "sub-7", title: "Erste Skizzen erstellen", status: "TODO" },
    ],
  },
];

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;
const MONTH_OPTIONS = [
  { value: 1, label: "Januar" },
  { value: 2, label: "Februar" },
  { value: 3, label: "März" },
  { value: 4, label: "April" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Juni" },
  { value: 7, label: "Juli" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "Oktober" },
  { value: 11, label: "November" },
  { value: 12, label: "Dezember" },
] as const;

type InitiativeDraft = {
  id: string | null;
  title: string;
  owner: string;
  ownerInitials: string;
  roadmapMode: RoadmapMode;
  quarter: "Q1" | "Q2" | "Q3" | "Q4" | "";
  month: number | "";
  year: number;
  deadline: string;
  status: "GEPLANT" | "IN_ARBEIT" | "ON_TRACK" | "BLOCKIERT";
  subtasks: Subtask[];
};

function createEmptyDraft(): InitiativeDraft {
  return {
    id: null,
    title: "",
    owner: "",
    ownerInitials: "",
    roadmapMode: "QUARTER",
    quarter: "Q1",
    month: "",
    year: 2026,
    deadline: "",
    status: "GEPLANT",
    subtasks: [{ id: crypto.randomUUID(), title: "", status: "TODO" }],
  };
}

function getSubtaskProgressValue(status: SubtaskStatus) {
  switch (status) {
    case "DONE":
      return 100;
    case "IN_PROGRESS":
      return 50;
    default:
      return 0;
  }
}

function getInitiativeProgress(subtasks: Subtask[]) {
  const relevant = subtasks.filter((task) => task.title.trim().length > 0);

  if (relevant.length === 0) {
    return 0;
  }

  const total = relevant.reduce((accumulator, task) => {
    return accumulator + getSubtaskProgressValue(task.status);
  }, 0);

  return Math.round(total / relevant.length);
}

function getStatusBadgeClass(status: Initiative["status"]) {
  switch (status) {
    case "IN_ARBEIT":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "ON_TRACK":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "BLOCKIERT":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getSubtaskBadgeClass(status: SubtaskStatus) {
  switch (status) {
    case "DONE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "IN_PROGRESS":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getSlotLabel(initiative: Initiative) {
  if (initiative.roadmapMode === "MONTH" && initiative.month) {
    const monthLabel =
      MONTH_OPTIONS.find((month) => month.value === initiative.month)?.label ??
      "Unbekannt";

    return monthLabel + " " + initiative.year;
  }

  return (initiative.quarter ?? "Q?") + " " + initiative.year;
}

function mapDraftToInitiative(draft: InitiativeDraft): Initiative {
  return {
    id: draft.id ?? crypto.randomUUID(),
    title: draft.title.trim(),
    owner: draft.owner.trim(),
    ownerInitials: draft.ownerInitials.trim().toUpperCase(),
    roadmapMode: draft.roadmapMode,
    quarter: draft.roadmapMode === "QUARTER" ? (draft.quarter || "Q1") : null,
    month: draft.roadmapMode === "MONTH" ? Number(draft.month) : null,
    year: draft.year,
    deadline: draft.deadline,
    status: draft.status,
    subtasks: draft.subtasks.filter((task) => task.title.trim().length > 0),
  };
}

export default function InitiativenRoadmapClient() {
  const [initiatives, setInitiatives] = useState<Initiative[]>(INITIAL_INITIATIVES);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [draft, setDraft] = useState<InitiativeDraft>(createEmptyDraft());

  const roadmapItems = useMemo(() => {
    return initiatives.filter((initiative) => initiative.year === selectedYear);
  }, [initiatives, selectedYear]);

  const monthItems = roadmapItems.filter(
    (initiative) => initiative.roadmapMode === "MONTH",
  );

  function openCreateDialog() {
    setDraft({
      ...createEmptyDraft(),
      year: selectedYear,
    });
    setIsEditorOpen(true);
  }

  function openEditDialog(initiative: Initiative) {
    setDraft({
      id: initiative.id,
      title: initiative.title,
      owner: initiative.owner,
      ownerInitials: initiative.ownerInitials,
      roadmapMode: initiative.roadmapMode,
      quarter: initiative.quarter ?? "Q1",
      month: initiative.month ?? "",
      year: initiative.year,
      deadline: initiative.deadline,
      status: initiative.status,
      subtasks:
        initiative.subtasks.length > 0
          ? initiative.subtasks
          : [{ id: crypto.randomUUID(), title: "", status: "TODO" }],
    });
    setIsEditorOpen(true);
  }

  function closeDialog() {
    setIsEditorOpen(false);
  }

  function saveInitiative() {
    const mapped = mapDraftToInitiative(draft);

    if (!mapped.title || !mapped.owner || !mapped.ownerInitials || !mapped.deadline) {
      return;
    }

    setInitiatives((current) => {
      const exists = current.some((item) => item.id === mapped.id);

      if (exists) {
        return current.map((item) => (item.id === mapped.id ? mapped : item));
      }

      return [mapped, ...current];
    });

    setIsEditorOpen(false);
  }

  function deleteInitiative(initiativeId: string) {
    setInitiatives((current) =>
      current.filter((initiative) => initiative.id !== initiativeId),
    );
  }

  function addSubtask() {
    setDraft((current) => ({
      ...current,
      subtasks: [
        ...current.subtasks,
        { id: crypto.randomUUID(), title: "", status: "TODO" },
      ],
    }));
  }

  function updateSubtask(
    subtaskId: string,
    field: "title" | "status",
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      subtasks: current.subtasks.map((task) =>
        task.id === subtaskId
          ? {
              ...task,
              [field]: value,
            }
          : task,
      ) as Subtask[],
    }));
  }

  function removeSubtask(subtaskId: string) {
    setDraft((current) => ({
      ...current,
      subtasks:
        current.subtasks.length === 1
          ? current.subtasks
          : current.subtasks.filter((task) => task.id !== subtaskId),
    }));
  }

  return (
    <div className="space-y-8">
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="fca-eyebrow">Vereinsleitung</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-slate-900">
              Initiativen & Roadmap
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              Strategische Initiativen mit Roadmap-Slot, Deadline und subtasks-basierter
              Fortschrittslogik.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-[#0b4aa2]"
            >
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
              <option value={2028}>2028</option>
            </select>

            <button type="button" onClick={openCreateDialog} className="fca-button-primary">
              Initiative erfassen
            </button>
          </div>
        </div>
      </div>

      <section className="grid gap-5 xl:grid-cols-4">
        {QUARTERS.map((quarter) => {
          const items = roadmapItems.filter(
            (initiative) =>
              initiative.roadmapMode === "QUARTER" &&
              initiative.quarter === quarter,
          );

          return (
            <div
              key={quarter}
              className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {quarter} {selectedYear}
                </p>
              </div>

              <div className="space-y-4">
                {items.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-400">
                    Keine Initiativen
                  </div>
                ) : (
                  items.map((initiative) => {
                    const progress = getInitiativeProgress(initiative.subtasks);

                    return (
                      <div
                        key={initiative.id}
                        className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">
                              {initiative.title}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Deadline: {initiative.deadline}
                            </p>
                          </div>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusBadgeClass(
                              initiative.status,
                            )}`}
                          >
                            {initiative.status.replaceAll("_", " ")}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0b4aa2]/10 font-semibold text-[#0b4aa2]">
                              {initiative.ownerInitials}
                            </span>
                            <span>{initiative.owner}</span>
                          </div>

                          <span className="text-sm font-semibold text-[#0b4aa2]">
                            {progress}%
                          </span>
                        </div>

                        <div className="mt-3 h-2 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-[#0b4aa2]"
                            style={{ width: progress + "%" }}
                          />
                        </div>

                        <div className="mt-4 space-y-2">
                          {initiative.subtasks.map((task) => (
                            <div
                              key={task.id}
                              className="flex items-center justify-between gap-3 rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-2"
                            >
                              <span className="min-w-0 text-xs text-slate-700">
                                {task.title}
                              </span>
                              <span
                                className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${getSubtaskBadgeClass(
                                  task.status,
                                )}`}
                              >
                                {task.status}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() => openEditDialog(initiative)}
                            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Bearbeiten
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteInitiative(initiative.id)}
                            className="rounded-full border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                          >
                            Löschen
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Monatsplanung
            </p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">
              Monatlich geplante Initiativen
            </h3>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {monthItems.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-400">
              Keine monatlich geplanten Initiativen für {selectedYear}.
            </div>
          ) : (
            monthItems.map((initiative) => {
              const progress = getInitiativeProgress(initiative.subtasks);

              return (
                <div
                  key={initiative.id}
                  className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {initiative.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {getSlotLabel(initiative)} · Deadline {initiative.deadline}
                      </p>
                    </div>

                    <span className="text-sm font-semibold text-[#0b4aa2]">
                      {progress}%
                    </span>
                  </div>

                  <div className="mt-3 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-[#0b4aa2]"
                      style={{ width: progress + "%" }}
                    />
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEditDialog(initiative)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Bearbeiten
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteInitiative(initiative.id)}
                      className="rounded-full border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {isEditorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.22)]">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Initiativen Editor
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                  {draft.id ? "Initiative bearbeiten" : "Initiative erfassen"}
                </h3>
              </div>

              <button
                type="button"
                onClick={closeDialog}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Schliessen
              </button>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-900">
                    Titel
                  </label>
                  <input
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, title: event.target.value }))
                    }
                    className="w-full rounded-[18px] border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#0b4aa2]"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-900">
                      Owner
                    </label>
                    <input
                      value={draft.owner}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, owner: event.target.value }))
                      }
                      className="w-full rounded-[18px] border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#0b4aa2]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-900">
                      Initialen
                    </label>
                    <input
                      value={draft.ownerInitials}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          ownerInitials: event.target.value.toUpperCase(),
                        }))
                      }
                      className="w-full rounded-[18px] border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#0b4aa2]"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-900">
                      Status
                    </label>
                    <select
                      value={draft.status}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          status: event.target.value as Initiative["status"],
                        }))
                      }
                      className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0b4aa2]"
                    >
                      <option value="GEPLANT">Geplant</option>
                      <option value="IN_ARBEIT">In Arbeit</option>
                      <option value="ON_TRACK">On Track</option>
                      <option value="BLOCKIERT">Blockiert</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-900">
                      Deadline
                    </label>
                    <input
                      placeholder="TT.MM.JJJJ"
                      value={draft.deadline}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, deadline: event.target.value }))
                      }
                      className="w-full rounded-[18px] border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#0b4aa2]"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-900">
                      Planungsart
                    </label>
                    <select
                      value={draft.roadmapMode}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          roadmapMode: event.target.value as RoadmapMode,
                          quarter: event.target.value === "QUARTER" ? "Q1" : "",
                          month: event.target.value === "MONTH" ? 1 : "",
                        }))
                      }
                      className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0b4aa2]"
                    >
                      <option value="QUARTER">Quartal</option>
                      <option value="MONTH">Monat</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-900">
                      Jahr
                    </label>
                    <select
                      value={draft.year}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          year: Number(event.target.value),
                        }))
                      }
                      className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0b4aa2]"
                    >
                      <option value={2026}>2026</option>
                      <option value={2027}>2027</option>
                      <option value={2028}>2028</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-900">
                      {draft.roadmapMode === "QUARTER" ? "Quartal" : "Monat"}
                    </label>

                    {draft.roadmapMode === "QUARTER" ? (
                      <select
                        value={draft.quarter}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            quarter: event.target.value as InitiativeDraft["quarter"],
                          }))
                        }
                        className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0b4aa2]"
                      >
                        <option value="Q1">Q1</option>
                        <option value="Q2">Q2</option>
                        <option value="Q3">Q3</option>
                        <option value="Q4">Q4</option>
                      </select>
                    ) : (
                      <select
                        value={draft.month}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            month: Number(event.target.value),
                          }))
                        }
                        className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0b4aa2]"
                      >
                        {MONTH_OPTIONS.map((month) => (
                          <option key={month.value} value={month.value}>
                            {month.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Subtasks</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Der Fortschritt der Initiative wird aus den Subtask-Statuswerten berechnet.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addSubtask}
                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Subtask hinzufügen
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {draft.subtasks.map((task, index) => (
                    <div
                      key={task.id}
                      className="rounded-[20px] border border-slate-200 bg-white p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Subtask {index + 1}
                        </p>

                        <button
                          type="button"
                          onClick={() => removeSubtask(task.id)}
                          disabled={draft.subtasks.length === 1}
                          className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Entfernen
                        </button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                        <input
                          value={task.title}
                          onChange={(event) =>
                            updateSubtask(task.id, "title", event.target.value)
                          }
                          placeholder="Subtask Titel"
                          className="w-full rounded-[16px] border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#0b4aa2]"
                        />

                        <select
                          value={task.status}
                          onChange={(event) =>
                            updateSubtask(task.id, "status", event.target.value)
                          }
                          className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0b4aa2]"
                        >
                          <option value="TODO">Todo</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="DONE">Done</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[20px] border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">Abgeleiteter Fortschritt</p>
                    <span className="text-lg font-semibold text-[#0b4aa2]">
                      {getInitiativeProgress(draft.subtasks)}%
                    </span>
                  </div>

                  <div className="mt-3 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-[#0b4aa2]"
                      style={{ width: getInitiativeProgress(draft.subtasks) + "%" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Abbrechen
              </button>

              <button type="button" onClick={saveInitiative} className="fca-button-primary">
                Initiative speichern
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
