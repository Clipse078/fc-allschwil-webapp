"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  Edit3,
  FileCheck2,
  Info,
  ListTodo,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  getDecisionTypeLabel,
  getDecisionTypeOptions,
  type MeetingAgendaItem,
  type MeetingDecisionItem,
  type MeetingDecisionResponsibleOption,
  type MeetingProtocolEntryItem,
} from "@/lib/vereinsleitung/meeting-utils";

type SearchResultPerson = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
};

type ProtocolComposerState = {
  notes: string;
  isSubmitting: boolean;
  error: string | null;
};

type ProtocolEditState = {
  entryId: string | null;
  notes: string;
  isSubmitting: boolean;
  error: string | null;
};

type DecisionComposerState = {
  decisionText: string;
  decisionType: string;
  responsibleSearch: string;
  responsiblePersonId: string;
  responsibleDisplayName: string;
  responsibleOptions: MeetingDecisionResponsibleOption[];
  isSearching: boolean;
  dueDate: string;
  remarks: string;
  createMatter: boolean;
  isSubmitting: boolean;
  error: string | null;
};

type DecisionEditState = {
  decisionId: string | null;
  decisionText: string;
  decisionType: string;
  responsibleSearch: string;
  responsiblePersonId: string;
  responsibleDisplayName: string;
  responsibleOptions: MeetingDecisionResponsibleOption[];
  isSearching: boolean;
  dueDate: string;
  remarks: string;
  createMatter: boolean;
  isSubmitting: boolean;
  error: string | null;
};

type VereinsleitungMeetingExecutionWorkspaceProps = {
  meetingId: string;
  agendaItems: MeetingAgendaItem[];
  protocolEntries: MeetingProtocolEntryItem[];
  decisions: MeetingDecisionItem[];
};

function getDecisionIcon(type: string) {
  switch (type) {
    case "TASK":
      return ListTodo;
    case "APPROVAL":
      return FileCheck2;
    case "INFO":
      return Info;
    default:
      return CheckCircle2;
  }
}

function getDecisionBadgeClass(type: string) {
  switch (type) {
    case "TASK":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "APPROVAL":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "INFO":
      return "border-sky-200 bg-sky-50 text-sky-700";
    default:
      return "border-violet-200 bg-violet-50 text-violet-700";
  }
}

function getPersonDisplayName(person: SearchResultPerson) {
  return (
    person.displayName ??
    [person.firstName, person.lastName].filter(Boolean).join(" ").trim() ??
    ""
  );
}

function createInitialProtocolState(): ProtocolComposerState {
  return {
    notes: "",
    isSubmitting: false,
    error: null,
  };
}

function createInitialProtocolEditState(): ProtocolEditState {
  return {
    entryId: null,
    notes: "",
    isSubmitting: false,
    error: null,
  };
}

function createInitialDecisionState(): DecisionComposerState {
  return {
    decisionText: "",
    decisionType: "DECISION",
    responsibleSearch: "",
    responsiblePersonId: "",
    responsibleDisplayName: "",
    responsibleOptions: [],
    isSearching: false,
    dueDate: "",
    remarks: "",
    createMatter: false,
    isSubmitting: false,
    error: null,
  };
}

function createInitialDecisionEditState(): DecisionEditState {
  return {
    decisionId: null,
    decisionText: "",
    decisionType: "DECISION",
    responsibleSearch: "",
    responsiblePersonId: "",
    responsibleDisplayName: "",
    responsibleOptions: [],
    isSearching: false,
    dueDate: "",
    remarks: "",
    createMatter: false,
    isSubmitting: false,
    error: null,
  };
}

function parseSwissDateLabelToInput(value: string | null) {
  if (!value) {
    return "";
  }

  const parts = value.split(".");
  if (parts.length !== 3) {
    return "";
  }

  const day = parts[0]?.trim().padStart(2, "0");
  const monthRaw = parts[1]?.trim();
  const year = parts[2]?.trim();

  const monthMap: Record<string, string> = {
    Jan: "01",
    Feb: "02",
    MÃ¤r: "03",
    Apr: "04",
    Mai: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Okt: "10",
    Nov: "11",
    Dez: "12",
  };

  const month = monthMap[monthRaw] ?? monthRaw.padStart(2, "0");

  if (!day || !month || !year) {
    return "";
  }

  return year + "-" + month + "-" + day;
}

