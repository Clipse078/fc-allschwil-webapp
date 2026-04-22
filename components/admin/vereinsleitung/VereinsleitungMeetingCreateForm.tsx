"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";
import PeoplePicker, {
  type PeoplePickerPerson,
} from "@/components/admin/shared/people-picker/PeoplePicker";

type MeetingStatus = "PLANNED" | "IN_PROGRESS" | "DONE";
type ParticipantStatus = "INVITED" | "CONFIRMED" | "EXCUSED" | "ABSENT";
type MeetingMode = "ON_SITE" | "ONLINE" | "HYBRID";
type MeetingProvider = "NONE" | "EXTERNAL" | "MICROSOFT_TEAMS";
type ProviderUiOption = "NONE" | "MICROSOFT_TEAMS" | "SKYPE" | "EXTERNAL";
type TeamsSyncStatus =
  | "NOT_CONFIGURED"
  | "MANUAL"
  | "PENDING"
  | "CREATED"
  | "FAILED";

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

type ParticipantRow = {
  key: string;
  personId: string;
  displayName: string;
  roleLabel: string;
  status: ParticipantStatus;
  remarks: string;
  selectedPerson: PeoplePickerPerson | null;
};

type AgendaItemRow = {
  key: string;
  title: string;
  description: string;
};

type InitialParticipant = {
  personId?: string | null;
  displayName: string;
  roleLabel?: string | null;
  status?: string | null;
  remarks?: string | null;
};

type InitialAgendaItem = {
  title?: string | null;
  description?: string | null;
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
  meetingMode: MeetingMode;
  meetingProvider: MeetingProvider;
  providerUi: ProviderUiOption;
  externalMeetingUrl: string;
  teamsJoinUrl: string;
  teamsSyncStatus: TeamsSyncStatus;
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
  initialAgendaItems?: InitialAgendaItem[];
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
  meetingMode: "ON_SITE",
  meetingProvider: "NONE",
  providerUi: "NONE",
  externalMeetingUrl: "",
  teamsJoinUrl: "",
  teamsSyncStatus: "NOT_CONFIGURED",
};

const PARTICIPANT_STATUS_OPTIONS: { value: ParticipantStatus; label: string }[] = [
  { value: "INVITED", label: "Eingeladen" },
  { value: "CONFIRMED", label: "Anwesend" },
  { value: "EXCUSED", label: "Entschuldigt" },
  { value: "ABSENT", label: "Abwesend" },
];

const MEETING_MODE_OPTIONS: { value: MeetingMode; label: string }[] = [
  { value: "ON_SITE", label: "Vor Ort" },
  { value: "ONLINE", label: "Online" },
  { value: "HYBRID", label: "Hybrid" },
];

