"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  FileText,
  FolderGit2,
  ListChecks,
  Loader2,
  Plus,
} from "lucide-react";
import type {
  MeetingAgendaItem,
  MeetingDecisionItem,
  MeetingInitiativeOption,
  MeetingProtocolEntryItem,
} from "@/lib/vereinsleitung/meeting-utils";
import { groupByAgendaItems } from "@/lib/vereinsleitung/meeting-grouping";

type VereinsleitungMeetingExecutionWorkspaceProps = {
  meetingId: string;
  agendaItems: MeetingAgendaItem[];
  protocolEntries: MeetingProtocolEntryItem[];
  decisions: MeetingDecisionItem[];
  initiativeOptions: MeetingInitiativeOption[];
  isDone: boolean;
};

type InitiativeMode = "NONE" | "CREATE" | "LINK";

type InlineState = {
  openNoteForAgendaId: string | null;
  openDecisionForAgendaId: string | null;
  noteText: string;
  decisionText: string;
  decisionType: "DECISION" | "TASK" | "APPROVAL" | "INFO";
  createMatter: boolean;
  initiativeMode: InitiativeMode;
  selectedInitiativeId: string;
  initiativeTitle: string;
  isSavingNote: boolean;
  isSavingDecision: boolean;
  error: string | null;
};

const INITIAL_INLINE_STATE: InlineState = {
  openNoteForAgendaId: null,
  openDecisionForAgendaId: null,
  noteText: "",
  decisionText: "",
  decisionType: "DECISION",
  createMatter: false,
  initiativeMode: "NONE",
  selectedInitiativeId: "",
  initiativeTitle: "",
  isSavingNote: false,
  isSavingDecision: false,
  error: null,
};