export default function VereinsleitungMeetingExecutionWorkspace({
  meetingId,
  agendaItems,
  protocolEntries,
  decisions,
}: VereinsleitungMeetingExecutionWorkspaceProps) {
  const router = useRouter();
  const decisionTypeOptions = useMemo(() => getDecisionTypeOptions(), []);
  const [openAgendaId, setOpenAgendaId] = useState<string | null>(agendaItems[0]?.id ?? null);
  const [protocolStates, setProtocolStates] = useState<Record<string, ProtocolComposerState>>({});
  const [protocolEditStates, setProtocolEditStates] = useState<Record<string, ProtocolEditState>>({});
  const [decisionStates, setDecisionStates] = useState<Record<string, DecisionComposerState>>({});
  const [decisionEditStates, setDecisionEditStates] = useState<Record<string, DecisionEditState>>({});

  const protocolByAgenda = useMemo(() => {
    const map = new Map<string, MeetingProtocolEntryItem[]>();

    for (const entry of protocolEntries) {
      const key = entry.agendaItemId ?? "__unassigned__";
      const bucket = map.get(key) ?? [];
      bucket.push(entry);
      map.set(key, bucket);
    }

    return map;
  }, [protocolEntries]);

  const decisionsByAgenda = useMemo(() => {
    const map = new Map<string, MeetingDecisionItem[]>();

    for (const decision of decisions) {
      const key = decision.agendaItemId ?? "__unassigned__";
      const bucket = map.get(key) ?? [];
      bucket.push(decision);
      map.set(key, bucket);
    }

    return map;
  }, [decisions]);

  function getProtocolState(agendaId: string) {
    return protocolStates[agendaId] ?? createInitialProtocolState();
  }

  function getProtocolEditState(agendaId: string) {
    return protocolEditStates[agendaId] ?? createInitialProtocolEditState();
  }

  function getDecisionState(agendaId: string) {
    return decisionStates[agendaId] ?? createInitialDecisionState();
  }

  function getDecisionEditState(agendaId: string) {
    return decisionEditStates[agendaId] ?? createInitialDecisionEditState();
  }

  function updateProtocolState(agendaId: string, patch: Partial<ProtocolComposerState>) {
    setProtocolStates((current) => ({
      ...current,
      [agendaId]: {
        ...getProtocolState(agendaId),
        ...patch,
      },
    }));
  }

  function updateProtocolEditState(agendaId: string, patch: Partial<ProtocolEditState>) {
    setProtocolEditStates((current) => ({
      ...current,
      [agendaId]: {
        ...getProtocolEditState(agendaId),
        ...patch,
      },
    }));
  }

  function updateDecisionState(agendaId: string, patch: Partial<DecisionComposerState>) {
    setDecisionStates((current) => ({
      ...current,
      [agendaId]: {
        ...getDecisionState(agendaId),
        ...patch,
      },
    }));
  }

  function updateDecisionEditState(agendaId: string, patch: Partial<DecisionEditState>) {
    setDecisionEditStates((current) => ({
      ...current,
      [agendaId]: {
        ...getDecisionEditState(agendaId),
        ...patch,
      },
    }));
  }

  async function handleResponsibleSearch(
    agendaId: string,
    value: string,
    mode: "create" | "edit",
  ) {
    if (mode === "create") {
      updateDecisionState(agendaId, {
        responsibleSearch: value,
        responsibleDisplayName: value,
        responsiblePersonId: "",
      });
    } else {
      updateDecisionEditState(agendaId, {
        responsibleSearch: value,
        responsibleDisplayName: value,
        responsiblePersonId: "",
      });
    }

    if (value.trim().length < 2) {
      if (mode === "create") {
        updateDecisionState(agendaId, {
          responsibleOptions: [],
          isSearching: false,
        });
      } else {
        updateDecisionEditState(agendaId, {
          responsibleOptions: [],
          isSearching: false,
        });
      }
      return;
    }

    try {
      if (mode === "create") {
        updateDecisionState(agendaId, { isSearching: true });
      } else {
        updateDecisionEditState(agendaId, { isSearching: true });
      }

      const response = await fetch(
        "/api/people/search?mode=vereinsleitung&q=" + encodeURIComponent(value.trim()),
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Verantwortliche Person konnte nicht geladen werden.");
      }

      const mapped = (Array.isArray(payload) ? payload : []).map((person: SearchResultPerson) => ({
        id: person.id,
        displayName: getPersonDisplayName(person),
        email: person.email,
        roleLabel: null,
      }));

      if (mode === "create") {
        updateDecisionState(agendaId, {
          responsibleOptions: mapped,
          isSearching: false,
        });
      } else {
        updateDecisionEditState(agendaId, {
          responsibleOptions: mapped,
          isSearching: false,
        });
      }
    } catch (error) {
      console.error(error);
      if (mode === "create") {
        updateDecisionState(agendaId, {
          responsibleOptions: [],
          isSearching: false,
        });
      } else {
        updateDecisionEditState(agendaId, {
          responsibleOptions: [],
          isSearching: false,
        });
      }
    }
  }

  async function submitProtocol(agenda: MeetingAgendaItem) {
    const state = getProtocolState(agenda.id);

    if (!state.notes.trim()) {
      updateProtocolState(agenda.id, { error: "Bitte erfasse einen Protokolleintrag." });
      return;
    }

    try {
      updateProtocolState(agenda.id, {
        isSubmitting: true,
        error: null,
      });

      const response = await fetch(
        "/api/vereinsleitung/meetings/" + meetingId + "/protocol",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agendaItemId: agenda.id,
            agendaItemTitle: agenda.title,
            notes: state.notes.trim(),
          }),
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Protokolleintrag konnte nicht gespeichert werden.");
      }

      updateProtocolState(agenda.id, createInitialProtocolState());
      router.refresh();
    } catch (error) {
      updateProtocolState(agenda.id, {
        isSubmitting: false,
        error:
          error instanceof Error
            ? error.message
            : "Technischer Fehler beim Speichern des Protokolls.",
      });
    }
  }

  function startProtocolEdit(agendaId: string, entry: MeetingProtocolEntryItem) {
    updateProtocolEditState(agendaId, {
      entryId: entry.id,
      notes: entry.notes,
      isSubmitting: false,
      error: null,
    });
  }

  async function saveProtocolEdit(agenda: MeetingAgendaItem) {
    const state = getProtocolEditState(agenda.id);

    if (!state.entryId) {
      return;
    }

    if (!state.notes.trim()) {
      updateProtocolEditState(agenda.id, {
        error: "Bitte erfasse einen Protokolleintrag.",
      });
      return;
    }

    try {
      updateProtocolEditState(agenda.id, {
        isSubmitting: true,
        error: null,
      });

      const response = await fetch(
        "/api/vereinsleitung/meetings/" + meetingId + "/protocol",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            entryId: state.entryId,
            agendaItemId: agenda.id,
            agendaItemTitle: agenda.title,
            notes: state.notes.trim(),
          }),
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Protokolleintrag konnte nicht aktualisiert werden.");
      }

      updateProtocolEditState(agenda.id, createInitialProtocolEditState());
      router.refresh();
    } catch (error) {
      updateProtocolEditState(agenda.id, {
        isSubmitting: false,
        error:
          error instanceof Error
            ? error.message
            : "Technischer Fehler beim Aktualisieren des Protokolls.",
      });
    }
  }

  async function deleteProtocolEntry(entryId: string) {
    const response = await fetch(
      "/api/vereinsleitung/meetings/" + meetingId + "/protocol?entryId=" + encodeURIComponent(entryId),
      {
        method: "DELETE",
      },
    );

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error || "Protokolleintrag konnte nicht gelÃ¶scht werden.");
    }

    router.refresh();
  }

  async function submitDecision(agenda: MeetingAgendaItem) {
    const state = getDecisionState(agenda.id);

    if (!state.decisionText.trim()) {
      updateDecisionState(agenda.id, {
        error: "Bitte erfasse einen Beschluss- oder Auftragstext.",
      });
      return;
    }

    try {
      updateDecisionState(agenda.id, {
        isSubmitting: true,
        error: null,
      });

      const response = await fetch(
        "/api/vereinsleitung/meetings/" + meetingId + "/decisions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            decisionText: state.decisionText.trim(),
            decisionType: state.decisionType,
            agendaItemId: agenda.id,
            agendaItemTitle: agenda.title,
            responsiblePersonId: state.responsiblePersonId || null,
            responsibleDisplayName: state.responsibleDisplayName.trim() || null,
            dueDate: state.dueDate || null,
            createMatter: state.createMatter,
            remarks: state.remarks.trim() || null,
          }),
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Entscheidung konnte nicht gespeichert werden.");
      }

      updateDecisionState(agenda.id, createInitialDecisionState());
      router.refresh();
    } catch (error) {
      updateDecisionState(agenda.id, {
        isSubmitting: false,
        error:
          error instanceof Error
            ? error.message
            : "Technischer Fehler beim Speichern der Entscheidung.",
      });
    }
  }

  function startDecisionEdit(agendaId: string, decision: MeetingDecisionItem) {
    updateDecisionEditState(agendaId, {
      decisionId: decision.id,
      decisionText: decision.decisionText,
      decisionType: decision.decisionType,
      responsibleSearch: decision.responsibleDisplayName ?? "",
      responsiblePersonId: decision.responsiblePersonId ?? "",
      responsibleDisplayName: decision.responsibleDisplayName ?? "",
      responsibleOptions: [],
      isSearching: false,
      dueDate: parseSwissDateLabelToInput(decision.dueDateLabel),
      remarks: decision.remarks ?? "",
      createMatter: decision.createMatter,
      isSubmitting: false,
      error: null,
    });
  }

  async function saveDecisionEdit(agenda: MeetingAgendaItem) {
    const state = getDecisionEditState(agenda.id);

    if (!state.decisionId) {
      return;
    }

    if (!state.decisionText.trim()) {
      updateDecisionEditState(agenda.id, {
        error: "Bitte erfasse einen Beschluss- oder Auftragstext.",
      });
      return;
    }

    try {
      updateDecisionEditState(agenda.id, {
        isSubmitting: true,
        error: null,
      });

      const response = await fetch(
        "/api/vereinsleitung/meetings/" + meetingId + "/decisions",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            decisionId: state.decisionId,
            decisionText: state.decisionText.trim(),
            decisionType: state.decisionType,
            agendaItemId: agenda.id,
            agendaItemTitle: agenda.title,
            responsiblePersonId: state.responsiblePersonId || null,
            responsibleDisplayName: state.responsibleDisplayName.trim() || null,
            dueDate: state.dueDate || null,
            createMatter: state.createMatter,
            remarks: state.remarks.trim() || null,
          }),
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Entscheidung konnte nicht aktualisiert werden.");
      }

      updateDecisionEditState(agenda.id, createInitialDecisionEditState());
      router.refresh();
    } catch (error) {
      updateDecisionEditState(agenda.id, {
        isSubmitting: false,
        error:
          error instanceof Error
            ? error.message
            : "Technischer Fehler beim Aktualisieren der Entscheidung.",
      });
    }
  }

  async function deleteDecision(decisionId: string) {
    const response = await fetch(
      "/api/vereinsleitung/meetings/" + meetingId + "/decisions?decisionId=" + encodeURIComponent(decisionId),
      {
        method: "DELETE",
      },
    );

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error || "Entscheidung konnte nicht gelÃ¶scht werden.");
    }

    router.refresh();
  }

  return (
    <section className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
          Meeting-AusfÃ¼hrung
        </p>
        <h2 className="text-xl font-semibold text-slate-900">
          Traktandenbasierter Arbeitsbereich
        </h2>
        <p className="text-sm text-slate-600">
          Jedes Traktandum bÃ¼ndelt jetzt direkt seine ProtokolleintrÃ¤ge und Entscheide.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {agendaItems.map((agenda) => {
          const isOpen = openAgendaId === agenda.id;
          const agendaProtocolEntries = protocolByAgenda.get(agenda.id) ?? [];
          const agendaDecisions = decisionsByAgenda.get(agenda.id) ?? [];
          const protocolState = getProtocolState(agenda.id);
          const protocolEditState = getProtocolEditState(agenda.id);
          const decisionState = getDecisionState(agenda.id);
          const decisionEditState = getDecisionEditState(agenda.id);

          return (
            <article
              key={agenda.id}
              className="overflow-hidden rounded-[26px] border border-slate-200 bg-slate-50/70"
            >
              <button
                type="button"
                onClick={() => setOpenAgendaId((current) => (current === agenda.id ? null : agenda.id))}
                className="flex w-full items-start justify-between gap-4 px-5 py-5 text-left transition hover:bg-white/70"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                      Traktandum
                    </span>
                    <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                      {agendaProtocolEntries.length} ProtokolleintrÃ¤ge
                    </span>
                    <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                      {agendaDecisions.length} Entscheide
                    </span>
                  </div>

                  <h3 className="mt-3 text-base font-semibold text-slate-900">
                    {agenda.title}
                  </h3>

                  {agenda.description ? (
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {agenda.description}
                    </p>
                  ) : null}
                </div>

                <ChevronDown
                  className={[
                    "mt-1 h-5 w-5 shrink-0 text-slate-400 transition",
                    isOpen ? "rotate-180" : "",
                  ].join(" ")}
                />
              </button>

              {isOpen ? (
                <div className="grid gap-5 border-t border-slate-200 bg-white px-5 py-5 xl:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Protokoll
                      </h4>
                    </div>

                    <div className="space-y-3">
                      {agendaProtocolEntries.length > 0 ? (
                        agendaProtocolEntries.map((entry) => {
                          const isEditing = protocolEditState.entryId === entry.id;

                          return (
                            <div
                              key={entry.id}
                              className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                            >
                              {isEditing ? (
                                <div className="space-y-3">
                                  <textarea
                                    value={protocolEditState.notes}
                                    onChange={(event) =>
                                      updateProtocolEditState(agenda.id, {
                                        notes: event.target.value,
                                        error: null,
                                      })
                                    }
                                    rows={4}
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                                  />

                                  {protocolEditState.error ? (
                                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                      {protocolEditState.error}
                                    </div>
                                  ) : null}

                                  <div className="flex flex-wrap justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateProtocolEditState(agenda.id, createInitialProtocolEditState())
                                      }
                                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                    >
                                      <X className="h-4 w-4" />
                                      Abbrechen
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => saveProtocolEdit(agenda)}
                                      disabled={protocolEditState.isSubmitting}
                                      className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#083a80] disabled:cursor-not-allowed disabled:opacity-70"
                                    >
                                      {protocolEditState.isSubmitting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Edit3 className="h-4 w-4" />
                                      )}
                                      Speichern
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <p className="text-sm leading-6 text-slate-700">{entry.notes}</p>
                                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => startProtocolEdit(agenda.id, entry)}
                                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                      Bearbeiten
                                    </button>
<button
                                      type="button"
                                      onClick={async () => {
                                        const confirmed = confirm("Protokolleintrag wirklich lÃ¶schen?");
                                        if (!confirmed) {
                                          return;
                                        }
                                        try {
                                          await deleteProtocolEntry(entry.id);
                                        } catch (error) {
                                          alert(error instanceof Error ? error.message : "LÃ¶schen fehlgeschlagen.");
                                        }
                                      }}
                                      className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      LÃ¶schen
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                          Noch keine ProtokolleintrÃ¤ge zu diesem Traktandum.
                        </div>
                      )}
                    </div>

                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                      <label className="mb-2 block text-sm font-medium text-slate-800">
                        Neuer Protokolleintrag
                      </label>
                      <textarea
                        value={protocolState.notes}
                        onChange={(event) =>
                          updateProtocolState(agenda.id, {
                            notes: event.target.value,
                            error: null,
                          })
                        }
                        rows={4}
                        placeholder="Was wurde bei diesem Traktandum besprochen?"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                      />

                      {protocolState.error ? (
                        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                          {protocolState.error}
                        </div>
                      ) : null}

                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => submitProtocol(agenda)}
                          disabled={protocolState.isSubmitting}
                          className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#083a80] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {protocolState.isSubmitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                          Protokoll erfassen
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Entscheide
                      </h4>
                    </div>

                    <div className="space-y-3">
                      {agendaDecisions.length > 0 ? (
                        agendaDecisions.map((decision) => {
                          const Icon = getDecisionIcon(decision.decisionType);
                          const isEditing = decisionEditState.decisionId === decision.id;

                          return (
                            <div
                              key={decision.id}
                              className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                            >
                              {isEditing ? (
                                <div className="space-y-4">
                                  <textarea
                                    value={decisionEditState.decisionText}
                                    onChange={(event) =>
                                      updateDecisionEditState(agenda.id, {
                                        decisionText: event.target.value,
                                        error: null,
                                      })
                                    }
                                    rows={4}
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                                  />

                                  <div className="grid gap-4 md:grid-cols-2">
                                    <select
                                      value={decisionEditState.decisionType}
                                      onChange={(event) =>
                                        updateDecisionEditState(agenda.id, {
                                          decisionType: event.target.value,
                                        })
                                      }
                                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                                    >
                                      {decisionTypeOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>

                                    <input
                                      type="date"
                                      value={decisionEditState.dueDate}
                                      onChange={(event) =>
                                        updateDecisionEditState(agenda.id, {
                                          dueDate: event.target.value,
                                        })
                                      }
                                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                                    />
                                  </div>

                                  <div className="grid gap-4 md:grid-cols-2">
                                    <div className="relative">
                                      <div className="relative">
                                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <input
                                          value={decisionEditState.responsibleSearch}
                                          onChange={(event) =>
                                            handleResponsibleSearch(agenda.id, event.target.value, "edit")
                                          }
                                          placeholder="Person suchen oder frei eintragen"
                                          className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                                        />
                                        {decisionEditState.isSearching ? (
                                          <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                                        ) : null}
                                      </div>

                                      {decisionEditState.responsibleOptions.length > 0 ? (
                                        <div className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                                          {decisionEditState.responsibleOptions.map((person) => (
                                            <button
                                              key={person.id}
                                              type="button"
                                              onClick={() =>
                                                updateDecisionEditState(agenda.id, {
                                                  responsiblePersonId: person.id,
                                                  responsibleDisplayName: person.displayName,
                                                  responsibleSearch: person.displayName,
                                                  responsibleOptions: [],
                                                })
                                              }
                                              className="block w-full rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
                                            >
                                              <div className="text-sm font-medium text-slate-900">
                                                {person.displayName}
                                              </div>
                                              <div className="text-xs text-slate-500">
                                                {person.email ?? "Vereinsleitung / Meetingzugang"}
                                              </div>
                                            </button>
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>

                                    <input
                                      value={decisionEditState.remarks}
                                      onChange={(event) =>
                                        updateDecisionEditState(agenda.id, {
                                          remarks: event.target.value,
                                        })
                                      }
                                      placeholder="Optionaler Kontext"
                                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                                    />
                                  </div>

                                  <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                    <input
                                      type="checkbox"
                                      checked={decisionEditState.createMatter}
                                      onChange={(event) =>
                                        updateDecisionEditState(agenda.id, {
                                          createMatter: event.target.checked,
                                        })
                                      }
                                      className="mt-1 h-4 w-4 rounded border-slate-300 text-[#0b4aa2] focus:ring-[#0b4aa2]"
                                    />
                                    <span className="text-sm text-slate-700">
                                      FÃ¼r spÃ¤tere Pendenz-Autogenerierung vormerken
                                    </span>
                                  </label>

                                  {decisionEditState.error ? (
                                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                      {decisionEditState.error}
                                    </div>
                                  ) : null}

                                  <div className="flex flex-wrap justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateDecisionEditState(agenda.id, createInitialDecisionEditState())
                                      }
                                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                    >
                                      <X className="h-4 w-4" />
                                      Abbrechen
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => saveDecisionEdit(agenda)}
                                      disabled={decisionEditState.isSubmitting}
                                      className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#083a80] disabled:cursor-not-allowed disabled:opacity-70"
                                    >
                                      {decisionEditState.isSubmitting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Edit3 className="h-4 w-4" />
                                      )}
                                      Speichern
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                      <div className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-700">
                                        <Icon className="h-4 w-4" />
                                      </div>

                                      <div className="space-y-2">
                                        <span
                                          className={[
                                            "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                                            getDecisionBadgeClass(decision.decisionType),
                                          ].join(" ")}
                                        >
                                          {getDecisionTypeLabel(decision.decisionType)}
                                        </span>

                                        <p className="text-sm font-medium leading-6 text-slate-900">
                                          {decision.decisionText}
                                        </p>
                                      </div>
                                    </div>

                                    {decision.dueDateLabel ? (
                                      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                                        <Clock3 className="h-3.5 w-3.5" />
                                        FÃ¤llig bis {decision.dueDateLabel}
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                                    <div className="rounded-2xl border border-white bg-white p-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                        Verantwortlich
                                      </p>
                                      <p className="mt-1 text-sm font-medium text-slate-800">
                                        {decision.responsibleDisplayName ?? "Noch offen"}
                                      </p>
                                    </div>

                                    <div className="rounded-2xl border border-white bg-white p-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                        Bemerkung
                                      </p>
                                      <p className="mt-1 text-sm text-slate-700">
                                        {decision.remarks ?? "â€”"}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => startDecisionEdit(agenda.id, decision)}
                                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                      Bearbeiten
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const confirmed = confirm("Entscheidung wirklich lÃ¶schen?");
                                        if (!confirmed) {
                                          return;
                                        }
                                        try {
                                          await deleteDecision(decision.id);
                                        } catch (error) {
                                          alert(error instanceof Error ? error.message : "LÃ¶schen fehlgeschlagen.");
                                        }
                                      }}
                                      className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      LÃ¶schen
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                          Noch keine Entscheide zu diesem Traktandum.
                        </div>
                      )}
                    </div>

                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                          <label className="mb-2 block text-sm font-medium text-slate-800">
                            Neuer Entscheid / Auftrag
                          </label>
                          <textarea
                            value={decisionState.decisionText}
                            onChange={(event) =>
                              updateDecisionState(agenda.id, {
                                decisionText: event.target.value,
                                error: null,
                              })
                            }
                            rows={4}
                            placeholder="Was wurde bei diesem Traktandum beschlossen?"
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-800">
                            Typ
                          </label>
                          <select
                            value={decisionState.decisionType}
                            onChange={(event) =>
                              updateDecisionState(agenda.id, {
                                decisionType: event.target.value,
                              })
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                          >
                            {decisionTypeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-800">
                            FÃ¤llig bis
                          </label>
                          <input
                            type="date"
                            value={decisionState.dueDate}
                            onChange={(event) =>
                              updateDecisionState(agenda.id, {
                                dueDate: event.target.value,
                              })
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                          />
                        </div>

                        <div className="relative">
                          <label className="mb-2 block text-sm font-medium text-slate-800">
                            Verantwortlich
                          </label>
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                              value={decisionState.responsibleSearch}
                              onChange={(event) =>
                                handleResponsibleSearch(agenda.id, event.target.value, "create")
                              }
                              placeholder="Person suchen oder frei eintragen"
                              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                            />
                            {decisionState.isSearching ? (
                              <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                            ) : null}
                          </div>

                          {decisionState.responsibleOptions.length > 0 ? (
                            <div className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                              {decisionState.responsibleOptions.map((person) => (
                                <button
                                  key={person.id}
                                  type="button"
                                  onClick={() =>
                                    updateDecisionState(agenda.id, {
                                      responsiblePersonId: person.id,
                                      responsibleDisplayName: person.displayName,
                                      responsibleSearch: person.displayName,
                                      responsibleOptions: [],
                                    })
                                  }
                                  className="block w-full rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
                                >
                                  <div className="text-sm font-medium text-slate-900">
                                    {person.displayName}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {person.email ?? "Vereinsleitung / Meetingzugang"}
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-800">
                            Bemerkung
                          </label>
                          <input
                            value={decisionState.remarks}
                            onChange={(event) =>
                              updateDecisionState(agenda.id, {
                                remarks: event.target.value,
                              })
                            }
                            placeholder="Optionaler Kontext"
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                          />
                        </div>
                      </div>

                      <label className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <input
                          type="checkbox"
                          checked={decisionState.createMatter}
                          onChange={(event) =>
                            updateDecisionState(agenda.id, {
                              createMatter: event.target.checked,
                            })
                          }
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-[#0b4aa2] focus:ring-[#0b4aa2]"
                        />
                        <span className="text-sm text-slate-700">
                          FÃ¼r spÃ¤tere Pendenz-Autogenerierung vormerken
                        </span>
                      </label>

                      {decisionState.error ? (
                        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                          {decisionState.error}
                        </div>
                      ) : null}

                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => submitDecision(agenda)}
                          disabled={decisionState.isSubmitting}
                          className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#083a80] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {decisionState.isSubmitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                          Entscheid erfassen
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