const TEAMS_SYNC_STATUS_OPTIONS: { value: TeamsSyncStatus; label: string }[] = [
  { value: "NOT_CONFIGURED", label: "Nicht konfiguriert" },
  { value: "MANUAL", label: "Manuell" },
  { value: "PENDING", label: "Ausstehend" },
  { value: "CREATED", label: "Erstellt" },
  { value: "FAILED", label: "Fehlgeschlagen" },
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

function getTeamsSyncStatusClass(status: TeamsSyncStatus) {
  switch (status) {
    case "CREATED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "PENDING":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "FAILED":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "MANUAL":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
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

function normalizeMeetingMode(value?: string | null): MeetingMode {
  switch (value) {
    case "ONLINE":
    case "HYBRID":
      return value;
    default:
      return "ON_SITE";
  }
}

function normalizeMeetingProvider(value?: string | null): MeetingProvider {
  switch (value) {
    case "EXTERNAL":
    case "MICROSOFT_TEAMS":
      return value;
    default:
      return "NONE";
  }
}

function normalizeTeamsSyncStatus(value?: string | null): TeamsSyncStatus {
  switch (value) {
    case "MANUAL":
    case "PENDING":
    case "CREATED":
    case "FAILED":
      return value;
    default:
      return "NOT_CONFIGURED";
  }
}

function inferProviderUi(
  meetingProvider?: string | null,
  externalMeetingUrl?: string | null,
  onlineMeetingUrl?: string | null,
): ProviderUiOption {
  if (meetingProvider === "MICROSOFT_TEAMS") {
    return "MICROSOFT_TEAMS";
  }

  if (meetingProvider === "EXTERNAL") {
    const url = (externalMeetingUrl ?? onlineMeetingUrl ?? "").toLowerCase();

    if (url.includes("skype")) {
      return "SKYPE";
    }

    return "EXTERNAL";
  }

  return "NONE";
}

function buildParticipantRoleLabel(person: PeoplePickerPerson) {
  return [person.functionLabel, person.teamLabel].filter(Boolean).join(" • ");
}

function createParticipantRowFromPerson(person: PeoplePickerPerson): ParticipantRow {
  return {
    key: Math.random().toString(36).slice(2, 11),
    personId: person.id,
    displayName: person.displayName,
    roleLabel: buildParticipantRoleLabel(person),
    status: "INVITED",
    remarks: "",
    selectedPerson: person,
  };
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
    selectedPerson:
      initial?.personId && personName
        ? {
            id: initial.personId,
            displayName: personName,
            functionLabel: initial.roleLabel ?? null,
            teamLabel: null,
            email: null,
          }
        : null,
  };
}

function createAgendaItem(initial?: InitialAgendaItem): AgendaItemRow {
  return {
    key: Math.random().toString(36).slice(2, 11),
    title: initial?.title?.trim() ?? "",
    description: initial?.description?.trim() ?? "",
  };
}

function ProviderTile({
  isActive,
  title,
  subtitle,
  badge,
  onClick,
}: {
  isActive: boolean;
  title: string;
  subtitle: string;
  badge: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[22px] border p-4 text-left transition ${
        isActive
          ? "border-[#0b4aa2]/30 bg-[#0b4aa2]/[0.05] shadow-sm"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-bold text-[#0b4aa2]">
          {badge}
        </div>
        {isActive ? (
          <span className="rounded-full border border-[#0b4aa2]/20 bg-[#0b4aa2]/[0.05] px-2.5 py-1 text-[11px] font-semibold text-[#0b4aa2]">
            Aktiv
          </span>
        ) : null}
      </div>

      <div className="mt-4 text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</div>
    </button>
  );
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
  initialAgendaItems,
  meetingId,
}: VereinsleitungMeetingCreateFormProps) {
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
    ...INITIAL_STATE,
    ...initialValues,
    meetingMode: normalizeMeetingMode(initialValues?.meetingMode),
    meetingProvider: normalizeMeetingProvider(initialValues?.meetingProvider),
    providerUi: inferProviderUi(
      initialValues?.meetingProvider,
      initialValues?.externalMeetingUrl,
      initialValues?.onlineMeetingUrl,
    ),
    teamsSyncStatus: normalizeTeamsSyncStatus(initialValues?.teamsSyncStatus),
  });

  const [selectedMatterIds, setSelectedMatterIds] = useState<string[]>(
    initialSelectedMatterIds ?? [],
  );

  const [participants, setParticipants] = useState<ParticipantRow[]>(
    initialParticipants && initialParticipants.length > 0
      ? initialParticipants.map((participant) => createParticipantRow(participant))
      : [],
  );

  const [agendaItems, setAgendaItems] = useState<AgendaItemRow[]>(
    initialAgendaItems && initialAgendaItems.length > 0
      ? initialAgendaItems.map((item) => createAgendaItem(item))
      : [],
  );

  const [quickAgendaTitle, setQuickAgendaTitle] = useState("");
  const [quickAgendaDescription, setQuickAgendaDescription] = useState("");

  const [pickerItems, setPickerItems] = useState<PeoplePickerPerson[]>([]);
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    return Boolean(form.title.trim() && form.startAt.trim());
  }, [form.startAt, form.title]);

  const showLocationField =
    form.meetingMode === "ON_SITE" || form.meetingMode === "HYBRID";

  const showProviderField =
    form.meetingMode === "ONLINE" || form.meetingMode === "HYBRID";

  const showExternalLinkField =
    showProviderField && (form.providerUi === "EXTERNAL" || form.providerUi === "SKYPE");

  const showTeamsFields =
    showProviderField && form.providerUi === "MICROSOFT_TEAMS";

  const showGenericOnlineLinkField =
    showProviderField && form.providerUi !== "NONE";

  useEffect(() => {
    if (!showProviderField) {
      setForm((current) => ({
        ...current,
        meetingProvider: "NONE",
        providerUi: "NONE",
        externalMeetingUrl: "",
        teamsJoinUrl: "",
        teamsSyncStatus: "NOT_CONFIGURED",
        onlineMeetingUrl: "",
      }));
      return;
    }

    if (form.providerUi === "NONE") {
      setForm((current) => ({
        ...current,
        meetingProvider: "NONE",
        externalMeetingUrl: "",
        teamsJoinUrl: "",
        teamsSyncStatus: "NOT_CONFIGURED",
        onlineMeetingUrl: "",
      }));
    }

    if (form.providerUi === "MICROSOFT_TEAMS") {
      setForm((current) => ({
        ...current,
        meetingProvider: "MICROSOFT_TEAMS",
        teamsSyncStatus:
          current.teamsSyncStatus === "NOT_CONFIGURED" ? "PENDING" : current.teamsSyncStatus,
      }));
    }

    if (form.providerUi === "EXTERNAL" || form.providerUi === "SKYPE") {
      setForm((current) => ({
        ...current,
        meetingProvider: "EXTERNAL",
        teamsJoinUrl: "",
        teamsSyncStatus: "MANUAL",
      }));
    }
  }, [showProviderField, form.providerUi]);

  useEffect(() => {
    if (pickerItems.length === 0) {
      return;
    }

    setParticipants((current) => {
      const existingIds = new Set(current.map((item) => item.personId).filter(Boolean));

      const additions = pickerItems
        .filter((person) => !existingIds.has(person.id))
        .map((person) => createParticipantRowFromPerson(person));

      if (additions.length === 0) {
        return current;
      }

      return [...current, ...additions];
    });

    setPickerItems([]);
  }, [pickerItems]);

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

  function removeParticipant(key: string) {
    setParticipants((current) => current.filter((participant) => participant.key !== key));
  }

  function addAgendaItem(initial?: InitialAgendaItem) {
    setAgendaItems((current) => [...current, createAgendaItem(initial)]);
  }

  function addQuickAgendaItem() {
    const title = quickAgendaTitle.trim();
    const description = quickAgendaDescription.trim();

    if (!title) {
      return;
    }

    addAgendaItem({
      title,
      description,
    });

    setQuickAgendaTitle("");
    setQuickAgendaDescription("");
  }

  function handleQuickAgendaTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addQuickAgendaItem();
    }
  }

  function updateAgendaItem(
    key: string,
    updater: (item: AgendaItemRow) => AgendaItemRow,
  ) {
    setAgendaItems((current) =>
      current.map((item) => (item.key === key ? updater(item) : item)),
    );
  }

  function removeAgendaItem(key: string) {
    setAgendaItems((current) => current.filter((item) => item.key !== key));
  }

  function moveAgendaItem(key: string, direction: "up" | "down") {
    setAgendaItems((current) => {
      const index = current.findIndex((item) => item.key === key);

      if (index === -1) {
        return current;
      }

      const targetIndex = direction === "up" ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
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

    const normalizedAgendaItems = agendaItems
      .map((item) => ({
        title: item.title.trim(),
        description: item.description.trim() || null,
      }))
      .filter((item) => item.title);

    setIsSubmitting(true);
    setError("");

    try {
      const endpoint =
        mode === "edit" && meetingId
          ? "/api/vereinsleitung/meetings/" + meetingId
          : "/api/vereinsleitung/meetings";

      const method = mode === "edit" ? "PATCH" : "POST";

      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        description: form.description.trim() || null,
        location: showLocationField ? form.location.trim() || null : null,
        onlineMeetingUrl: showGenericOnlineLinkField
          ? form.onlineMeetingUrl.trim() || null
          : null,
        startAt: form.startAt,
        endAt: form.endAt.trim() || null,
        status: form.status,
        meetingMode: form.meetingMode,
        meetingProvider: form.meetingProvider,
        externalMeetingUrl: showExternalLinkField
          ? form.externalMeetingUrl.trim() || null
          : null,
        teamsJoinUrl: showTeamsFields ? form.teamsJoinUrl.trim() || null : null,
        teamsSyncStatus: showTeamsFields ? form.teamsSyncStatus : "NOT_CONFIGURED",
        matterIds: selectedMatterIds,
        participants: normalizedParticipants,
        agendaItems: normalizedAgendaItems,
      };

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
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
              className="mt-2 w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0b4aa2] focus:ring-4 focus:ring-[#0b4aa2]/10"
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
              className="mt-2 w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0b4aa2] focus:ring-4 focus:ring-[#0b4aa2]/10"
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
              className="mt-2 w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0b4aa2] focus:ring-4 focus:ring-[#0b4aa2]/10"
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
              className="mt-2 w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0b4aa2] focus:ring-4 focus:ring-[#0b4aa2]/10"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900">
              Meeting-Typ
            </label>
            <select
              value={form.meetingMode}
              onChange={(event) => updateField("meetingMode", event.target.value as MeetingMode)}
              className="mt-2 w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0b4aa2] focus:ring-4 focus:ring-[#0b4aa2]/10"
            >
              {MEETING_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900">
              Status
            </label>
            <select
              value={form.status}
              onChange={(event) => updateField("status", event.target.value as MeetingStatus)}
              className="mt-2 w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0b4aa2] focus:ring-4 focus:ring-[#0b4aa2]/10"
            >
              <option value="PLANNED">Geplant</option>
              <option value="IN_PROGRESS">In Durchführung</option>
              <option value="DONE">Abgeschlossen</option>
            </select>
          </div>

          {showLocationField ? (
            <div>
              <label className="block text-sm font-semibold text-slate-900">
                Ort
              </label>
              <input
                value={form.location}
                onChange={(event) => updateField("location", event.target.value)}
                placeholder="z. B. Clubhaus Sitzungszimmer 1"
                className="mt-2 w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0b4aa2] focus:ring-4 focus:ring-[#0b4aa2]/10"
              />
            </div>
          ) : null}

          {showProviderField ? (
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-900">
                Online-Provider
              </label>

              <div className="mt-2 grid gap-3 md:grid-cols-3">
                <ProviderTile
                  isActive={form.providerUi === "MICROSOFT_TEAMS"}
                  title="Microsoft Teams"
                  subtitle="Für interne FCA Meetings"
                  badge="T"
                  onClick={() => updateField("providerUi", "MICROSOFT_TEAMS")}
                />
                <ProviderTile
                  isActive={form.providerUi === "SKYPE"}
                  title="Skype"
                  subtitle="Schneller externer Link"
                  badge="S"
                  onClick={() => updateField("providerUi", "SKYPE")}
                />
                <ProviderTile
                  isActive={form.providerUi === "EXTERNAL"}
                  title="Anderer Link"
                  subtitle="Für Zoom, Google Meet oder andere Anbieter"
                  badge="↗"
                  onClick={() => updateField("providerUi", "EXTERNAL")}
                />
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Weitere Anbieter wie Zoom oder Google Meet können später ergänzt werden.
              </p>
            </div>
          ) : null}

          {showGenericOnlineLinkField ? (
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-900">
                Allgemeiner Online-Meeting-Link
              </label>
              <input
                value={form.onlineMeetingUrl}
                onChange={(event) => updateField("onlineMeetingUrl", event.target.value)}
                placeholder="https://..."
                className="mt-2 w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0b4aa2] focus:ring-4 focus:ring-[#0b4aa2]/10"
              />
            </div>
          ) : null}

          {showExternalLinkField ? (
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-900">
                {form.providerUi === "SKYPE" ? "Skype-Link" : "Externer Meeting-Link"}
              </label>
              <input
                value={form.externalMeetingUrl}
                onChange={(event) => updateField("externalMeetingUrl", event.target.value)}
                placeholder="https://..."
                className="mt-2 w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0b4aa2] focus:ring-4 focus:ring-[#0b4aa2]/10"
              />
            </div>
          ) : null}

          {showTeamsFields ? (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-900">
                  Teams Join-URL
                </label>
                <input
                  value={form.teamsJoinUrl}
                  onChange={(event) => updateField("teamsJoinUrl", event.target.value)}
                  placeholder="https://teams.microsoft.com/l/meetup-join/..."
                  className="mt-2 w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0b4aa2] focus:ring-4 focus:ring-[#0b4aa2]/10"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900">
                  Teams Sync-Status
                </label>
                <select
                  value={form.teamsSyncStatus}
                  onChange={(event) =>
                    updateField("teamsSyncStatus", event.target.value as TeamsSyncStatus)
                  }
                  className="mt-2 w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0b4aa2] focus:ring-4 focus:ring-[#0b4aa2]/10"
                >
                  {TEAMS_SYNC_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Microsoft Teams Vorbereitung
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Diese Felder bleiben vorerst manuell. Eine echte Microsoft-Integration folgt später separat.
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${getTeamsSyncStatusClass(
                      form.teamsSyncStatus,
                    )}`}
                  >
                    {TEAMS_SYNC_STATUS_OPTIONS.find(
                      (option) => option.value === form.teamsSyncStatus,
                    )?.label ?? form.teamsSyncStatus}
                  </span>
                </div>
              </div>
            </>
          ) : null}

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-900">
              Notizen / Kontext
            </label>
            <textarea
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              rows={5}
              placeholder="Kontext, Vorbereitungen und Hinweise ..."
              className="mt-2 w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0b4aa2] focus:ring-4 focus:ring-[#0b4aa2]/10"
            />
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-[1.08rem] font-semibold text-slate-900">
              Eingeladene Personen
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Personen suchen, hinzufügen und direkt sauber für das Meeting vorbereiten.
            </p>
          </div>

          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {participants.length} eingeladen
          </div>
        </div>

        <div className="mt-5">
          <PeoplePicker
            mode="multiple"
            searchMode="vereinsleitung"
            selectedItems={pickerItems}
            onChange={setPickerItems}
            placeholder="Personen suchen und hinzufügen"
            emptyText="Keine passende Person gefunden."
          />
        </div>

        {participants.length === 0 ? (
          <div className="mt-5 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-500">
            Noch keine Personen eingeladen.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {participants.map((participant) => (
              <div
                key={participant.key}
                className="grid gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-4 md:grid-cols-[minmax(0,1.2fr)_180px_minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">
                    {participant.displayName}
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500">
                    {participant.roleLabel || "Ohne Rollenbezeichnung"}
                  </div>
                </div>

                <select
                  value={participant.status}
                  onChange={(event) =>
                    updateParticipant(participant.key, (current) => ({
                      ...current,
                      status: event.target.value as ParticipantStatus,
                    }))
                  }
                  className="rounded-[18px] border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0b4aa2] focus:ring-4 focus:ring-[#0b4aa2]/10"
                >
                  {PARTICIPANT_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <input
                  value={participant.remarks}
                  onChange={(event) =>
                    updateParticipant(participant.key, (current) => ({
                      ...current,
                      remarks: event.target.value,
                    }))
                  }
                  placeholder="Bemerkung"
                  className="rounded-[18px] border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0b4aa2] focus:ring-4 focus:ring-[#0b4aa2]/10"
                />

                <button
                  type="button"
                  onClick={() => removeParticipant(participant.key)}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Entfernen
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-[1.08rem] font-semibold text-slate-900">
              Traktanden
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Traktanden schnell erfassen, sortieren und für die Durchführung sauber vorbereiten.
            </p>
          </div>

          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {agendaItems.length} erfasst
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)_auto]">
            <input
              value={quickAgendaTitle}
              onChange={(event) => setQuickAgendaTitle(event.target.value)}
              onKeyDown={handleQuickAgendaTitleKeyDown}
              placeholder="Neues Traktand, z. B. Budget Saisonstart"
              className="rounded-[18px] border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0b4aa2] focus:ring-4 focus:ring-[#0b4aa2]/10"
            />

            <input
              value={quickAgendaDescription}
              onChange={(event) => setQuickAgendaDescription(event.target.value)}
              placeholder="Kurzbeschreibung optional"
              className="rounded-[18px] border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.02)] outline-none transition focus:border-[#0b4aa2] focus:ring-4 focus:ring-[#0b4aa2]/10"
            />

            <button
              type="button"
              onClick={addQuickAgendaItem}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <Plus className="h-4 w-4" />
              Hinzufügen
            </button>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Tipp: Im Titelfeld einfach Enter drücken, um das Traktand sofort hinzuzufügen.
          </p>
        </div>

        {agendaItems.length === 0 ? (
          <div className="mt-5 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-500">
            Noch keine Traktanden erfasst. Starte oben mit einem ersten Punkt wie z. B. Begrüssung, Rückblick oder Beschlüsse.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {agendaItems.map((item, index) => (
              <div
                key={item.key}
                className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
                      <GripVertical className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        Traktand {index + 1}
                      </div>
                      <div className="text-xs text-slate-500">
                        Reihenfolge kann direkt angepasst werden.
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => moveAgendaItem(item.key, "up")}
                      disabled={index === 0}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                      Hoch
                    </button>

                    <button
                      type="button"
                      onClick={() => moveAgendaItem(item.key, "down")}
                      disabled={index === agendaItems.length - 1}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                      Runter
                    </button>

                    <button
                      type="button"
                      onClick={() => removeAgendaItem(item.key)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Entfernen
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Titel
                    </label>
                    <input
                      value={item.title}
                      onChange={(event) =>
                        updateAgendaItem(item.key, (current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      placeholder="Titel des Traktands"
                      className="mt-2 w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Beschreibung
                    </label>
                    <textarea
                      value={item.description}
                      onChange={(event) =>
                        updateAgendaItem(item.key, (current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      rows={3}
                      placeholder="Beschreibung optional"
                      className="mt-2 w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/15"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-[1.08rem] font-semibold text-slate-900">
              Pendenzen verknüpfen
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Bestehende Pendenzen direkt auswählen und diesem Meeting zuordnen.
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
                  className={`flex cursor-pointer items-start gap-4 rounded-[24px] border px-5 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition ${
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
