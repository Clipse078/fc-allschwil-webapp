"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type MeetingStatus = "PLANNED" | "IN_PROGRESS" | "DONE";
type ParticipantStatus = "INVITED" | "CONFIRMED" | "EXCUSED" | "ABSENT";

type MatterOption = {
  id: string;
  title: string;
  status: string;
  statusLabel: string;
  priority: string;
  priorityLabel: string;
  dueDateLabel: string | null;
  ownerName: string | null;
};

type PersonSearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
};

type ParticipantRow = {
  key: string;
  personId: string;
  displayName: string;
  roleLabel: string;
  status: ParticipantStatus;
  remarks: string;
  searchQuery: string;
  searchResults: PersonSearchResult[];
  searchLoading: boolean;
  searchError: string;
};

type InitialParticipant = {
  personId?: string | null;
  displayName: string;
  roleLabel?: string | null;
  status?: string | null;
  remarks?: string | null;
};

type FormState = {
  title: string;
  subtitle: string;
  description: string;
  location: string;
  onlineMeetingUrl: string;
  startAt: string;
  endAt: string;
  status: MeetingStatus;
};

type VereinsleitungMeetingCreateFormProps = {
  matterOptions: MatterOption[];
  mode?: "create" | "edit";
  submitLabel?: string;
  submittingLabel?: string;
  cancelHref?: string;
  initialValues?: Partial<FormState>;
  initialSelectedMatterIds?: string[];
  initialParticipants?: InitialParticipant[];
  meetingId?: string;
};

const INITIAL_STATE: FormState = {
  title: "",
  subtitle: "",
  description: "",
  location: "",
  onlineMeetingUrl: "",
  startAt: "",
  endAt: "",
  status: "PLANNED",
};

const PARTICIPANT_STATUS_OPTIONS: { value: ParticipantStatus; label: string }[] = [
  { value: "INVITED", label: "Eingeladen" },
  { value: "CONFIRMED", label: "Anwesend" },
  { value: "EXCUSED", label: "Entschuldigt" },
  { value: "ABSENT", label: "Abwesend" },
];

