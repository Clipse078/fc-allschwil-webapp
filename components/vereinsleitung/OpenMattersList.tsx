"use client";

import { useEffect, useMemo, useState } from "react";

type MatterStatus = "OPEN" | "IN_PROGRESS" | "DONE";
type MatterPriority = "LOW" | "MEDIUM" | "HIGH";

type PersonLite = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
};

type Matter = {
  id: string;
  title: string;
  description: string | null;
  status: MatterStatus;
  priority: MatterPriority;
  ownerPersonId?: string | null;
  dueDate?: string | null;
  owner?: PersonLite | null;
};

type PersonSearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
};

type EditingMatterState = {
  id: string;
  title: string;
  description: string;
  priority: MatterPriority;
  ownerPersonId: string;
  dueDate: string;
};

function getStatusClass(status: MatterStatus) {
  switch (status) {
    case "IN_PROGRESS":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "DONE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function getPriorityClass(priority: MatterPriority) {
  switch (priority) {
    case "HIGH":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "LOW":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function getStatusLabel(status: MatterStatus) {
  switch (status) {
    case "IN_PROGRESS":
      return "In Bearbeitung";
    case "DONE":
      return "Erledigt";
    default:
      return "Offen";
  }
}

function getPriorityLabel(priority: MatterPriority) {
  switch (priority) {
    case "HIGH":
      return "Hoch";
    case "LOW":
      return "Niedrig";
    default:
      return "Mittel";
  }
}

function getPersonName(person: {
  firstName: string;
  lastName: string;
  displayName: string | null;
}) {
  return person.displayName || person.firstName + " " + person.lastName;
}

function formatDueDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString("de-CH");
}

function toDateInputValue(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

export default function OpenMattersList() {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<MatterPriority>("MEDIUM");
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [ownerSearchQuery, setOwnerSearchQuery] = useState("");
  const [ownerSearchLoading, setOwnerSearchLoading] = useState(false);
  const [ownerSearchError, setOwnerSearchError] = useState("");
  const [ownerSearchResults, setOwnerSearchResults] = useState<PersonSearchResult[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [statusUpdateError, setStatusUpdateError] = useState("");
  const [actionError, setActionError] = useState("");
  const [updatingMatterId, setUpdatingMatterId] = useState<string | null>(null);
  const [editingMatter, setEditingMatter] = useState<EditingMatterState | null>(null);
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [deletingMatterId, setDeletingMatterId] = useState<string | null>(null);
  const [editOwnerSearchQuery, setEditOwnerSearchQuery] = useState("");
  const [editOwnerSearchLoading, setEditOwnerSearchLoading] = useState(false);
  const [editOwnerSearchError, setEditOwnerSearchError] = useState("");
  const [editOwnerSearchResults, setEditOwnerSearchResults] = useState<PersonSearchResult[]>([]);

  const selectedOwner =
    ownerSearchResults.find((item) => item.id === selectedOwnerId) ?? null;

  const selectedEditOwner =
    editingMatter && editOwnerSearchResults.find((item) => item.id === editingMatter.ownerPersonId);

  async function searchOwners(
    query: string,
    setLoading: (value: boolean) => void,
    setErrorState: (value: string) => void,
    setResults: (value: PersonSearchResult[]) => void,
  ) {
    if (query.trim().length < 2) {
      setErrorState("Bitte mindestens 2 Zeichen eingeben.");
      setResults([]);
      return;
    }

    setLoading(true);
    setErrorState("");

    try {
      const response = await fetch(
        "/api/people/search?q=" + encodeURIComponent(query.trim()) + "&mode=any",
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Personensuche konnte nicht geladen werden.");
      }

      setResults(Array.isArray(data) ? (data as PersonSearchResult[]) : []);
    } catch (caughtError) {
      setErrorState(
        caughtError instanceof Error
          ? caughtError.message
          : "Personensuche konnte nicht geladen werden.",
      );
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadMatters() {
    setIsLoading(true);
    setLoadError("");

    try {
      const response = await fetch("/api/vereinsleitung/matters", {
        cache: "no-store",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "Offene Themen konnten nicht geladen werden.",
        );
      }

      const data = await response.json();
      setMatters(Array.isArray(data) ? (data as Matter[]) : []);
    } catch (caughtError) {
      setMatters([]);
      setLoadError(
        caughtError instanceof Error
          ? caughtError.message
          : "Offene Themen konnten nicht geladen werden.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadMatters();
  }, []);

  const openCount = useMemo(() => {
    return matters.filter((matter) => matter.status !== "DONE").length;
  }, [matters]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError("");
    setActionError("");

    try {
      const response = await fetch("/api/vereinsleitung/matters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          priority,
          ownerPersonId: selectedOwnerId,
          dueDate,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          typeof data?.error === "string" ? data.error : "Erstellen fehlgeschlagen.",
        );
      }

      const createdMatter = (await response.json()) as Matter;

      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      setSelectedOwnerId("");
      setDueDate("");
      setOwnerSearchQuery("");
      setOwnerSearchResults([]);
      setMatters((currentMatters) => [createdMatter, ...currentMatters]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Thema konnte nicht erstellt werden.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStatusChange(matterId: string, nextStatus: MatterStatus) {
    if (updatingMatterId || savingEditId || deletingMatterId) {
      return;
    }

    setUpdatingMatterId(matterId);
    setStatusUpdateError("");
    setActionError("");

    try {
      const response = await fetch("/api/vereinsleitung/matters", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: matterId,
          status: nextStatus,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "Status konnte nicht aktualisiert werden.",
        );
      }

      const updatedMatter = (await response.json()) as Matter;

      setMatters((currentMatters) =>
        currentMatters.map((matter) =>
          matter.id === updatedMatter.id ? updatedMatter : matter,
        ),
      );
    } catch (caughtError) {
      setStatusUpdateError(
        caughtError instanceof Error
          ? caughtError.message
          : "Status konnte nicht aktualisiert werden.",
      );
    } finally {
      setUpdatingMatterId(null);
    }
  }

  function startEditing(matter: Matter) {
    setActionError("");
    setStatusUpdateError("");
    setEditOwnerSearchError("");
    setEditOwnerSearchQuery(matter.owner ? getPersonName(matter.owner) : "");
    setEditOwnerSearchResults(matter.owner ? [matter.owner] : []);
    setEditingMatter({
      id: matter.id,
      title: matter.title,
      description: matter.description ?? "",
      priority: matter.priority,
      ownerPersonId: matter.owner?.id ?? "",
      dueDate: toDateInputValue(matter.dueDate),
    });
  }

  function cancelEditing() {
    setEditingMatter(null);
    setEditOwnerSearchQuery("");
    setEditOwnerSearchResults([]);
    setEditOwnerSearchError("");
  }

  async function saveEditing() {
    if (!editingMatter || savingEditId || updatingMatterId || deletingMatterId) {
      return;
    }

    const trimmedTitle = editingMatter.title.trim();

    if (!trimmedTitle) {
      setActionError("Titel ist erforderlich.");
      return;
    }

    setSavingEditId(editingMatter.id);
    setActionError("");

    try {
      const response = await fetch("/api/vereinsleitung/matters", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingMatter.id,
          title: trimmedTitle,
          description: editingMatter.description.trim(),
          priority: editingMatter.priority,
          ownerPersonId: editingMatter.ownerPersonId,
          dueDate: editingMatter.dueDate,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "Thema konnte nicht aktualisiert werden.",
        );
      }

      const updatedMatter = (await response.json()) as Matter;

      setMatters((currentMatters) =>
        currentMatters.map((matter) =>
          matter.id === updatedMatter.id ? updatedMatter : matter,
        ),
      );
      cancelEditing();
    } catch (caughtError) {
      setActionError(
        caughtError instanceof Error
          ? caughtError.message
          : "Thema konnte nicht aktualisiert werden.",
      );
    } finally {
      setSavingEditId(null);
    }
  }

  async function handleDelete(matter: Matter) {
    if (deletingMatterId || savingEditId || updatingMatterId) {
      return;
    }

    const confirmed = window.confirm(
      'Moechtest du das Thema "' + matter.title + '" wirklich loeschen?',
    );

    if (!confirmed) {
      return;
    }

    setDeletingMatterId(matter.id);
    setActionError("");
    setStatusUpdateError("");

    try {
      const response = await fetch(
        "/api/vereinsleitung/matters?id=" + encodeURIComponent(matter.id),
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "Thema konnte nicht geloescht werden.",
        );
      }

      setMatters((currentMatters) =>
        currentMatters.filter((currentMatter) => currentMatter.id !== matter.id),
      );

      if (editingMatter?.id === matter.id) {
        cancelEditing();
      }
    } catch (caughtError) {
      setActionError(
        caughtError instanceof Error
          ? caughtError.message
          : "Thema konnte nicht geloescht werden.",
      );
    } finally {
      setDeletingMatterId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Neues Thema erfassen</h4>
            <p className="mt-1 text-xs text-slate-500">
              Aktuell offene Themen: {openCount}
            </p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Titel des offenen Themas"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-[#0b4aa2]"
            />
          </div>

          <div>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Beschreibung"
              rows={3}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-[#0b4aa2]"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Prioritaet
              </label>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as MatterPriority)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-[#0b4aa2]"
              >
                <option value="LOW">Niedrig</option>
                <option value="MEDIUM">Mittel</option>
                <option value="HIGH">Hoch</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Faellig bis
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-[#0b4aa2]"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                type="text"
                value={ownerSearchQuery}
                onChange={(event) => setOwnerSearchQuery(event.target.value)}
                placeholder="Verantwortliche Person suchen"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-[#0b4aa2]"
              />
              <button
                type="button"
                onClick={() =>
                  void searchOwners(
                    ownerSearchQuery,
                    setOwnerSearchLoading,
                    setOwnerSearchError,
                    setOwnerSearchResults,
                  )
                }
                disabled={ownerSearchLoading}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ownerSearchLoading ? "Suche..." : "Person suchen"}
              </button>
            </div>

            {ownerSearchError ? (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {ownerSearchError}
              </div>
            ) : null}

            {ownerSearchResults.length > 0 ? (
              <div className="mt-3 space-y-3">
                <select
                  value={selectedOwnerId}
                  onChange={(event) => setSelectedOwnerId(event.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-[#0b4aa2]"
                >
                  <option value="">Keine verantwortliche Person</option>
                  {ownerSearchResults.map((person) => (
                    <option key={person.id} value={person.id}>
                      {getPersonName(person)}
                    </option>
                  ))}
                </select>

                {selectedOwner ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    Verantwortlich: {getPersonName(selectedOwner)}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#08357a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Speichert..." : "Thema erstellen"}
            </button>
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </form>
      </div>

      {statusUpdateError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {statusUpdateError}
        </div>
      ) : null}

      {actionError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {actionError}
        </div>
      ) : null}

      {loadError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {loadError}
        </div>
      ) : null}

      <div className="space-y-3">
        {isLoading ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            Themen werden geladen...
          </div>
        ) : matters.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            Noch keine offenen Themen vorhanden.
          </div>
        ) : (
          matters.map((matter) => {
            const isEditing = editingMatter?.id === matter.id;
            const isSavingEdit = savingEditId === matter.id;
            const isDeleting = deletingMatterId === matter.id;
            const isStatusUpdating = updatingMatterId === matter.id;

            return (
              <div key={matter.id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      {isEditing && editingMatter ? (
                        <div className="space-y-3">
                          <input
                            value={editingMatter.title}
                            onChange={(event) =>
                              setEditingMatter((currentState) =>
                                currentState
                                  ? {
                                      ...currentState,
                                      title: event.target.value,
                                    }
                                  : currentState,
                              )
                            }
                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-[#0b4aa2]"
                          />

                          <textarea
                            value={editingMatter.description}
                            onChange={(event) =>
                              setEditingMatter((currentState) =>
                                currentState
                                  ? {
                                      ...currentState,
                                      description: event.target.value,
                                    }
                                  : currentState,
                              )
                            }
                            rows={3}
                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-[#0b4aa2]"
                          />

                          <div className="grid gap-3 md:grid-cols-2">
                            <select
                              value={editingMatter.priority}
                              onChange={(event) =>
                                setEditingMatter((currentState) =>
                                  currentState
                                    ? {
                                        ...currentState,
                                        priority: event.target.value as MatterPriority,
                                      }
                                    : currentState,
                                )
                              }
                              className="rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-[#0b4aa2]"
                            >
                              <option value="LOW">Niedrig</option>
                              <option value="MEDIUM">Mittel</option>
                              <option value="HIGH">Hoch</option>
                            </select>

                            <input
                              type="date"
                              value={editingMatter.dueDate}
                              onChange={(event) =>
                                setEditingMatter((currentState) =>
                                  currentState
                                    ? {
                                        ...currentState,
                                        dueDate: event.target.value,
                                      }
                                    : currentState,
                                )
                              }
                              className="rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-[#0b4aa2]"
                            />
                          </div>

                          <div className="rounded-xl border border-slate-200 p-3">
                            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                              <input
                                type="text"
                                value={editOwnerSearchQuery}
                                onChange={(event) => setEditOwnerSearchQuery(event.target.value)}
                                placeholder="Verantwortliche Person suchen"
                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-[#0b4aa2]"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  void searchOwners(
                                    editOwnerSearchQuery,
                                    setEditOwnerSearchLoading,
                                    setEditOwnerSearchError,
                                    setEditOwnerSearchResults,
                                  )
                                }
                                disabled={editOwnerSearchLoading}
                                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {editOwnerSearchLoading ? "Suche..." : "Person suchen"}
                              </button>
                            </div>

                            {editOwnerSearchError ? (
                              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                                {editOwnerSearchError}
                              </div>
                            ) : null}

                            {editOwnerSearchResults.length > 0 ? (
                              <div className="mt-3 space-y-3">
                                <select
                                  value={editingMatter.ownerPersonId}
                                  onChange={(event) =>
                                    setEditingMatter((currentState) =>
                                      currentState
                                        ? {
                                            ...currentState,
                                            ownerPersonId: event.target.value,
                                          }
                                        : currentState,
                                    )
                                  }
                                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-[#0b4aa2]"
                                >
                                  <option value="">Keine verantwortliche Person</option>
                                  {editOwnerSearchResults.map((person) => (
                                    <option key={person.id} value={person.id}>
                                      {getPersonName(person)}
                                    </option>
                                  ))}
                                </select>

                                {selectedEditOwner ? (
                                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                    Verantwortlich: {getPersonName(selectedEditOwner)}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-sm font-semibold text-slate-900">{matter.title}</div>
                          {matter.description ? (
                            <div className="mt-2 text-sm text-slate-600">{matter.description}</div>
                          ) : null}

                          <div className="mt-3 flex flex-wrap gap-2">
                            {matter.owner ? (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                Verantwortlich: {getPersonName(matter.owner)}
                              </span>
                            ) : null}

                            {matter.dueDate ? (
                              <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                                Faellig: {formatDueDate(matter.dueDate)}
                              </span>
                            ) : null}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getPriorityClass(isEditing && editingMatter ? editingMatter.priority : matter.priority)}`}>
                        {getPriorityLabel(isEditing && editingMatter ? editingMatter.priority : matter.priority)}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClass(matter.status)}`}>
                        {getStatusLabel(matter.status)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center">
                      <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Status
                      </label>

                      <select
                        value={matter.status}
                        disabled={isStatusUpdating || isSavingEdit || isDeleting}
                        onChange={(event) =>
                          void handleStatusChange(
                            matter.id,
                            event.target.value as MatterStatus,
                          )
                        }
                        className="rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-[#0b4aa2] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="OPEN">Offen</option>
                        <option value="IN_PROGRESS">In Bearbeitung</option>
                        <option value="DONE">Erledigt</option>
                      </select>

                      {isStatusUpdating ? (
                        <span className="text-xs text-slate-500">Speichert Status...</span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void saveEditing()}
                            disabled={isSavingEdit || isDeleting || isStatusUpdating}
                            className="rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#08357a] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isSavingEdit ? "Speichert..." : "Speichern"}
                          </button>

                          <button
                            type="button"
                            onClick={cancelEditing}
                            disabled={isSavingEdit || isDeleting || isStatusUpdating}
                            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Abbrechen
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditing(matter)}
                          disabled={isDeleting || isStatusUpdating || isSavingEdit}
                          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Bearbeiten
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => void handleDelete(matter)}
                        disabled={isDeleting || isSavingEdit || isStatusUpdating}
                        className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isDeleting ? "Loescht..." : "Loeschen"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