function getDecisionBadgeClass(decisionType: string) {
  switch (decisionType) {
    case "TASK":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "APPROVAL":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "INFO":
      return "border-slate-200 bg-slate-50 text-slate-700";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
}

export default function VereinsleitungMeetingExecutionWorkspace({
  meetingId,
  agendaItems,
  protocolEntries,
  decisions,
  initiativeOptions,
  isDone,
}: VereinsleitungMeetingExecutionWorkspaceProps) {
  const router = useRouter();

  const groupedAgenda = useMemo(
    () => groupByAgendaItems(agendaItems, protocolEntries, decisions),
    [agendaItems, protocolEntries, decisions],
  );

  const unassignedProtocolEntries = useMemo(
    () => protocolEntries.filter((entry) => !entry.agendaItemId),
    [protocolEntries],
  );

  const unassignedDecisions = useMemo(
    () => decisions.filter((decision) => !decision.agendaItemId),
    [decisions],
  );

  const [inlineState, setInlineState] = useState<InlineState>(INITIAL_INLINE_STATE);

  function openNote(agendaItemId: string) {
    setInlineState((current) => ({
      ...current,
      openNoteForAgendaId: agendaItemId,
      openDecisionForAgendaId:
        current.openDecisionForAgendaId === agendaItemId
          ? null
          : current.openDecisionForAgendaId,
      noteText: "",
      error: null,
    }));
  }

  function openDecision(agendaItemId: string, agendaItemTitle: string) {
    setInlineState((current) => ({
      ...current,
      openDecisionForAgendaId: agendaItemId,
      openNoteForAgendaId:
        current.openNoteForAgendaId === agendaItemId ? null : current.openNoteForAgendaId,
      decisionText: "",
      decisionType: "DECISION",
      createMatter: false,
      initiativeMode: "NONE",
      selectedInitiativeId: "",
      initiativeTitle: agendaItemTitle,
      error: null,
    }));
  }

  function closeInlineEditors() {
    setInlineState((current) => ({
      ...current,
      openNoteForAgendaId: null,
      openDecisionForAgendaId: null,
      noteText: "",
      decisionText: "",
      decisionType: "DECISION",
      createMatter: false,
      initiativeMode: "NONE",
      selectedInitiativeId: "",
      initiativeTitle: "",
      isSavingNote: false,
      isSavingDecision: false,
      error: null,
    }));
  }

  async function createProtocolEntry(agendaItemId: string, agendaItemTitle: string) {
    const notes = inlineState.noteText.trim();

    if (!notes) {
      setInlineState((current) => ({
        ...current,
        error: "Bitte zuerst eine Notiz erfassen.",
      }));
      return;
    }

    try {
      setInlineState((current) => ({
        ...current,
        isSavingNote: true,
        error: null,
      }));

      const response = await fetch("/api/vereinsleitung/meetings/" + meetingId + "/protocol", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agendaItemId,
          agendaItemTitle,
          notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Protokolleintrag konnte nicht erstellt werden.");
      }

      closeInlineEditors();
      router.refresh();
    } catch (error) {
      setInlineState((current) => ({
        ...current,
        isSavingNote: false,
        error:
          error instanceof Error
            ? error.message
            : "Technischer Fehler beim Erstellen der Notiz.",
      }));
    }
  }

  async function createDecision(agendaItemId: string, agendaItemTitle: string) {
    const decisionText = inlineState.decisionText.trim();

    if (!decisionText) {
      setInlineState((current) => ({
        ...current,
        error: "Bitte zuerst einen Beschlusstext erfassen.",
      }));
      return;
    }

    if (inlineState.initiativeMode === "CREATE" && !inlineState.initiativeTitle.trim()) {
      setInlineState((current) => ({
        ...current,
        error: "Bitte zuerst einen Initiative-Titel erfassen.",
      }));
      return;
    }

    if (inlineState.initiativeMode === "LINK" && !inlineState.selectedInitiativeId) {
      setInlineState((current) => ({
        ...current,
        error: "Bitte zuerst eine bestehende Initiative auswählen.",
      }));
      return;
    }

    try {
      setInlineState((current) => ({
        ...current,
        isSavingDecision: true,
        error: null,
      }));

      const response = await fetch("/api/vereinsleitung/meetings/" + meetingId + "/decisions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agendaItemId,
          agendaItemTitle,
          decisionText,
          decisionType: inlineState.decisionType,
          createMatter: inlineState.createMatter,
          createInitiative: inlineState.initiativeMode === "CREATE",
          initiativeTitle:
            inlineState.initiativeMode === "CREATE"
              ? inlineState.initiativeTitle.trim()
              : null,
          initiativeId:
            inlineState.initiativeMode === "LINK"
              ? inlineState.selectedInitiativeId
              : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Beschluss konnte nicht erstellt werden.");
      }

      closeInlineEditors();
      router.refresh();
    } catch (error) {
      setInlineState((current) => ({
        ...current,
        isSavingDecision: false,
        error:
          error instanceof Error
            ? error.message
            : "Technischer Fehler beim Erstellen des Beschlusses.",
      }));
    }
  }

  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
            Execution Workspace
          </p>
          <h2 className="mt-2 text-[1.2rem] font-semibold text-slate-900">
            Meeting-Ausführung nach Traktanden
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Protokoll, Beschlüsse und Initiative-Verknüpfungen werden entlang der Agenda sichtbar gemacht.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {groupedAgenda.length} Traktanden
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {protocolEntries.length} Protokolleinträge
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {decisions.length} Beschlüsse
          </span>
          {isDone ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Meeting abgeschlossen
            </span>
          ) : null}
        </div>
      </div>

      {groupedAgenda.length === 0 ? (
        <div className="mt-6 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-500">
          Für dieses Meeting wurden noch keine Traktanden hinterlegt. Ergänze zuerst die Agenda, damit Protokoll und Beschlüsse sauber strukturiert geführt werden können.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {groupedAgenda.map((item, index) => (
            <article
              key={item.id}
              className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.03)]"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Traktand {index + 1}
                  </div>
                  <h3 className="mt-2 text-[1.02rem] font-semibold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {item.description ?? "Keine zusätzliche Beschreibung hinterlegt."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    {item.protocolEntries.length} Notizen
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    {item.decisions.length} Beschlüsse
                  </span>
                </div>
              </div>

              {!isDone ? (
                <div className="mt-5 rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">Aktionen für dieses Traktand</div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openNote(item.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Notiz hinzufügen
                      </button>
                      <button
                        type="button"
                        onClick={() => openDecision(item.id, item.title)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Beschluss hinzufügen
                      </button>
                    </div>
                  </div>

                  {inlineState.error &&
                  (inlineState.openNoteForAgendaId === item.id ||
                    inlineState.openDecisionForAgendaId === item.id) ? (
                    <div className="mt-4 rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {inlineState.error}
                    </div>
                  ) : null}

                  {inlineState.openNoteForAgendaId === item.id ? (
                    <div className="mt-4 rounded-[16px] bg-white p-4">
                      <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Neue Notiz
                      </label>
                      <textarea
                        value={inlineState.noteText}
                        onChange={(event) =>
                          setInlineState((current) => ({
                            ...current,
                            noteText: event.target.value,
                          }))
                        }
                        rows={4}
                        placeholder="Protokollnotiz zu diesem Traktand ..."
                        className="mt-2 w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                      />
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => createProtocolEntry(item.id, item.title)}
                          disabled={inlineState.isSavingNote}
                          className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#083a80] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {inlineState.isSavingNote ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : null}
                          Notiz speichern
                        </button>
                        <button
                          type="button"
                          onClick={closeInlineEditors}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {inlineState.openDecisionForAgendaId === item.id ? (
                    <div className="mt-4 rounded-[16px] bg-white p-4">
                      <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Typ
                          </label>
                          <select
                            value={inlineState.decisionType}
                            onChange={(event) =>
                              setInlineState((current) => ({
                                ...current,
                                decisionType: event.target.value as InlineState["decisionType"],
                              }))
                            }
                            className="mt-2 w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                          >
                            <option value="DECISION">Beschluss</option>
                            <option value="TASK">Auftrag</option>
                            <option value="APPROVAL">Freigabe</option>
                            <option value="INFO">Info</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Beschlusstext
                          </label>
                          <textarea
                            value={inlineState.decisionText}
                            onChange={(event) =>
                              setInlineState((current) => ({
                                ...current,
                                decisionText: event.target.value,
                              }))
                            }
                            rows={4}
                            placeholder="Beschluss, Auftrag oder Entscheidung zu diesem Traktand ..."
                            className="mt-2 w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                          />
                        </div>
                      </div>

                      <label className="mt-4 flex items-start gap-3 rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={inlineState.createMatter}
                          onChange={(event) =>
                            setInlineState((current) => ({
                              ...current,
                              createMatter: event.target.checked,
                            }))
                          }
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-[#0b4aa2] focus:ring-[#0b4aa2]"
                        />
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            Als Pendenz übernehmen
                          </div>
                          <div className="mt-1 text-sm leading-6 text-slate-500">
                            Beim Speichern wird zusätzlich automatisch eine neue Pendenz erzeugt und mit diesem Meeting verknüpft.
                          </div>
                        </div>
                      </label>

                      <div className="mt-4 rounded-[16px] border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center gap-2">
                          <FolderGit2 className="h-4 w-4 text-[#0b4aa2]" />
                          <div className="text-sm font-semibold text-slate-900">
                            Initiative-Verknüpfung
                          </div>
                        </div>

                        <div className="mt-3 rounded-[14px] border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm leading-6 text-blue-900">
                          If you link or create an initiative here, the system will automatically create a sourced work item with a back-reference to this meeting decision.
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setInlineState((current) => ({
                                ...current,
                                initiativeMode: "NONE",
                                selectedInitiativeId: "",
                              }))
                            }
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                              inlineState.initiativeMode === "NONE"
                                ? "border-slate-300 bg-slate-900 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            Keine
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setInlineState((current) => ({
                                ...current,
                                initiativeMode: "CREATE",
                                selectedInitiativeId: "",
                                initiativeTitle: current.initiativeTitle || item.title,
                              }))
                            }
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                              inlineState.initiativeMode === "CREATE"
                                ? "border-[#0b4aa2] bg-[#0b4aa2] text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            Neue Initiative
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setInlineState((current) => ({
                                ...current,
                                initiativeMode: "LINK",
                              }))
                            }
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                              inlineState.initiativeMode === "LINK"
                                ? "border-[#0b4aa2] bg-[#0b4aa2] text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            Bestehende Initiative
                          </button>
                        </div>

                        {inlineState.initiativeMode === "CREATE" ? (
                          <div className="mt-4">
                            <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                              Initiative-Titel
                            </label>
                            <input
                              value={inlineState.initiativeTitle}
                              onChange={(event) =>
                                setInlineState((current) => ({
                                  ...current,
                                  initiativeTitle: event.target.value,
                                }))
                              }
                              placeholder="Titel der neuen Initiative"
                              className="mt-2 w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                            />
                          </div>
                        ) : null}

                        {inlineState.initiativeMode === "LINK" ? (
                          <div className="mt-4">
                            <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                              Bestehende Initiative
                            </label>
                            <select
                              value={inlineState.selectedInitiativeId}
                              onChange={(event) =>
                                setInlineState((current) => ({
                                  ...current,
                                  selectedInitiativeId: event.target.value,
                                }))
                              }
                              className="mt-2 w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                            >
                              <option value="">Initiative auswählen</option>
                              {initiativeOptions.map((initiative) => (
                                <option key={initiative.id} value={initiative.id}>
                                  {initiative.title} · {initiative.statusLabel}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => createDecision(item.id, item.title)}
                          disabled={inlineState.isSavingDecision}
                          className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#083a80] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {inlineState.isSavingDecision ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : null}
                          Beschluss speichern
                        </button>
                        <button
                          type="button"
                          onClick={closeInlineEditors}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#0b4aa2]" />
                    <h4 className="text-sm font-semibold text-slate-900">Protokoll</h4>
                  </div>

                  {item.protocolEntries.length === 0 ? (
                    <div className="mt-4 rounded-[16px] border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500">
                      Noch keine Protokolleinträge zu diesem Traktand.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {item.protocolEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-[16px] bg-white px-4 py-4 text-sm leading-6 text-slate-600"
                        >
                          {entry.notes}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#0b4aa2]" />
                    <h4 className="text-sm font-semibold text-slate-900">Beschlüsse</h4>
                  </div>

                  {item.decisions.length === 0 ? (
                    <div className="mt-4 rounded-[16px] border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500">
                      Noch keine Beschlüsse zu diesem Traktand.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {item.decisions.map((decision) => (
                        <div
                          key={decision.id}
                          className="rounded-[16px] bg-white px-4 py-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <div className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getDecisionBadgeClass(decision.decisionType)}`}>
                              {decision.decisionTypeLabel}
                            </div>
                            {decision.createMatter ? (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                                Mit Pendenz
                              </span>
                            ) : null}
                            {decision.initiativeSlug && decision.initiativeTitle ? (
                              <Link
                                href={"/vereinsleitung/initiativen/" + decision.initiativeSlug}
                                className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-100"
                              >
                                Initiative: {decision.initiativeTitle}
                              </Link>
                            ) : decision.initiativeTitle ? (
                              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                                Initiative: {decision.initiativeTitle}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2 text-sm leading-6 text-slate-600">
                            {decision.decisionText}
                          </div>
                          {decision.responsibleDisplayName || decision.dueDateLabel ? (
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              {decision.responsibleDisplayName ? (
                                <span>Verantwortlich: {decision.responsibleDisplayName}</span>
                              ) : null}
                              {decision.dueDateLabel ? (
                                <span>Fällig: {decision.dueDateLabel}</span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {unassignedProtocolEntries.length > 0 || unassignedDecisions.length > 0 ? (
        <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50/70 p-5">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-amber-700" />
            <h3 className="text-sm font-semibold text-amber-900">
              Nicht zugeordnete Inhalte
            </h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            Einige Protokolleinträge oder Beschlüsse sind noch keinem Traktand zugeordnet.
          </p>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="rounded-[18px] bg-white/80 p-4">
              <div className="text-sm font-semibold text-slate-900">
                Offene Protokolleinträge
              </div>
              {unassignedProtocolEntries.length === 0 ? (
                <div className="mt-3 text-sm text-slate-500">Keine offenen Einträge.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {unassignedProtocolEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-[14px] bg-white px-3 py-3 text-sm leading-6 text-slate-600"
                    >
                      {entry.notes}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[18px] bg-white/80 p-4">
              <div className="text-sm font-semibold text-slate-900">
                Offene Beschlüsse
              </div>
              {unassignedDecisions.length === 0 ? (
                <div className="mt-3 text-sm text-slate-500">Keine offenen Beschlüsse.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {unassignedDecisions.map((decision) => (
                    <div
                      key={decision.id}
                      className="rounded-[14px] bg-white px-3 py-3 text-sm leading-6 text-slate-600"
                    >
                      <div className="font-semibold text-slate-900">
                        {decision.decisionTypeLabel}
                      </div>
                      <div className="mt-1">{decision.decisionText}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