function getStatusClass(status: string) {
  switch (status) {
    case "DONE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "IN_PROGRESS":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getPriorityClass(priority: string) {
  switch (priority) {
    case "HIGH":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "MEDIUM":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getPersonName(person: {
  firstName: string;
  lastName: string;
  displayName: string | null;
}) {
  return person.displayName || [person.firstName, person.lastName].filter(Boolean).join(" ");
}

function normalizeParticipantStatus(value?: string | null): ParticipantStatus {
  switch (value) {
    case "CONFIRMED":
    case "EXCUSED":
    case "ABSENT":
      return value;
    default:
      return "INVITED";
  }
}

function createParticipantRow(initial?: InitialParticipant): ParticipantRow {
  const personName = initial?.displayName?.trim() ?? "";

  return {
    key: Math.random().toString(36).slice(2, 11),
    personId: initial?.personId ?? "",
    displayName: personName,
    roleLabel: initial?.roleLabel ?? "",
    status: normalizeParticipantStatus(initial?.status),
    remarks: initial?.remarks ?? "",
    searchQuery: personName,
    searchResults: [],
    searchLoading: false,
    searchError: "",
  };
}

export default function VereinsleitungMeetingCreateForm({
  matterOptions,
  mode = "create",
  submitLabel = "Meeting erstellen",
  submittingLabel = "Meeting wird erstellt...",
  cancelHref = "/vereinsleitung/meetings",
  initialValues,
  initialSelectedMatterIds,
  initialParticipants,
  meetingId,
}: VereinsleitungMeetingCreateFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    ...INITIAL_STATE,
    ...initialValues,
  });
  const [selectedMatterIds, setSelectedMatterIds] = useState<string[]>(
    initialSelectedMatterIds ?? [],
  );
  const [participants, setParticipants] = useState<ParticipantRow[]>(
    initialParticipants && initialParticipants.length > 0
      ? initialParticipants.map((participant) => createParticipantRow(participant))
      : [createParticipantRow()],
  );
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    return Boolean(form.title.trim() && form.startAt.trim());
  }, [form.startAt, form.title]);

  useEffect(() => {
    const controllers: AbortController[] = [];

    participants.forEach((participant) => {
      const query = participant.searchQuery.trim();

      if (!query || query.length < 2) {
        if (
          participant.searchResults.length > 0 ||
          participant.searchLoading ||
          participant.searchError
        ) {
          setParticipants((current) =>
            current.map((entry) =>
              entry.key === participant.key
                ? {
                    ...entry,
                    searchResults: [],
                    searchLoading: false,
                    searchError: "",
                  }
                : entry,
            ),
          );
        }
        return;
      }

      const controller = new AbortController();
      controllers.push(controller);

      setParticipants((current) =>
        current.map((entry) =>
          entry.key === participant.key
            ? {
                ...entry,
                searchLoading: true,
                searchError: "",
              }
            : entry,
        ),
      );

      fetch("/api/people/search?q=" + encodeURIComponent(query) + "&mode=any", {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          const data = await response.json().catch(() => null);

          if (!response.ok) {
            throw new Error(data?.error ?? "Personensuche konnte nicht geladen werden.");
          }

          const results = Array.isArray(data) ? (data as PersonSearchResult[]) : [];

          setParticipants((current) =>
            current.map((entry) =>
              entry.key === participant.key
                ? {
                    ...entry,
                    searchResults: results,
                    searchLoading: false,
                    searchError: "",
                  }
                : entry,
            ),
          );
        })
        .catch((searchError) => {
          if (controller.signal.aborted) {
            return;
          }

          setParticipants((current) =>
            current.map((entry) =>
              entry.key === participant.key
                ? {
                    ...entry,
                    searchResults: [],
                    searchLoading: false,
                    searchError:
                      searchError instanceof Error
                        ? searchError.message
                        : "Personensuche konnte nicht geladen werden.",
                  }
                : entry,
            ),
          );
        });
    });

    return () => {
      controllers.forEach((controller) => controller.abort());
    };
  }, [participants]);

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function toggleMatter(matterId: string) {
    setSelectedMatterIds((current) =>
      current.includes(matterId)
        ? current.filter((entry) => entry !== matterId)
        : [...current, matterId],
    );
  }

  function updateParticipant(
    key: string,
    updater: (participant: ParticipantRow) => ParticipantRow,
  ) {
    setParticipants((current) =>
      current.map((participant) =>
        participant.key === key ? updater(participant) : participant,
      ),
    );
  }

  function addParticipantRow() {
    setParticipants((current) => [...current, createParticipantRow()]);
  }

  function removeParticipantRow(key: string) {
    setParticipants((current) => {
      if (current.length === 1) {
        return [createParticipantRow()];
      }

      return current.filter((participant) => participant.key !== key);
    });
  }

  function selectPerson(key: string, person: PersonSearchResult) {
    const personName = getPersonName(person);

    updateParticipant(key, (participant) => ({
      ...participant,
      personId: person.id,
      displayName: personName,
      searchQuery: personName,
      searchResults: [],
      searchError: "",
      searchLoading: false,
    }));
  }

  function clearLinkedPerson(key: string) {
    updateParticipant(key, (participant) => ({
      ...participant,
      personId: "",
      searchResults: [],
      searchError: "",
      searchLoading: false,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit || isSubmitting) {
      return;
    }

    const normalizedParticipants = participants
      .map((participant) => ({
        personId: participant.personId.trim() || null,
        displayName: participant.displayName.trim(),
        roleLabel: participant.roleLabel.trim() || null,
        status: participant.status,
        remarks: participant.remarks.trim() || null,
      }))
      .filter((participant) => participant.displayName);

    setIsSubmitting(true);
    setError("");

    try {
      const endpoint =
        mode === "edit" && meetingId
          ? "/api/vereinsleitung/meetings/" + meetingId
          : "/api/vereinsleitung/meetings";

      const method = mode === "edit" ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: form.title.trim(),
          subtitle: form.subtitle.trim() || null,
          description: form.description.trim() || null,
          location: form.location.trim() || null,
          onlineMeetingUrl: form.onlineMeetingUrl.trim() || null,
          startAt: form.startAt,
          endAt: form.endAt.trim() || null,
          status: form.status,
          matterIds: selectedMatterIds,
          participants: normalizedParticipants,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          typeof data?.error === "string"
            ? data.error
            : "Meeting konnte nicht gespeichert werden.",
        );
        return;
      }

      router.push("/vereinsleitung/meetings/" + data.slug);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? "Technischer Fehler: " + submitError.message
          : "Meeting konnte nicht gespeichert werden.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-900">
              Titel *
            </label>
            <input
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="z. B. Vereinsleitungssitzung Mai 2026"
              className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-900">
              Kurzbeschreibung
            </label>
            <input
              value={form.subtitle}
              onChange={(event) => updateField("subtitle", event.target.value)}
              placeholder="z. B. Planung, Beschlüsse und offene Themen"
              className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900">
              Start *
            </label>
            <input
              type="datetime-local"
              value={form.startAt}
              onChange={(event) => updateField("startAt", event.target.value)}
              className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900">
              Ende
            </label>
            <input
              type="datetime-local"
              value={form.endAt}
              onChange={(event) => updateField("endAt", event.target.value)}
              className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900">
              Ort
            </label>
            <input
              value={form.location}
              onChange={(event) => updateField("location", event.target.value)}
              placeholder="z. B. Clubhaus Sitzungszimmer 1"
              className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900">
              Status
            </label>
            <select
              value={form.status}
              onChange={(event) => updateField("status", event.target.value as MeetingStatus)}
              className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
            >
              <option value="PLANNED">PLANNED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="DONE">DONE</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-900">
              Online-Meeting-Link
            </label>
            <input
              value={form.onlineMeetingUrl}
              onChange={(event) => updateField("onlineMeetingUrl", event.target.value)}
              placeholder="https://teams.microsoft.com/..."
              className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-900">
              Notizen / Kontext
            </label>
            <textarea
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              rows={6}
              placeholder="Kontext, Traktanden, Vorbereitungen, Pendenzen-Hinweise ..."
              className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
            />
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-[1.08rem] font-semibold text-slate-900">
              Teilnehmer
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Erfasse freie Teilnehmer oder verknüpfe bestehende Personen aus dem People-Modul.
            </p>
          </div>

          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {participants.filter((participant) => participant.displayName.trim()).length} erfasst
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {participants.map((participant, index) => {
            const selectedPerson = participant.searchResults.find(
              (item) => item.id === participant.personId,
            );

            return (
              <div
                key={participant.key}
                className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">
                    Teilnehmer {index + 1}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeParticipantRow(participant.key)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Entfernen
                  </button>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="block text-sm font-semibold text-slate-900">
                      Person suchen
                    </span>
                    <input
                      value={participant.searchQuery}
                      onChange={(event) =>
                        updateParticipant(participant.key, (current) => ({
                          ...current,
                          searchQuery: event.target.value,
                        }))
                      }
                      placeholder="Name, E-Mail oder Telefon"
                      className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                    />

                    {participant.searchLoading ? (
                      <p className="mt-2 text-xs text-slate-500">Suche läuft...</p>
                    ) : null}

                    {participant.searchError ? (
                      <p className="mt-2 text-xs font-medium text-rose-700">
                        {participant.searchError}
                      </p>
                    ) : null}

                    {!participant.searchLoading &&
                    participant.searchQuery.trim().length >= 2 &&
                    participant.searchResults.length > 0 ? (
                      <div className="mt-3 max-h-56 overflow-auto rounded-[18px] border border-slate-200 bg-slate-50 p-2">
                        <div className="space-y-2">
                          {participant.searchResults.map((person) => {
                            const personName = getPersonName(person);
                            const isSelected = participant.personId === person.id;

                            return (
                              <button
                                key={person.id}
                                type="button"
                                onClick={() => selectPerson(participant.key, person)}
                                className={`flex w-full items-start justify-between gap-3 rounded-[16px] border px-3 py-3 text-left transition ${
                                  isSelected
                                    ? "border-[#0b4aa2]/30 bg-[#0b4aa2]/[0.05]"
                                    : "border-slate-200 bg-white hover:bg-slate-50"
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-900">
                                    {personName}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {[person.email, person.phone].filter(Boolean).join(" • ")}
                                  </div>
                                </div>
                                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                  {isSelected ? "Verknüpft" : "Auswählen"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {participant.personId ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[#0b4aa2]/20 bg-[#0b4aa2]/[0.05] px-3 py-1 text-xs font-semibold text-[#0b4aa2]">
                          Verknüpft mit bestehender Person
                        </span>
                        <button
                          type="button"
                          onClick={() => clearLinkedPerson(participant.key)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          Verknüpfung lösen
                        </button>
                      </div>
                    ) : null}
                  </label>

                  <label className="block">
                    <span className="block text-sm font-semibold text-slate-900">
                      Anzeigename *
                    </span>
                    <input
                      value={participant.displayName}
                      onChange={(event) =>
                        updateParticipant(participant.key, (current) => ({
                          ...current,
                          displayName: event.target.value,
                          ...(current.personId
                            ? {}
                            : {
                                searchQuery: event.target.value,
                              }),
                        }))
                      }
                      placeholder="z. B. Michael Duijster"
                      className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                    />
                    {selectedPerson ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Gewählt aus Suche: {getPersonName(selectedPerson)}
                      </p>
                    ) : null}
                  </label>

                  <label className="block">
                    <span className="block text-sm font-semibold text-slate-900">
                      Rolle
                    </span>
                    <input
                      value={participant.roleLabel}
                      onChange={(event) =>
                        updateParticipant(participant.key, (current) => ({
                          ...current,
                          roleLabel: event.target.value,
                        }))
                      }
                      placeholder="z. B. Präsident, Protokoll, Gast"
                      className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-sm font-semibold text-slate-900">
                      Status
                    </span>
                    <select
                      value={participant.status}
                      onChange={(event) =>
                        updateParticipant(participant.key, (current) => ({
                          ...current,
                          status: event.target.value as ParticipantStatus,
                        }))
                      }
                      className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                    >
                      {PARTICIPANT_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block md:col-span-2">
                    <span className="block text-sm font-semibold text-slate-900">
                      Bemerkungen
                    </span>
                    <input
                      value={participant.remarks}
                      onChange={(event) =>
                        updateParticipant(participant.key, (current) => ({
                          ...current,
                          remarks: event.target.value,
                        }))
                      }
                      placeholder="Optionaler Hinweis zum Teilnehmer"
                      className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={addParticipantRow}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Teilnehmer hinzufügen
          </button>
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-[1.08rem] font-semibold text-slate-900">
              Pendenzen verknüpfen
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Bestehende Pendenzen können direkt mit diesem Meeting verknüpft oder entfernt werden.
            </p>
          </div>

          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {selectedMatterIds.length} ausgewählt
          </div>
        </div>

        {matterOptions.length === 0 ? (
          <div className="mt-5 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-500">
            Aktuell sind keine Pendenzen vorhanden, die verknüpft werden können.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {matterOptions.map((matter) => {
              const isChecked = selectedMatterIds.includes(matter.id);

              return (
                <label
                  key={matter.id}
                  className={`flex cursor-pointer items-start gap-4 rounded-[22px] border px-4 py-4 shadow-sm transition ${
                    isChecked
                      ? "border-[#0b4aa2]/30 bg-[#0b4aa2]/[0.04]"
                      : "border-slate-200 bg-white hover:bg-slate-50/70"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleMatter(matter.id)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-[#0b4aa2] focus:ring-[#0b4aa2]"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">
                          {matter.title}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          {matter.ownerName ? <span>Verantwortlich: {matter.ownerName}</span> : null}
                          {matter.dueDateLabel ? <span>Fällig: {matter.dueDateLabel}</span> : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getPriorityClass(
                            matter.priority,
                          )}`}
                        >
                          {matter.priorityLabel}
                        </span>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusClass(
                            matter.status,
                          )}`}
                        >
                          {matter.statusLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {error ? (
          <div className="mt-5 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="fca-button-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? submittingLabel : submitLabel}
          </button>

          <Link href={cancelHref} className="fca-button-secondary">
            Zurück
          </Link>
        </div>
      </section>
    </form>
  );
}