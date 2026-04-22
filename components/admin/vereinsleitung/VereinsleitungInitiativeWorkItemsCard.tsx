"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit3, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import type { InitiativeDetailWorkItem } from "@/components/admin/vereinsleitung/VereinsleitungInitiativeDetail";

type VereinsleitungInitiativeWorkItemsCardProps = {
  initiativeId: string;
  workItems: InitiativeDetailWorkItem[];
  totalCount: number;
  resolvedCount: number;
  progressPercent: number;
};

type DraftState = {
  title: string;
  priority: string;
  storyPoints: string;
  assigneeMode: string;
  assigneePersonId: string;
  externalAssigneeLabel: string;
  status: string;
};

function getStatusClass(status: string) {
  switch (status) {
    case "RESOLVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "IN_PROGRESS":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "RESOLVED":
      return "Erledigt";
    case "IN_PROGRESS":
      return "In Arbeit";
    default:
      return "Backlog";
  }
}

function getPriorityClass(priority: string) {
  switch (priority) {
    case "CRITICAL":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "MAJOR":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function buildDraft(item: InitiativeDetailWorkItem): DraftState {
  return {
    title: item.title,
    priority: item.priority,
    storyPoints: item.storyPoints === null ? "" : String(item.storyPoints),
    assigneeMode: item.assigneeMode,
    assigneePersonId: item.assigneePersonId ?? "",
    externalAssigneeLabel: item.externalAssigneeLabel ?? "",
    status: item.status,
  };
}

export default function VereinsleitungInitiativeWorkItemsCard({
  initiativeId,
  workItems,
  totalCount,
  resolvedCount,
  progressPercent,
}: VereinsleitungInitiativeWorkItemsCardProps) {
  const router = useRouter();

  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("MAJOR");
  const [newStoryPoints, setNewStoryPoints] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const sortedItems = useMemo(
    () => [...workItems].sort((a, b) => a.sortOrder - b.sortOrder),
    [workItems],
  );

  function startEdit(item: InitiativeDetailWorkItem) {
    setEditId(item.id);
    setDraft(buildDraft(item));
    setError("");
  }

  function stopEdit() {
    setEditId(null);
    setDraft(null);
    setError("");
  }

  async function createWorkItem() {
    if (!newTitle.trim() || createBusy) {
      return;
    }

    try {
      setCreateBusy(true);
      setError("");

      const response = await fetch(
        "/api/vereinsleitung/initiatives/" + initiativeId + "/work-items",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: newTitle.trim(),
            priority: newPriority,
            storyPoints: newStoryPoints.trim() || null,
            assigneeMode: "NONE",
            assigneePersonId: null,
            externalAssigneeLabel: null,
          }),
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Work Item konnte nicht erstellt werden.");
      }

      setNewTitle("");
      setNewPriority("MAJOR");
      setNewStoryPoints("");
      router.refresh();
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Erstellen fehlgeschlagen.");
    } finally {
      setCreateBusy(false);
    }
  }

  async function saveEdit(workItemId: string) {
    if (!draft || !draft.title.trim()) {
      setError("Titel ist erforderlich.");
      return;
    }

    try {
      setBusyId(workItemId);
      setError("");

      const response = await fetch(
        "/api/vereinsleitung/initiatives/work-items/" + workItemId,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: draft.title.trim(),
            priority: draft.priority,
            storyPoints: draft.storyPoints.trim() || null,
            assigneeMode: draft.assigneeMode,
            assigneePersonId: draft.assigneePersonId.trim() || null,
            externalAssigneeLabel: draft.externalAssigneeLabel.trim() || null,
            status: draft.status,
          }),
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Work Item konnte nicht gespeichert werden.");
      }

      stopEdit();
      router.refresh();
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteWorkItem(workItemId: string, workItemTitle: string) {
    const confirmed = confirm('Work Item "' + workItemTitle + '" wirklich loeschen?');
    if (!confirmed) {
      return;
    }

    try {
      setBusyId(workItemId);
      setError("");

      const response = await fetch(
        "/api/vereinsleitung/initiatives/work-items/" + workItemId,
        {
          method: "DELETE",
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Work Item konnte nicht geloescht werden.");
      }

      if (editId === workItemId) {
        stopEdit();
      }

      router.refresh();
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Loeschen fehlgeschlagen.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-[1.1rem] font-semibold text-slate-900">Work Items</h3>
          <p className="mt-2 text-sm text-slate-500">
            JIRA-artige Aufgabenliste mit Editieren und Loeschen.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
          <span>{totalCount} total</span>
          <span>{resolvedCount} erledigt</span>
          <span>{progressPercent}% Fortschritt</span>
        </div>
      </div>

      <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px_140px_auto]">
          <input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="Neues Work Item"
            className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
          />

          <select
            value={newPriority}
            onChange={(event) => setNewPriority(event.target.value)}
            className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
          >
            <option value="CRITICAL">Critical</option>
            <option value="MAJOR">Major</option>
            <option value="MINOR">Minor</option>
          </select>

          <input
            value={newStoryPoints}
            onChange={(event) => setNewStoryPoints(event.target.value)}
            placeholder="Story Points"
            className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
          />

          <button
            type="button"
            onClick={createWorkItem}
            disabled={createBusy || !newTitle.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#083a80] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {createBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Hinzufuegen
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      {sortedItems.length === 0 ? (
        <div className="mt-5 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-500">
          Noch keine Work Items vorhanden.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {sortedItems.map((item) => {
            const isEditing = editId === item.id && draft !== null;
            const isBusy = busyId === item.id;

            return (
              <article
                key={item.id}
                className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
              >
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <input
                        value={draft.title}
                        onChange={(event) =>
                          setDraft((current) =>
                            current ? { ...current, title: event.target.value } : current,
                          )
                        }
                        placeholder="Titel"
                        className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                      />

                      <select
                        value={draft.status}
                        onChange={(event) =>
                          setDraft((current) =>
                            current ? { ...current, status: event.target.value } : current,
                          )
                        }
                        className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                      >
                        <option value="BACKLOG">Backlog</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="RESOLVED">Resolved</option>
                      </select>

                      <select
                        value={draft.priority}
                        onChange={(event) =>
                          setDraft((current) =>
                            current ? { ...current, priority: event.target.value } : current,
                          )
                        }
                        className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                      >
                        <option value="CRITICAL">Critical</option>
                        <option value="MAJOR">Major</option>
                        <option value="MINOR">Minor</option>
                      </select>

                      <input
                        value={draft.storyPoints}
                        onChange={(event) =>
                          setDraft((current) =>
                            current ? { ...current, storyPoints: event.target.value } : current,
                          )
                        }
                        placeholder="Story Points"
                        className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                      />

                      <select
                        value={draft.assigneeMode}
                        onChange={(event) =>
                          setDraft((current) =>
                            current ? { ...current, assigneeMode: event.target.value } : current,
                          )
                        }
                        className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                      >
                        <option value="NONE">None</option>
                        <option value="PERSON">Person</option>
                        <option value="EXTERNAL">External</option>
                      </select>

                      <input
                        value={draft.assigneePersonId}
                        onChange={(event) =>
                          setDraft((current) =>
                            current ? { ...current, assigneePersonId: event.target.value } : current,
                          )
                        }
                        placeholder="Person ID (optional)"
                        className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                      />

                      <input
                        value={draft.externalAssigneeLabel}
                        onChange={(event) =>
                          setDraft((current) =>
                            current
                              ? { ...current, externalAssigneeLabel: event.target.value }
                              : current,
                          )
                        }
                        placeholder="Externer Assignee"
                        className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                      />
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={stopEdit}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <X className="h-4 w-4" />
                        Abbrechen
                      </button>

                      <button
                        type="button"
                        onClick={() => saveEdit(item.id)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#083a80] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Speichern
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={
                            "rounded-full border px-2.5 py-1 text-[11px] font-semibold " +
                            getPriorityClass(item.priority)
                          }
                        >
                          {item.priority}
                        </span>

                        <span
                          className={
                            "rounded-full border px-2.5 py-1 text-[11px] font-semibold " +
                            getStatusClass(item.status)
                          }
                        >
                          {getStatusLabel(item.status)}
                        </span>

                        {item.storyPoints !== null ? (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                            {item.storyPoints} SP
                          </span>
                        ) : null}
                      </div>

                      <h4 className="mt-3 text-base font-semibold text-slate-900">{item.title}</h4>

                      <div className="mt-3 text-sm text-slate-500">
                        Verantwortlich: {item.assigneeName}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Bearbeiten
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteWorkItem(item.id, item.title)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Loeschen
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}