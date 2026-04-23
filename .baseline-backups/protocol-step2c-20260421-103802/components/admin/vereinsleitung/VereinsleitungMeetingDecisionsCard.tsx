"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  FileCheck2,
  Info,
  ListTodo,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import {
  getDecisionTypeLabel,
  getDecisionTypeOptions,
  type MeetingAgendaItem,
  type MeetingDecisionItem,
  type MeetingDecisionResponsibleOption,
} from "@/lib/vereinsleitung/meeting-utils";

type VereinsleitungMeetingDecisionsCardProps = {
  meetingId: string;
  decisions: MeetingDecisionItem[];
  agendaItems: MeetingAgendaItem[];
};

type SearchResultPerson = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
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

export default function VereinsleitungMeetingDecisionsCard({
  meetingId,
  decisions,
  agendaItems,
}: VereinsleitungMeetingDecisionsCardProps) {
  const router = useRouter();

  const decisionTypeOptions = useMemo(() => getDecisionTypeOptions(), []);
  const [isExpanded, setIsExpanded] = useState(false);
  const [decisionText, setDecisionText] = useState("");
  const [decisionType, setDecisionType] = useState("DECISION");
  const [agendaItemId, setAgendaItemId] = useState("");
  const [responsibleSearch, setResponsibleSearch] = useState("");
  const [responsibleOptions, setResponsibleOptions] = useState<
    MeetingDecisionResponsibleOption[]
  >([]);
  const [responsiblePersonId, setResponsiblePersonId] = useState("");
  const [responsibleDisplayName, setResponsibleDisplayName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [createMatter, setCreateMatter] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const selectedAgendaItemTitle =
    agendaItems.find((item) => item.id === agendaItemId)?.title ?? null;

  async function handleResponsibleSearch(value: string) {
    setResponsibleSearch(value);
    setResponsibleDisplayName(value);

    if (value.trim().length < 2) {
      setResponsibleOptions([]);
      return;
    }

    try {
      setIsSearching(true);
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

      setResponsibleOptions(mapped);
    } catch (error) {
      console.error(error);
      setResponsibleOptions([]);
    } finally {
      setIsSearching(false);
    }
  }

  function resetForm() {
    setDecisionText("");
    setDecisionType("DECISION");
    setAgendaItemId("");
    setResponsibleSearch("");
    setResponsibleOptions([]);
    setResponsiblePersonId("");
    setResponsibleDisplayName("");
    setDueDate("");
    setRemarks("");
    setCreateMatter(false);
    setFormError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!decisionText.trim()) {
      setFormError("Bitte erfasse einen Beschluss- oder Auftragstext.");
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      setFormSuccess(null);

      const response = await fetch(
        "/api/vereinsleitung/meetings/" + meetingId + "/decisions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            decisionText: decisionText.trim(),
            decisionType,
            agendaItemId: agendaItemId || null,
            agendaItemTitle: selectedAgendaItemTitle,
            responsiblePersonId: responsiblePersonId || null,
            responsibleDisplayName: responsibleDisplayName.trim() || null,
            dueDate: dueDate || null,
            createMatter,
            remarks: remarks.trim() || null,
          }),
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Entscheidung konnte nicht gespeichert werden.");
      }

      resetForm();
      setFormSuccess("Entscheidung wurde gespeichert.");
      setIsExpanded(false);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Technischer Fehler beim Speichern.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
            Entscheidungen
          </p>
          <h2 className="text-xl font-semibold text-slate-900">
            Beschlüsse & Aufträge
          </h2>
          <p className="text-sm text-slate-600">
            Erfassung direkt auf Basis der vorhandenen Traktanden.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
            {decisions.length} Einträge
          </div>

          <button
            type="button"
            onClick={() => {
              setIsExpanded((current) => !current);
              setFormError(null);
              setFormSuccess(null);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#083a80]"
          >
            <Plus className="h-4 w-4" />
            Entscheidung erfassen
          </button>
        </div>
      </div>

      {isExpanded ? (
        <form onSubmit={handleSubmit} className="mt-6 rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-800">
                Beschluss / Auftrag
              </label>
              <textarea
                value={decisionText}
                onChange={(event) => setDecisionText(event.target.value)}
                rows={4}
                placeholder="Zum Beispiel: Matchday-Koordination erstellt bis nächste Woche den finalen Trainingsslot-Plan."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-800">
                Typ
              </label>
              <select
                value={decisionType}
                onChange={(event) => setDecisionType(event.target.value)}
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
                Traktandum
              </label>
              <select
                value={agendaItemId}
                onChange={(event) => setAgendaItemId(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
              >
                <option value="">Kein direktes Traktandum</option>
                {agendaItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <label className="mb-2 block text-sm font-medium text-slate-800">
                Verantwortlich
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={responsibleSearch}
                  onChange={(event) => {
                    const value = event.target.value;
                    setResponsiblePersonId("");
                    handleResponsibleSearch(value);
                  }}
                  placeholder="Person suchen oder frei eintragen"
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                />
                {isSearching ? (
                  <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                ) : null}
              </div>

              {responsibleOptions.length > 0 ? (
                <div className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  {responsibleOptions.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => {
                        setResponsiblePersonId(person.id);
                        setResponsibleDisplayName(person.displayName);
                        setResponsibleSearch(person.displayName);
                        setResponsibleOptions([]);
                      }}
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
                Fällig bis
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-800">
                Bemerkung
              </label>
              <input
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder="Optionaler Kontext oder Ergänzung"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
              />
            </div>
          </div>

          <label className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <input
              type="checkbox"
              checked={createMatter}
              onChange={(event) => setCreateMatter(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-[#0b4aa2] focus:ring-[#0b4aa2]"
            />
            <span className="text-sm text-slate-700">
              Für spätere Pendenz-Autogenerierung vormerken
            </span>
          </label>

          {formError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {formError}
            </div>
          ) : null}

          {formSuccess ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {formSuccess}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setIsExpanded(false);
                setFormError(null);
                setFormSuccess(null);
              }}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Abbrechen
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#083a80] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Entscheidung speichern
            </button>
          </div>
        </form>
      ) : null}

      {decisions.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-500">
          Noch keine Entscheidungen erfasst.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {decisions.map((decision) => {
            const Icon = getDecisionIcon(decision.decisionType);

            return (
              <article
                key={decision.id}
                className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-2xl border border-slate-200 bg-white p-2 text-slate-700">
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

                        {decision.agendaItemTitle ? (
                          <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                            {decision.agendaItemTitle}
                          </span>
                        ) : null}

                        {decision.createMatter ? (
                          <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            Für Pendenz vorbereitet
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
                      Fällig bis {decision.dueDateLabel}
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
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

