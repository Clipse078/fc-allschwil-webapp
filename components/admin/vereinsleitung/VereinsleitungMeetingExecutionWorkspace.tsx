"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  Edit3,
  FileCheck2,
  Info,
  Link2,
  ListChecks,
  ListTodo,
  Loader2,
  Lock,
  Plus,
  Search,
  ShieldCheck,
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

type Props = {
  meetingId: string;
  agendaItems: MeetingAgendaItem[];
  protocolEntries: MeetingProtocolEntryItem[];
  decisions: MeetingDecisionItem[];
  isDone?: boolean;
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
  const fullName = [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
  return person.displayName ?? fullName ?? "";
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
    Mär: "03",
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

function getAgendaProgress(protocolCount: number, decisionCount: number) {
  if (protocolCount === 0 && decisionCount === 0) {
    return 0;
  }

  if (protocolCount > 0 && decisionCount > 0) {
    return 100;
  }

  return 50;
}

export default function VereinsleitungMeetingExecutionWorkspace({
  meetingId,
  agendaItems,
  protocolEntries,
  decisions,
  isDone = false,
}: Props) {
  const router = useRouter();
  const decisionTypeOptions = useMemo(() => getDecisionTypeOptions(), []);
  const [openAgendaId, setOpenAgendaId] = useState<string | null>(agendaItems[0]?.id ?? null);
  const [protocolStates, setProtocolStates] = useState<Record<string, ProtocolComposerState>>({});
  const [protocolEditStates, setProtocolEditStates] = useState<Record<string, ProtocolEditState>>({});
  const [decisionStates, setDecisionStates] = useState<Record<string, DecisionComposerState>>({});
  const [decisionEditStates, setDecisionEditStates] = useState<Record<string, DecisionEditState>>({});

  const isExecutionLocked = isDone;
  const canEditProtocol = !isExecutionLocked;
  const canEditDecisions = !isExecutionLocked;

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

  const activeAgenda = useMemo(
    () => agendaItems.find((item) => item.id === openAgendaId) ?? agendaItems[0] ?? null,
    [agendaItems, openAgendaId],
  );

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
        updateDecisionState(agendaId, { responsibleOptions: [], isSearching: false });
      } else {
        updateDecisionEditState(agendaId, { responsibleOptions: [], isSearching: false });
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
        { method: "GET", cache: "no-store" },
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
        updateDecisionState(agendaId, { responsibleOptions: [], isSearching: false });
      } else {
        updateDecisionEditState(agendaId, { responsibleOptions: [], isSearching: false });
      }
    }
  }

  async function submitProtocol(agenda: MeetingAgendaItem) {
    if (!canEditProtocol) {
      alert("Dieses Meeting ist abgeschlossen. Protokolleintraege sind gesperrt.");
      return;
    }

    const state = getProtocolState(agenda.id);

    if (!state.notes.trim()) {
      updateProtocolState(agenda.id, { error: "Bitte erfasse einen Protokolleintrag." });
      return;
    }

    try {
      updateProtocolState(agenda.id, { isSubmitting: true, error: null });

      const response = await fetch("/api/vereinsleitung/meetings/" + meetingId + "/protocol", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agendaItemId: agenda.id,
          agendaItemTitle: agenda.title,
          notes: state.notes.trim(),
        }),
      });

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
    if (!canEditProtocol) {
      alert("Dieses Meeting ist abgeschlossen. Protokolleintraege sind gesperrt.");
      return;
    }

    updateProtocolEditState(agendaId, {
      entryId: entry.id,
      notes: entry.notes,
      isSubmitting: false,
      error: null,
    });
  }

  async function saveProtocolEdit(agenda: MeetingAgendaItem) {
    if (!canEditProtocol) {
      alert("Dieses Meeting ist abgeschlossen. Protokolleintraege sind gesperrt.");
      return;
    }

    const state = getProtocolEditState(agenda.id);

    if (!state.entryId) {
      return;
    }

    if (!state.notes.trim()) {
      updateProtocolEditState(agenda.id, { error: "Bitte erfasse einen Protokolleintrag." });
      return;
    }

    try {
      updateProtocolEditState(agenda.id, { isSubmitting: true, error: null });

      const response = await fetch("/api/vereinsleitung/meetings/" + meetingId + "/protocol", {
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
      });

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
    if (!canEditProtocol) {
      throw new Error("Dieses Meeting ist abgeschlossen. Protokolleintraege sind gesperrt.");
    }

    const response = await fetch(
      "/api/vereinsleitung/meetings/" +
        meetingId +
        "/protocol?entryId=" +
        encodeURIComponent(entryId),
      {
        method: "DELETE",
      },
    );

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error || "Protokolleintrag konnte nicht geloescht werden.");
    }

    router.refresh();
  }

  async function submitDecision(agenda: MeetingAgendaItem) {
    if (!canEditDecisions) {
      alert("Dieses Meeting ist abgeschlossen. Entscheide sind gesperrt.");
      return;
    }

    const state = getDecisionState(agenda.id);

    if (!state.decisionText.trim()) {
      updateDecisionState(agenda.id, {
        error: "Bitte erfasse einen Beschluss- oder Auftragstext.",
      });
      return;
    }

    try {
      updateDecisionState(agenda.id, { isSubmitting: true, error: null });

      const response = await fetch("/api/vereinsleitung/meetings/" + meetingId + "/decisions", {
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
      });

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
    if (!canEditDecisions) {
      alert("Dieses Meeting ist abgeschlossen. Entscheide sind gesperrt.");
      return;
    }

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
    if (!canEditDecisions) {
      alert("Dieses Meeting ist abgeschlossen. Entscheide sind gesperrt.");
      return;
    }

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
      updateDecisionEditState(agenda.id, { isSubmitting: true, error: null });

      const response = await fetch("/api/vereinsleitung/meetings/" + meetingId + "/decisions", {
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
      });

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
    if (!canEditDecisions) {
      throw new Error("Dieses Meeting ist abgeschlossen. Entscheide sind gesperrt.");
    }

    const response = await fetch(
      "/api/vereinsleitung/meetings/" +
        meetingId +
        "/decisions?decisionId=" +
        encodeURIComponent(decisionId),
      {
        method: "DELETE",
      },
    );

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error || "Entscheidung konnte nicht geloescht werden.");
    }

    router.refresh();
  }

  if (!activeAgenda) {
    return (
      <section className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
          Noch keine Traktanden vorhanden.
        </div>
      </section>
    );
  }

  const activeProtocolEntries = protocolByAgenda.get(activeAgenda.id) ?? [];
  const activeDecisions = decisionsByAgenda.get(activeAgenda.id) ?? [];
  const protocolState = getProtocolState(activeAgenda.id);
  const protocolEditState = getProtocolEditState(activeAgenda.id);
  const decisionState = getDecisionState(activeAgenda.id);
  const decisionEditState = getDecisionEditState(activeAgenda.id);

  return (
    <section className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
            Meeting-Ausfuehrung
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">
            Traktandenbasierter Arbeitsbereich
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Links Auswahl, in der Mitte Protokoll und Entscheide, rechts Status und Workflow.
          </p>
        </div>

        {isExecutionLocked ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700">
            <Lock className="h-3.5 w-3.5" />
            Gesperrt
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Aktiv
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_280px]">
        <aside className="space-y-3">
          {agendaItems.map((agenda, index) => {
            const agendaProtocolEntries = protocolByAgenda.get(agenda.id) ?? [];
            const agendaDecisions = decisionsByAgenda.get(agenda.id) ?? [];
            const progress = getAgendaProgress(
              agendaProtocolEntries.length,
              agendaDecisions.length,
            );
            const isActive = agenda.id === activeAgenda.id;

            return (
              <button
                key={agenda.id}
                type="button"
                onClick={() => setOpenAgendaId(agenda.id)}
                className={[
                  "block w-full rounded-[24px] border p-4 text-left transition",
                  isActive
                    ? "border-[#0b4aa2]/30 bg-[#0b4aa2]/5"
                    : "border-slate-200 bg-slate-50 hover:bg-white",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Traktandum {index + 1}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">{progress}%</span>
                </div>

                <div className="mt-2 text-sm font-semibold text-slate-900">{agenda.title}</div>

                <div className="mt-3 h-2 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-[#0b4aa2]"
                    style={{ width: progress + "%" }}
                  />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <div>{agendaProtocolEntries.length} Protokoll</div>
                  <div>{agendaDecisions.length} Entscheide</div>
                </div>
              </button>
            );
          })}
        </aside>

        <div className="space-y-6">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Aktives Traktandum
            </p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">{activeAgenda.title}</h3>
            <p className="mt-2 text-sm text-slate-600">
              {activeAgenda.description ?? "Keine Beschreibung hinterlegt."}
            </p>
          </div>

          <div className="grid gap-6 2xl:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Protokoll
                </h4>
                {isExecutionLocked ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
                    <Lock className="h-3.5 w-3.5" />
                    Gesperrt
                  </span>
                ) : null}
              </div>

              <div className="mt-4 space-y-3">
                {activeProtocolEntries.length > 0 ? (
                  activeProtocolEntries.map((entry) => {
                    const isEditing = protocolEditState.entryId === entry.id;

                    return (
                      <div
                        key={entry.id}
                        className="rounded-[20px] border border-slate-200 bg-slate-50 p-4"
                      >
                        {isEditing ? (
                          <div className="space-y-3">
                            <textarea
                              value={protocolEditState.notes}
                              onChange={(event) =>
                                updateProtocolEditState(activeAgenda.id, {
                                  notes: event.target.value,
                                  error: null,
                                })
                              }
                              rows={4}
                              disabled={!canEditProtocol}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#0b4aa2]"
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
                                  updateProtocolEditState(
                                    activeAgenda.id,
                                    createInitialProtocolEditState(),
                                  )
                                }
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                              >
                                <X className="h-4 w-4" />
                                Abbrechen
                              </button>
                              <button
                                type="button"
                                onClick={() => saveProtocolEdit(activeAgenda)}
                                disabled={protocolEditState.isSubmitting || !canEditProtocol}
                                className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
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
                                onClick={() => startProtocolEdit(activeAgenda.id, entry)}
                                disabled={!canEditProtocol}
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                Bearbeiten
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  const confirmed = confirm("Protokolleintrag wirklich loeschen?");
                                  if (!confirmed) {
                                    return;
                                  }
                                  try {
                                    await deleteProtocolEntry(entry.id);
                                  } catch (error) {
                                    alert(
                                      error instanceof Error
                                        ? error.message
                                        : "Loeschen fehlgeschlagen.",
                                    );
                                  }
                                }}
                                disabled={!canEditProtocol}
                                className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Loeschen
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                    Noch keine Protokolleintraege zu diesem Traktandum.
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <label className="mb-2 block text-sm font-medium text-slate-800">
                  Neuer Protokolleintrag
                </label>
                <textarea
                  value={protocolState.notes}
                  onChange={(event) =>
                    updateProtocolState(activeAgenda.id, {
                      notes: event.target.value,
                      error: null,
                    })
                  }
                  rows={4}
                  disabled={!canEditProtocol}
                  placeholder={
                    canEditProtocol
                      ? "Was wurde bei diesem Traktandum besprochen?"
                      : "Meeting abgeschlossen: Protokolleintraege sind gesperrt."
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#0b4aa2]"
                />

                {protocolState.error ? (
                  <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {protocolState.error}
                  </div>
                ) : null}

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => submitProtocol(activeAgenda)}
                    disabled={protocolState.isSubmitting || !canEditProtocol}
                    className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
                  >
                    {protocolState.isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : canEditProtocol ? (
                      <Plus className="h-4 w-4" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                    {canEditProtocol ? "Protokoll erfassen" : "Gesperrt"}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Entscheide
                </h4>
                {isExecutionLocked ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
                    <Lock className="h-3.5 w-3.5" />
                    Gesperrt
                  </span>
                ) : null}
              </div>

              <div className="mt-4 space-y-3">
                {activeDecisions.length > 0 ? (
                  activeDecisions.map((decision) => {
                    const Icon = getDecisionIcon(decision.decisionType);
                    const isEditing = decisionEditState.decisionId === decision.id;

                    return (
                      <div
                        key={decision.id}
                        className="rounded-[20px] border border-slate-200 bg-slate-50 p-4"
                      >
                        {isEditing ? (
                          <div className="space-y-4">
                            <textarea
                              value={decisionEditState.decisionText}
                              onChange={(event) =>
                                updateDecisionEditState(activeAgenda.id, {
                                  decisionText: event.target.value,
                                  error: null,
                                })
                              }
                              rows={4}
                              disabled={!canEditDecisions}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#0b4aa2]"
                            />

                            <div className="grid gap-4 md:grid-cols-2">
                              <select
                                value={decisionEditState.decisionType}
                                onChange={(event) =>
                                  updateDecisionEditState(activeAgenda.id, {
                                    decisionType: event.target.value,
                                  })
                                }
                                disabled={!canEditDecisions}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#0b4aa2]"
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
                                  updateDecisionEditState(activeAgenda.id, {
                                    dueDate: event.target.value,
                                  })
                                }
                                disabled={!canEditDecisions}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#0b4aa2]"
                              />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="relative">
                                <div className="relative">
                                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                  <input
                                    value={decisionEditState.responsibleSearch}
                                    onChange={(event) =>
                                      handleResponsibleSearch(activeAgenda.id, event.target.value, "edit")
                                    }
                                    disabled={!canEditDecisions}
                                    placeholder="Person suchen oder frei eintragen"
                                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-[#0b4aa2]"
                                  />
                                  {decisionEditState.isSearching ? (
                                    <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                                  ) : null}
                                </div>

                                {decisionEditState.responsibleOptions.length > 0 && canEditDecisions ? (
                                  <div className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                                    {decisionEditState.responsibleOptions.map((person) => (
                                      <button
                                        key={person.id}
                                        type="button"
                                        onClick={() =>
                                          updateDecisionEditState(activeAgenda.id, {
                                            responsiblePersonId: person.id,
                                            responsibleDisplayName: person.displayName,
                                            responsibleSearch: person.displayName,
                                            responsibleOptions: [],
                                          })
                                        }
                                        className="block w-full rounded-xl px-3 py-2 text-left hover:bg-slate-50"
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
                                  updateDecisionEditState(activeAgenda.id, {
                                    remarks: event.target.value,
                                  })
                                }
                                disabled={!canEditDecisions}
                                placeholder="Optionaler Kontext"
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#0b4aa2]"
                              />
                            </div>

                            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                              <input
                                type="checkbox"
                                checked={decisionEditState.createMatter}
                                onChange={(event) =>
                                  updateDecisionEditState(activeAgenda.id, {
                                    createMatter: event.target.checked,
                                  })
                                }
                                disabled={!canEditDecisions}
                                className="mt-1 h-4 w-4 rounded border-slate-300"
                              />
                              <span className="text-sm text-slate-700">
                                Fuer Pendenz-Autogenerierung bestaetigen
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
                                  updateDecisionEditState(
                                    activeAgenda.id,
                                    createInitialDecisionEditState(),
                                  )
                                }
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                              >
                                <X className="h-4 w-4" />
                                Abbrechen
                              </button>
                              <button
                                type="button"
                                onClick={() => saveDecisionEdit(activeAgenda)}
                                disabled={decisionEditState.isSubmitting || !canEditDecisions}
                                className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
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
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={[
                                        "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                                        getDecisionBadgeClass(decision.decisionType),
                                      ].join(" ")}
                                    >
                                      {getDecisionTypeLabel(decision.decisionType)}
                                    </span>

                                    {decision.createMatter ? (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                        <Link2 className="h-3.5 w-3.5" />
                                        Mit Pendenz-Link
                                      </span>
                                    ) : null}
                                  </div>

                                  <p className="text-sm font-medium leading-6 text-slate-900">
                                    {decision.decisionText}
                                  </p>
                                </div>
                              </div>

                              {decision.dueDateLabel ? (
                                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                                  <Clock3 className="h-3.5 w-3.5" />
                                  Faellig bis {decision.dueDateLabel}
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
                                  {decision.remarks ?? "—"}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => startDecisionEdit(activeAgenda.id, decision)}
                                disabled={!canEditDecisions}
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                Bearbeiten
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  const confirmed = confirm("Entscheidung wirklich loeschen?");
                                  if (!confirmed) {
                                    return;
                                  }
                                  try {
                                    await deleteDecision(decision.id);
                                  } catch (error) {
                                    alert(
                                      error instanceof Error
                                        ? error.message
                                        : "Loeschen fehlgeschlagen.",
                                    );
                                  }
                                }}
                                disabled={!canEditDecisions}
                                className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Loeschen
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                    Noch keine Entscheide zu diesem Traktandum.
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-slate-800">
                      Neuer Entscheid / Auftrag
                    </label>
                    <textarea
                      value={decisionState.decisionText}
                      onChange={(event) =>
                        updateDecisionState(activeAgenda.id, {
                          decisionText: event.target.value,
                          error: null,
                        })
                      }
                      rows={4}
                      disabled={!canEditDecisions}
                      placeholder={
                        canEditDecisions
                          ? "Was wurde bei diesem Traktandum beschlossen?"
                          : "Meeting abgeschlossen: Entscheide sind gesperrt."
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#0b4aa2]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-800">Typ</label>
                    <select
                      value={decisionState.decisionType}
                      onChange={(event) =>
                        updateDecisionState(activeAgenda.id, {
                          decisionType: event.target.value,
                        })
                      }
                      disabled={!canEditDecisions}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#0b4aa2]"
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
                      Faellig bis
                    </label>
                    <input
                      type="date"
                      value={decisionState.dueDate}
                      onChange={(event) =>
                        updateDecisionState(activeAgenda.id, {
                          dueDate: event.target.value,
                        })
                      }
                      disabled={!canEditDecisions}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#0b4aa2]"
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
                          handleResponsibleSearch(activeAgenda.id, event.target.value, "create")
                        }
                        disabled={!canEditDecisions}
                        placeholder="Person suchen oder frei eintragen"
                        className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-[#0b4aa2]"
                      />
                      {decisionState.isSearching ? (
                        <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                      ) : null}
                    </div>

                    {decisionState.responsibleOptions.length > 0 && canEditDecisions ? (
                      <div className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                        {decisionState.responsibleOptions.map((person) => (
                          <button
                            key={person.id}
                            type="button"
                            onClick={() =>
                              updateDecisionState(activeAgenda.id, {
                                responsiblePersonId: person.id,
                                responsibleDisplayName: person.displayName,
                                responsibleSearch: person.displayName,
                                responsibleOptions: [],
                              })
                            }
                            className="block w-full rounded-xl px-3 py-2 text-left hover:bg-slate-50"
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
                        updateDecisionState(activeAgenda.id, {
                          remarks: event.target.value,
                        })
                      }
                      disabled={!canEditDecisions}
                      placeholder="Optionaler Kontext"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#0b4aa2]"
                    />
                  </div>
                </div>

                <div className="mt-4 rounded-[20px] border border-slate-200 bg-white px-4 py-4">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={decisionState.createMatter}
                      onChange={(event) =>
                        updateDecisionState(activeAgenda.id, {
                          createMatter: event.target.checked,
                        })
                      }
                      disabled={!canEditDecisions}
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-700">
                      Diesen Entscheid fuer die automatische Pendenz-Erstellung markieren
                    </span>
                  </label>
                </div>

                {decisionState.error ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {decisionState.error}
                  </div>
                ) : null}

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => submitDecision(activeAgenda)}
                    disabled={decisionState.isSubmitting || !canEditDecisions}
                    className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
                  >
                    {decisionState.isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : canEditDecisions ? (
                      <Plus className="h-4 w-4" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                    {canEditDecisions ? "Entscheid erfassen" : "Gesperrt"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[24px] border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 text-slate-700">
                <ListChecks className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Aktives Traktandum</p>
                <p className="text-xs text-slate-500">Kontext und Fortschritt</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Protokolleintraege
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {activeProtocolEntries.length}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Entscheide
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {activeDecisions.length}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Fortschritt
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {getAgendaProgress(activeProtocolEntries.length, activeDecisions.length)}%
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-[#0b4aa2]/15 bg-[#0b4aa2]/5 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-[#0b4aa2]/15 bg-white p-2 text-[#0b4aa2]">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Naechster Ausbau</p>
                <p className="text-xs text-slate-500">CRUD fuer Meetings / Traktanden / Subtasks</p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-600">
              Sobald dieser Build wieder sauber ist, erweitern wir als naechsten Schritt
              systematisch Edit- und Delete-Funktionen fuer Meetings, Traktanden,
              Initiativen und Work Items.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}