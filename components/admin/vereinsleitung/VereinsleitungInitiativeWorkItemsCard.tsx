"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, Edit3, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import PeoplePicker, {
  type PeoplePickerPerson,
} from "@/components/admin/shared/people-picker/PeoplePicker";
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
  dueDate: string;
  assigneeMode: string;
  assigneePerson: PeoplePickerPerson | null;
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

function formatDateLabel(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function toDateInputValue(value: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

function isOverdue(value: string | null, status: string) {
  if (!value || status === "RESOLVED") {
    return false;
  }

  const dueDate = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  return dueDate.getTime() < today.getTime();
}

function getDueDateBadgeClass(value: string | null, status: string) {
  if (!value) {
    return "border-slate-200 bg-slate-50 text-slate-600";
  }

  if (isOverdue(value, status)) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (status === "RESOLVED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-blue-200 bg-blue-50 text-blue-700";
}

function getAssigneeCardClass(status: string) {
  switch (status) {
    case "RESOLVED":
      return "border-emerald-100 bg-emerald-50/60";
    case "IN_PROGRESS":
      return "border-blue-100 bg-blue-50/60";
    default:
      return "border-slate-200 bg-slate-50";
  }
}

function buildDraft(item: InitiativeDetailWorkItem): DraftState {
  return {
    title: item.title,
    priority: item.priority,
    dueDate: toDateInputValue(item.dueDateIso),
    assigneeMode: item.assigneeMode,
    assigneePerson: item.assigneePerson,
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
  const [newDueDate, setNewDueDate] = useState("");
  const [newAssigneeMode, setNewAssigneeMode] = useState("NONE");
  const [newAssigneePerson, setNewAssigneePerson] = useState<PeoplePickerPerson | null>(null);
  const [newExternalAssigneeLabel, setNewExternalAssigneeLabel] = useState("");
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

  function resetCreateFields() {
    setNewTitle("");
    setNewPriority("MAJOR");
    setNewDueDate("");
    setNewAssigneeMode("NONE");
    setNewAssigneePerson(null);
    setNewExternalAssigneeLabel("");
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
            dueDate: newDueDate || null,
            assigneeMode: newAssigneeMode,
            assigneePersonId: newAssigneeMode === "PERSON" ? newAssigneePerson?.id ?? null : null,
            externalAssigneeLabel:
              newAssigneeMode === "EXTERNAL" ? newExternalAssigneeLabel.trim() || null : null,
          }),
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Work Item konnte nicht erstellt werden.");
      }

      resetCreateFields();
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
            dueDate: draft.dueDate || null,
            assigneeMode: draft.assigneeMode,
            assigneePersonId:
              draft.assigneeMode === "PERSON" ? draft.assigneePerson?.id ?? null : null,
            externalAssigneeLabel:
              draft.assigneeMode === "EXTERNAL"
                ? draft.externalAssigneeLabel.trim() || null
                : null,
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

  async function quickSetStatus(item: InitiativeDetailWorkItem, nextStatus: string) {
    try {
      setBusyId(item.id);
      setError("");

      const response = await fetch(
        "/api/vereinsleitung/initiatives/work-items/" + item.id,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: item.title,
            priority: item.priority,
            dueDate: item.dueDateIso ? item.dueDateIso.slice(0, 10) : null,
            assigneeMode: item.assigneeMode,
            assigneePersonId: item.assigneeMode === "PERSON" ? item.assigneePersonId : null,
            externalAssigneeLabel:
              item.assigneeMode === "EXTERNAL" ? item.externalAssigneeLabel : null,
            status: nextStatus,
          }),
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Status konnte nicht aktualisiert werden.");
      }

      router.refresh();
    } catch (errorValue) {
      setError(
        errorValue instanceof Error ? errorValue.message : "Statuswechsel fehlgeschlagen.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function deleteWorkItem(workItemId: string, workItemTitle: string) {
    const confirmed = confirm('Work Item "' + workItemTitle + '" wirklich löschen?');
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
        throw new Error(payload?.error || "Work Item konnte nicht gelöscht werden.");
      }

      if (editId === workItemId) {
        stopEdit();
      }

      router.refresh();
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Löschen fehlgeschlagen.");
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
            Aufgaben mit Due Date, PeoplePicker und schnellen Status-Aktionen.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
          <span>{totalCount} total</span>
          <span>{resolvedCount} erledigt</span>
          <span>{progressPercent}% Fortschritt</span>
        </div>
      </div>

      <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_160px_180px]">
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
            type="date"
            value={newDueDate}
            onChange={(event) => setNewDueDate(event.target.value)}
            className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
          />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
          <select
            value={newAssigneeMode}
            onChange={(event) => {
              const mode = event.target.value;
              setNewAssigneeMode(mode);
              if (mode !== "PERSON") {
                setNewAssigneePerson(null);
              }
              if (mode !== "EXTERNAL") {
                setNewExternalAssigneeLabel("");
              }
            }}
            className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
          >
            <option value="NONE">Keine Zuweisung</option>
            <option value="PERSON">Person</option>
            <option value="EXTERNAL">Extern</option>
          </select>

          {newAssigneeMode === "PERSON" ? (
            <PeoplePicker
              mode="single"
              searchMode="vereinsleitung"
              selected={newAssigneePerson}
              onSelect={setNewAssigneePerson}
              placeholder="Person suchen und zuweisen"
              emptyText="Keine passende Person gefunden."
            />
          ) : newAssigneeMode === "EXTERNAL" ? (
            <input
              value={newExternalAssigneeLabel}
              onChange={(event) => setNewExternalAssigneeLabel(event.target.value)}
              placeholder="Externer Assignee"
              className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
            />
          ) : (
            <div className="rounded-[16px] border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
              Keine Person zugewiesen.
            </div>
          )}
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={createWorkItem}
            disabled={createBusy || !newTitle.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#083a80] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {createBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Hinzufügen
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
            const overdue = isOverdue(item.dueDateIso, item.status);

            return (
              <article
                key={item.id}
                className={`rounded-[24px] border bg-white p-4 shadow-sm transition ${
                  overdue
                    ? "border-rose-200 shadow-[0_10px_26px_rgba(244,63,94,0.08)]"
                    : "border-slate-200"
                }`}
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
                        type="date"
                        value={draft.dueDate}
                        onChange={(event) =>
                          setDraft((current) =>
                            current ? { ...current, dueDate: event.target.value } : current,
                          )
                        }
                        className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                      <select
                        value={draft.assigneeMode}
                        onChange={(event) =>
                          setDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  assigneeMode: event.target.value,
                                  assigneePerson:
                                    event.target.value === "PERSON" ? current.assigneePerson : null,
                                  externalAssigneeLabel:
                                    event.target.value === "EXTERNAL"
                                      ? current.externalAssigneeLabel
                                      : "",
                                }
                              : current,
                          )
                        }
                        className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                      >
                        <option value="NONE">Keine Zuweisung</option>
                        <option value="PERSON">Person</option>
                        <option value="EXTERNAL">Extern</option>
                      </select>

                      {draft.assigneeMode === "PERSON" ? (
                        <PeoplePicker
                          mode="single"
                          searchMode="vereinsleitung"
                          selected={draft.assigneePerson}
                          onSelect={(person) =>
                            setDraft((current) =>
                              current ? { ...current, assigneePerson: person } : current,
                            )
                          }
                          placeholder="Person suchen und zuweisen"
                          emptyText="Keine passende Person gefunden."
                        />
                      ) : draft.assigneeMode === "EXTERNAL" ? (
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
                      ) : (
                        <div className="rounded-[16px] border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
                          Keine Person zugewiesen.
                        </div>
                      )}
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
                  <div className="flex flex-col gap-4">
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

                          {item.dueDateIso ? (
                            <span
                              className={
                                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold " +
                                getDueDateBadgeClass(item.dueDateIso, item.status)
                              }
                            >
                              <Clock3 className="h-3 w-3" />
                              {overdue ? "Überfällig: " : "Fällig: "}
                              {formatDateLabel(item.dueDateIso)}
                            </span>
                          ) : null}
                        </div>

                        <h4 className="mt-3 text-base font-semibold text-slate-900">{item.title}</h4>

                        <div
                          className={
                            "mt-3 inline-flex items-center gap-2 rounded-[16px] border px-3 py-2 text-sm " +
                            getAssigneeCardClass(item.status)
                          }
                        >
                          <span className="font-semibold text-slate-900">Verantwortlich:</span>
                          <span className="text-slate-600">{item.assigneeName}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {item.status !== "BACKLOG" ? (
                          <button
                            type="button"
                            onClick={() => quickSetStatus(item, "BACKLOG")}
                            disabled={isBusy}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Zu Backlog
                          </button>
                        ) : null}

                        {item.status !== "IN_PROGRESS" ? (
                          <button
                            type="button"
                            onClick={() => quickSetStatus(item, "IN_PROGRESS")}
                            disabled={isBusy}
                            className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock3 className="h-3.5 w-3.5" />}
                            In Arbeit
                          </button>
                        ) : null}

                        {item.status !== "RESOLVED" ? (
                          <button
                            type="button"
                            onClick={() => quickSetStatus(item, "RESOLVED")}
                            disabled={isBusy}
                            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            Erledigen
                          </button>
                        ) : null}

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
                          Löschen
                        </button>
                      </div>
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
